import type { RequestHandler } from 'express';
import mongoose from 'mongoose';
import type { Webhook } from '@payos/node';
import { getPayOSClient } from '../utils/payos';
import { verifyVnpay, createPaymentUrl } from '../utils/vnpay';
import Payment from '../models/payment.model';
import Appointment from '../models/appointment.model';
import CreditPackage from '../models/creditPackage.model';
import SubscriptionPlan from '../models/subscriptionPlan.model';
import StudentCreditWallet from '../models/studentCreditWallet.model';
import CreditTransaction from '../models/creditTransaction.model';
import StudentSubscription from '../models/studentSubscription.model';
import { ensureAppointmentChatRoom } from '../services/appointmentChat.service';

const generateOrderCode = (): number => {
  const ts = String(Date.now());
  const rand = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  return Number(ts.slice(-9) + rand);
};

const isString = (v: unknown): v is string => typeof v === 'string';

const PAYMENT_TIMEOUT_MS = 30 * 60 * 1000;

// --- Student endpoints ---

export const getProducts: RequestHandler = async (req, res) => {
  try {
    const creditPackages = await CreditPackage.find({ isActive: true }).lean();
    const subscriptionPlans = await SubscriptionPlan.find({ isActive: true }).lean();
    return res.status(200).json({ creditPackages, subscriptionPlans });
  } catch (err) {
    console.error('getProducts error:', err);
    return res.status(500).json({ error: 'Failed to fetch products' });
  }
};

interface CreatePaymentBody {
  kind?: unknown;
  productId?: unknown;
}

export const createPayment: RequestHandler<{}, unknown, CreatePaymentBody> = async (req, res) => {
  try {
    const kind = isString(req.body.kind) ? req.body.kind : '';
    const productId = isString(req.body.productId) ? req.body.productId : '';
    const userId = req.user?.id;

    if (!kind || !['credit_package', 'subscription_plan'].includes(kind)) {
      return res.status(400).json({ error: 'Invalid kind. Must be credit_package or subscription_plan' });
    }
    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ error: 'Invalid productId' });
    }
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    let amount = 0;
    let snapshot: Record<string, unknown> = {};

    if (kind === 'credit_package') {
      const pkg = await CreditPackage.findById(productId).lean();
      if (!pkg || !pkg.isActive) {
        return res.status(404).json({ error: 'Credit package not found or inactive' });
      }
      amount = pkg.price;
      snapshot = {
        name: pkg.name,
        type: pkg.type,
        quantity: pkg.quantity,
        price: pkg.price,
        currency: pkg.currency,
      };
    } else {
      const plan = await SubscriptionPlan.findById(productId).lean();
      if (!plan || !plan.isActive) {
        return res.status(404).json({ error: 'Subscription plan not found or inactive' });
      }
      amount = plan.price;
      snapshot = {
        name: plan.name,
        price: plan.price,
        currency: plan.currency,
        billingPeriod: plan.billingPeriod,
        includedExpertSessions: plan.includedExpertSessions,
        aiChatLimitPerMonth: plan.aiChatLimitPerMonth,
        expertSessionValue: plan.expertSessionValue,
        platformFeeRate: plan.platformFeeRate,
      };
    }

    const orderCode = generateOrderCode();
    const expiresAt = new Date(Date.now() + PAYMENT_TIMEOUT_MS);

    const paymentKind = kind as 'credit_package' | 'subscription_plan';
    const payment = await Payment.create({
      userId: new mongoose.Types.ObjectId(userId),
      kind: paymentKind,
      productId: new mongoose.Types.ObjectId(productId),
      productSnapshot: snapshot,
      amount,
      orderCode,
      expiresAt,
      status: 'pending',
    });

    const payOS = getPayOSClient();
    const returnUrl = process.env.PAYMENT_RETURN_URL || 'https://example.com/success';
    const cancelUrl = process.env.PAYMENT_CANCEL_URL || 'https://example.com/cancel';

    const payOSRes = await payOS.paymentRequests.create({
      orderCode,
      amount,
      description: (snapshot.name as string) || 'ReMind payment',
      returnUrl,
      cancelUrl,
      expiredAt: Math.floor(expiresAt.getTime() / 1000),
    });

    const pid = payment._id;
    await Payment.updateOne(
      { _id: pid },
      {
        $set: {
          providerPaymentLinkId: payOSRes.paymentLinkId,
          checkoutUrl: payOSRes.checkoutUrl,
          qrCode: payOSRes.qrCode,
        },
      }
    );

    return res.status(201).json({
      paymentId: pid,
      orderCode,
      amount,
      checkoutUrl: payOSRes.checkoutUrl,
      qrCode: payOSRes.qrCode,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (err) {
    console.error('createPayment error:', err);
    return res.status(500).json({ error: 'Failed to create payment' });
  }
};

export const listMyPayments: RequestHandler = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const cursor = req.query.cursor as string | undefined;
    const status = req.query.status as string | undefined;

    const filter: Record<string, unknown> = { userId: new mongoose.Types.ObjectId(userId) };
    if (status && ['pending', 'succeeded', 'failed', 'cancelled'].includes(status)) {
      filter.status = status;
    }
    if (cursor && mongoose.Types.ObjectId.isValid(cursor)) {
      filter._id = { $lt: new mongoose.Types.ObjectId(cursor) };
    }

    const payments = await Payment.find(filter)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean();

    const hasNext = payments.length > limit;
    const items = hasNext ? payments.slice(0, limit) : payments;
    const nextCursor = items.length > 0 ? items[items.length - 1]._id : null;

    return res.status(200).json({ payments: items, nextCursor, hasNext });
  } catch (err) {
    console.error('listMyPayments error:', err);
    return res.status(500).json({ error: 'Failed to fetch payments' });
  }
};

export const getMyWallet: RequestHandler = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const uid = new mongoose.Types.ObjectId(userId);
    const wallet = await StudentCreditWallet.findOne({ studentId: uid }).lean();
    const subscription = await StudentSubscription.findOne({ studentId: uid })
      .populate('planId', 'name billingPeriod price')
      .lean();

    return res.status(200).json({
      wallet: wallet || { expertSessionCredits: 0, freeExpertSessionCredits: 0, aiChatMessageCredits: 0 },
      subscription: subscription || null,
    });
  } catch (err) {
    console.error('getMyWallet error:', err);
    return res.status(500).json({ error: 'Failed to fetch wallet' });
  }
};

// --- Webhook ---

export const payOSWebhook: RequestHandler = async (req, res) => {
  try {
    const payOS = getPayOSClient();
    const webhookData = await payOS.webhooks.verify(req.body as Webhook);

    const { orderCode } = webhookData;

    // Idempotent: only update if still pending
    const payment = await Payment.findOneAndUpdate(
      { orderCode, status: 'pending' },
      { $set: { status: 'succeeded' as const, paidAt: new Date() } },
      { returnDocument: 'after' }
    ).lean();

    if (!payment) {
      return res.status(200).json({ message: 'OK' });
    }

    // Apply benefits
    if (payment.kind === 'credit_package') {
      const snapshot = payment.productSnapshot as Record<string, unknown> | undefined;
      const qty = (snapshot?.quantity as number) || 0;
      if (snapshot?.type === 'ai_chat_messages') {
        await StudentCreditWallet.updateOne(
          { studentId: payment.userId },
          { $inc: { aiChatMessageCredits: qty } },
          { upsert: true }
        );
      } else {
        await StudentCreditWallet.updateOne(
          { studentId: payment.userId },
          { $inc: { expertSessionCredits: qty } },
          { upsert: true }
        );
      }

      await CreditTransaction.create({
        studentId: payment.userId,
        type: snapshot?.type === 'ai_chat_messages' ? 'ai_chat_message' : 'expert_session',
        direction: 'add',
        quantity: qty,
        source: 'purchase',
        paymentId: payment._id,
      });
    } else if (payment.kind === 'subscription_plan') {
      const snapshot = payment.productSnapshot as Record<string, unknown> | undefined;
      const now = new Date();
      const periodEnd = new Date(now);

      if (snapshot?.billingPeriod === 'yearly') {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }

      const includedSessions = (snapshot?.includedExpertSessions as number) || 0;
      const includedAi = (snapshot?.aiChatLimitPerMonth as number) || 0;

      const existingSub = await StudentSubscription.findOne({ studentId: payment.userId });
      if (existingSub && existingSub.status === 'active' && existingSub.currentPeriodEndAt) {
        if (snapshot?.billingPeriod === 'yearly') {
          existingSub.currentPeriodEndAt.setFullYear(existingSub.currentPeriodEndAt.getFullYear() + 1);
        } else {
          existingSub.currentPeriodEndAt.setMonth(existingSub.currentPeriodEndAt.getMonth() + 1);
        }
        existingSub.currentPeriodStartAt = existingSub.currentPeriodStartAt || now;
        existingSub.remainingExpertSessions += includedSessions;
        existingSub.remainingAiChatMessages += includedAi;
        existingSub.planId = payment.productId;
        await existingSub.save();
      } else {
        await StudentSubscription.findOneAndUpdate(
          { studentId: payment.userId },
          {
            $set: {
              studentId: payment.userId,
              planId: payment.productId,
              status: 'active' as const,
              currentPeriodStartAt: now,
              currentPeriodEndAt: periodEnd,
              remainingExpertSessions: includedSessions,
              lockedExpertSessions: 0,
              remainingAiChatMessages: includedAi,
            },
          },
          { upsert: true, returnDocument: 'after' }
        );
      }

      await CreditTransaction.create({
        studentId: payment.userId,
        type: 'expert_session',
        direction: 'add',
        quantity: includedSessions,
        source: 'subscription',
        paymentId: payment._id,
      });
    }

    return res.status(200).json({ message: 'OK' });
  } catch (err) {
    console.error('payOSWebhook error:', err);
    return res.status(200).json({ message: 'ignored' });
  }
};

// --- Appointment payment (DEMO - instant success, no VNPay) ---

interface CreateAppointmentPaymentBody {
  appointmentId?: unknown;
}

export const createAppointmentPayment: RequestHandler<{}, unknown, CreateAppointmentPaymentBody> = async (req, res) => {
  try {
    const appointmentId = isString(req.body.appointmentId) ? req.body.appointmentId : '';
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    if (!appointmentId || !mongoose.Types.ObjectId.isValid(appointmentId)) {
      return res.status(400).json({ error: 'Invalid appointmentId' });
    }

    const appt = await Appointment.findById(appointmentId);
    if (!appt) return res.status(404).json({ error: 'Appointment not found' });
    if (appt.studentId.toString() !== userId) return res.status(403).json({ error: 'Forbidden' });
    if (appt.status !== 'pending_payment') {
      return res.status(409).json({ error: 'Appointment is not awaiting payment' });
    }

    const orderCode = generateOrderCode();
    const expiresAt = new Date(Date.now() + PAYMENT_TIMEOUT_MS);

    const payment = await Payment.create({
      userId: new mongoose.Types.ObjectId(userId),
      kind: 'appointment',
      appointmentId: appt._id,
      amount: appt.amount ?? 0,
      orderCode,
      status: 'pending',
      provider: 'vnpay',
      expiresAt,
    });

    const returnUrl = process.env.VNPAY_RETURN_URL || 'http://localhost:4000/api/payments/vnpay/return';
    const ipnUrl = process.env.VNPAY_IPN_URL || 'http://localhost:4000/api/payments/vnpay/ipn';

    const checkoutUrl = createPaymentUrl({
      orderCode,
      amount: appt.amount ?? 0,
      returnUrl,
      ipnUrl,
      ipAddr: (req.ip || '127.0.0.1').replace('::ffff:', ''),
    });

    return res.status(201).json({
      paymentId: payment._id,
      orderCode,
      amount: appt.amount,
      checkoutUrl,
    });
  } catch (err) {
    console.error('createAppointmentPayment error:', err);
    return res.status(500).json({ error: 'Failed to create appointment payment' });
  }
};

export const vnpayIpn: RequestHandler = async (req, res) => {
  try {
    if (!verifyVnpay(req.query as Record<string, unknown>)) {
      return res.status(200).json({ RspCode: '97', Message: 'Invalid signature' });
    }

    const orderCode = Number(req.query.vnp_TxnRef);
    const payment = await Payment.findOne({ orderCode });
    if (!payment) return res.status(200).json({ RspCode: '01', Message: 'NotFound' });
    if (payment.status === 'succeeded') {
      return res.status(200).json({ RspCode: '00', Message: 'Success' });
    }

    const responseCode = String(req.query.vnp_ResponseCode || '');
    const txnStatus = String(req.query.vnp_TransactionStatus || '');
    const success = responseCode === '00' && txnStatus === '00';

    if (success) {
      await Payment.updateOne({ _id: payment._id }, { $set: { status: 'succeeded', paidAt: new Date() } });
      const appt = await Appointment.findOneAndUpdate(
        { _id: payment.appointmentId, status: 'pending_payment' },
        { $set: { status: 'booked', paymentId: payment._id } },
        { returnDocument: 'after' }
      ).lean();
      if (appt) {
        await ensureAppointmentChatRoom(appt._id, appt.studentId, appt.expertId, req.app.get('io'));
      }
      return res.status(200).json({ RspCode: '00', Message: 'Success' });
    }

    await Payment.updateOne({ _id: payment._id }, { $set: { status: 'failed' } });
    return res.status(200).json({ RspCode: '00', Message: 'Success' });
  } catch (err) {
    console.error('vnpayIpn error:', err);
    return res.status(200).json({ RspCode: '99', Message: 'Unknown error' });
  }
};

export const vnpayReturn: RequestHandler = async (req, res) => {
  try {
    if (!verifyVnpay(req.query as Record<string, unknown>)) {
      return res.status(400).json({ error: 'invalid' });
    }
    const responseCode = String(req.query.vnp_ResponseCode || '');
    const txnStatus = String(req.query.vnp_TransactionStatus || '');
    const success = responseCode === '00' && txnStatus === '00';
    const base = process.env.VNPAY_RETURN_URL || 'http://localhost:4000/api/payments/vnpay/return';
    return res.redirect(`${base}?status=${success ? 'success' : 'failed'}`);
  } catch (err) {
    console.error('vnpayReturn error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
};

// --- Admin endpoints ---

export const adminListCreditPackages: RequestHandler = async (req, res) => {
  try {
    const packages = await CreditPackage.find().sort({ createdAt: -1 }).lean();
    return res.status(200).json({ creditPackages: packages });
  } catch (err) {
    console.error('adminListCreditPackages error:', err);
    return res.status(500).json({ error: 'Failed to fetch credit packages' });
  }
};

interface CreateCreditPackageBody {
  name?: unknown;
  type?: unknown;
  quantity?: unknown;
  price?: unknown;
}

export const adminCreateCreditPackage: RequestHandler<{}, unknown, CreateCreditPackageBody> = async (req, res) => {
  try {
    const { name, type, quantity, price } = req.body;
    if (!isString(name) || !isString(type) || typeof quantity !== 'number' || typeof price !== 'number') {
      return res.status(400).json({ error: 'name, type, quantity, and price are required' });
    }
    if (!['expert_sessions', 'ai_chat_messages'].includes(type)) {
      return res.status(400).json({ error: 'Invalid type' });
    }
    const pkg = await CreditPackage.create({
      name: name.trim(),
      type: type as 'expert_sessions' | 'ai_chat_messages',
      quantity,
      price,
    });
    return res.status(201).json({ creditPackage: pkg });
  } catch (err) {
    console.error('adminCreateCreditPackage error:', err);
    return res.status(500).json({ error: 'Failed to create credit package' });
  }
};

export const adminUpdateCreditPackage: RequestHandler = async (req, res) => {
  try {
    const id = req.params.id as string;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid id' });

    const updates: Record<string, unknown> = {};
    if (req.body.name !== undefined) updates.name = String(req.body.name).trim();
    if (req.body.type !== undefined) {
      if (!['expert_sessions', 'ai_chat_messages'].includes(req.body.type)) {
        return res.status(400).json({ error: 'Invalid type' });
      }
      updates.type = req.body.type;
    }
    if (req.body.quantity !== undefined) updates.quantity = Number(req.body.quantity);
    if (req.body.price !== undefined) updates.price = Number(req.body.price);
    if (req.body.isActive !== undefined) updates.isActive = Boolean(req.body.isActive);

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const pkg = await CreditPackage.findByIdAndUpdate(id, { $set: updates }, { returnDocument: 'after' });
    if (!pkg) return res.status(404).json({ error: 'Credit package not found' });

    return res.status(200).json({ creditPackage: pkg });
  } catch (err) {
    console.error('adminUpdateCreditPackage error:', err);
    return res.status(500).json({ error: 'Failed to update credit package' });
  }
};

export const adminDeactivateCreditPackage: RequestHandler = async (req, res) => {
  try {
    const id = req.params.id as string;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid id' });

    const pkg = await CreditPackage.findByIdAndUpdate(id, { $set: { isActive: false } }, { returnDocument: 'after' });
    if (!pkg) return res.status(404).json({ error: 'Credit package not found' });

    return res.status(200).json({ message: 'Credit package deactivated', creditPackage: pkg });
  } catch (err) {
    console.error('adminDeactivateCreditPackage error:', err);
    return res.status(500).json({ error: 'Failed to deactivate credit package' });
  }
};

export const adminListSubscriptionPlans: RequestHandler = async (req, res) => {
  try {
    const plans = await SubscriptionPlan.find().sort({ createdAt: -1 }).lean();
    return res.status(200).json({ subscriptionPlans: plans });
  } catch (err) {
    console.error('adminListSubscriptionPlans error:', err);
    return res.status(500).json({ error: 'Failed to fetch subscription plans' });
  }
};

interface CreateSubscriptionPlanBody {
  name?: unknown;
  price?: unknown;
  billingPeriod?: unknown;
  includedExpertSessions?: unknown;
  aiChatLimitPerMonth?: unknown;
  expertSessionValue?: unknown;
  platformFeeRate?: unknown;
}

export const adminCreateSubscriptionPlan: RequestHandler<{}, unknown, CreateSubscriptionPlanBody> = async (req, res) => {
  try {
    const { name, price, billingPeriod } = req.body;
    if (!isString(name) || typeof price !== 'number' || !isString(billingPeriod)) {
      return res.status(400).json({ error: 'name, price, and billingPeriod are required' });
    }
    if (!['monthly', 'yearly'].includes(billingPeriod)) {
      return res.status(400).json({ error: 'Invalid billingPeriod' });
    }

    const plan = await SubscriptionPlan.create({
      name: name.trim(),
      price,
      billingPeriod: billingPeriod as 'monthly' | 'yearly',
      includedExpertSessions: typeof req.body.includedExpertSessions === 'number' ? req.body.includedExpertSessions : 0,
      aiChatLimitPerMonth: typeof req.body.aiChatLimitPerMonth === 'number' ? req.body.aiChatLimitPerMonth : 0,
      expertSessionValue: typeof req.body.expertSessionValue === 'number' ? req.body.expertSessionValue : 0,
      platformFeeRate: typeof req.body.platformFeeRate === 'number' ? req.body.platformFeeRate : 0,
    });

    return res.status(201).json({ subscriptionPlan: plan });
  } catch (err) {
    console.error('adminCreateSubscriptionPlan error:', err);
    return res.status(500).json({ error: 'Failed to create subscription plan' });
  }
};

export const adminUpdateSubscriptionPlan: RequestHandler = async (req, res) => {
  try {
    const id = req.params.id as string;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid id' });

    const updates: Record<string, unknown> = {};
    if (req.body.name !== undefined) updates.name = String(req.body.name).trim();
    if (req.body.price !== undefined) updates.price = Number(req.body.price);
    if (req.body.billingPeriod !== undefined) {
      if (!['monthly', 'yearly'].includes(req.body.billingPeriod)) {
        return res.status(400).json({ error: 'Invalid billingPeriod' });
      }
      updates.billingPeriod = req.body.billingPeriod;
    }
    if (req.body.includedExpertSessions !== undefined) updates.includedExpertSessions = Number(req.body.includedExpertSessions);
    if (req.body.aiChatLimitPerMonth !== undefined) updates.aiChatLimitPerMonth = Number(req.body.aiChatLimitPerMonth);
    if (req.body.expertSessionValue !== undefined) updates.expertSessionValue = Number(req.body.expertSessionValue);
    if (req.body.platformFeeRate !== undefined) updates.platformFeeRate = Number(req.body.platformFeeRate);
    if (req.body.isActive !== undefined) updates.isActive = Boolean(req.body.isActive);

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const plan = await SubscriptionPlan.findByIdAndUpdate(id, { $set: updates }, { returnDocument: 'after' });
    if (!plan) return res.status(404).json({ error: 'Subscription plan not found' });

    return res.status(200).json({ subscriptionPlan: plan });
  } catch (err) {
    console.error('adminUpdateSubscriptionPlan error:', err);
    return res.status(500).json({ error: 'Failed to update subscription plan' });
  }
};

export const adminDeactivateSubscriptionPlan: RequestHandler = async (req, res) => {
  try {
    const id = req.params.id as string;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid id' });

    const plan = await SubscriptionPlan.findByIdAndUpdate(id, { $set: { isActive: false } }, { returnDocument: 'after' });
    if (!plan) return res.status(404).json({ error: 'Subscription plan not found' });

    return res.status(200).json({ message: 'Subscription plan deactivated', subscriptionPlan: plan });
  } catch (err) {
    console.error('adminDeactivateSubscriptionPlan error:', err);
    return res.status(500).json({ error: 'Failed to deactivate subscription plan' });
  }
};

export const adminListPayments: RequestHandler = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const cursor = req.query.cursor as string | undefined;
    const status = req.query.status as string | undefined;
    const kind = req.query.kind as string | undefined;

    const filter: Record<string, unknown> = {};
    if (status && ['pending', 'succeeded', 'failed', 'cancelled'].includes(status)) {
      filter.status = status;
    }
    if (kind && ['credit_package', 'subscription_plan'].includes(kind)) {
      filter.kind = kind;
    }
    if (cursor && mongoose.Types.ObjectId.isValid(cursor)) {
      filter._id = { $lt: new mongoose.Types.ObjectId(cursor) };
    }

    const payments = await Payment.find(filter)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .populate('userId', 'email fullName')
      .lean();

    const hasNext = payments.length > limit;
    const items = hasNext ? payments.slice(0, limit) : payments;
    const nextCursor = items.length > 0 ? items[items.length - 1]._id : null;

    return res.status(200).json({ payments: items, nextCursor, hasNext });
  } catch (err) {
    console.error('adminListPayments error:', err);
    return res.status(500).json({ error: 'Failed to fetch payments' });
  }
};

export const adminPaymentSummary: RequestHandler = async (req, res) => {
  try {
    const [stats] = await Payment.aggregate([
      {
        $group: {
          _id: null,
          totalMoneyIn: { $sum: { $cond: [{ $eq: ['$status', 'succeeded'] }, '$amount', 0] } },
          successCount: { $sum: { $cond: [{ $eq: ['$status', 'succeeded'] }, 1, 0] } },
          pendingCount: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          failedCount: { $sum: { $cond: [{ $in: ['$status', ['failed', 'cancelled']] }, 1, 0] } },
          totalCount: { $sum: 1 },
        },
      },
    ]);

    return res.status(200).json({
      summary: stats || { totalMoneyIn: 0, successCount: 0, pendingCount: 0, failedCount: 0, totalCount: 0 },
    });
  } catch (err) {
    console.error('adminPaymentSummary error:', err);
    return res.status(500).json({ error: 'Failed to get payment summary' });
  }
};
