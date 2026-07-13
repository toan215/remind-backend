import express from 'express';
import request from 'supertest';
import type { Express } from 'express';
import mongoose from 'mongoose';
import paymentRoutes from '../routes/payments.routes';
import adminRoutes from '../routes/admin.routes';
import { requireAuth, requireActiveUser, requireRole } from '../middlewares/auth.middleware';
import Payment from '../models/payment.model';
import CreditPackage from '../models/creditPackage.model';
import SubscriptionPlan from '../models/subscriptionPlan.model';
import StudentCreditWallet from '../models/studentCreditWallet.model';
import CreditTransaction from '../models/creditTransaction.model';
import StudentSubscription from '../models/studentSubscription.model';
import { signToken } from './helpers';

const mockPayOSCreate = jest.fn();
const mockPayOSVerify = jest.fn();

jest.mock('@payos/node', () => ({
  PayOS: jest.fn().mockImplementation(() => ({
    paymentRequests: { create: mockPayOSCreate },
    webhooks: { verify: mockPayOSVerify },
  })),
}));

const buildStudentApp = (): Express => {
  const app = express();
  app.use(express.json());
  app.use('/api/payments', paymentRoutes);
  return app;
};

const buildAdminApp = (): Express => {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRoutes);
  return app;
};

const studentToken = signToken(new mongoose.Types.ObjectId().toString(), 'student', 'active', 'Student');
const adminToken = signToken(new mongoose.Types.ObjectId().toString(), 'admin', 'active', 'Admin');
const pendingToken = signToken(new mongoose.Types.ObjectId().toString(), 'student', 'pending', 'Pending');

describe('Payments API', () => {
  let app: Express;
  let adminApp: Express;
  let creditPackageId: string;
  let subscriptionPlanId: string;
  const userId = new mongoose.Types.ObjectId();

  beforeAll(() => {
    app = buildStudentApp();
    adminApp = buildAdminApp();
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const cp = await CreditPackage.create({ name: '5 sessions', type: 'expert_sessions', quantity: 5, price: 500000 });
    creditPackageId = cp._id.toString();

    const sp = await SubscriptionPlan.create({
      name: 'Monthly',
      price: 199000,
      billingPeriod: 'monthly',
      includedExpertSessions: 1,
      aiChatLimitPerMonth: 100,
    });
    subscriptionPlanId = sp._id.toString();
  });

  describe('GET /api/payments/products', () => {
    it('returns active products', async () => {
      const res = await request(app).get('/api/payments/products').set('Authorization', `Bearer ${studentToken}`);
      expect(res.status).toBe(200);
      expect(res.body.creditPackages).toHaveLength(1);
      expect(res.body.creditPackages[0].name).toBe('5 sessions');
      expect(res.body.subscriptionPlans).toHaveLength(1);
      expect(res.body.subscriptionPlans[0].name).toBe('Monthly');
    });
  });

  describe('POST /api/payments/payos', () => {
    it('creates a payment link for credit package', async () => {
      let capturedOrderCode: number | null = null;
      mockPayOSCreate.mockImplementation(async (args: { orderCode: number; amount: number; description: string; returnUrl: string; cancelUrl: string; expiredAt: number }) => {
        capturedOrderCode = args.orderCode;
        return {
          bin: '970422',
          accountNumber: '113366668888',
          accountName: 'TEST ACCOUNT',
          amount: 500000,
          description: '5 sessions',
          orderCode: args.orderCode,
          paymentLinkId: 'test-link-1',
          status: 'PENDING',
          checkoutUrl: 'https://pay.payos.vn/web/test-link-1',
          qrCode: '000201010212...',
        };
      });

      const token = signToken(userId.toString(), 'student', 'active', 'Student');
      const res = await request(app)
        .post('/api/payments/payos')
        .set('Authorization', `Bearer ${token}`)
        .send({ kind: 'credit_package', productId: creditPackageId });

      expect(res.status).toBe(201);
      expect(res.body.checkoutUrl).toBe('https://pay.payos.vn/web/test-link-1');
      expect(res.body.qrCode).toBe('000201010212...');
      expect(res.body.amount).toBe(500000);

      expect(capturedOrderCode).not.toBeNull();
      const payment = await Payment.findOne({ orderCode: capturedOrderCode! });
      expect(payment).not.toBeNull();
      expect(payment?.status).toBe('pending');
      expect(payment?.kind).toBe('credit_package');
    });

    it('creates a payment link for subscription plan', async () => {
      mockPayOSCreate.mockResolvedValue({
        bin: '970422',
        accountNumber: '113366668888',
        accountName: 'TEST ACCOUNT',
        amount: 199000,
        description: 'Monthly',
        orderCode: 654321,
        paymentLinkId: 'test-link-2',
        status: 'PENDING',
        checkoutUrl: 'https://pay.payos.vn/web/test-link-2',
        qrCode: '000201010212...',
      });

      const token = signToken(userId.toString(), 'student', 'active', 'Student');
      const res = await request(app)
        .post('/api/payments/payos')
        .set('Authorization', `Bearer ${token}`)
        .send({ kind: 'subscription_plan', productId: subscriptionPlanId });

      expect(res.status).toBe(201);
      expect(res.body.checkoutUrl).toBe('https://pay.payos.vn/web/test-link-2');
    });

    it('rejects inactive product', async () => {
      await CreditPackage.findByIdAndUpdate(creditPackageId, { $set: { isActive: false } });
      const token = signToken(userId.toString(), 'student', 'active', 'Student');
      const res = await request(app)
        .post('/api/payments/payos')
        .set('Authorization', `Bearer ${token}`)
        .send({ kind: 'credit_package', productId: creditPackageId });

      expect(res.status).toBe(404);
    });

    it('requires active user', async () => {
      const res = await request(app)
        .post('/api/payments/payos')
        .set('Authorization', `Bearer ${pendingToken}`)
        .send({ kind: 'credit_package', productId: creditPackageId });
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/payments', () => {
    it('lists own payments', async () => {
      const token = signToken(userId.toString(), 'student', 'active', 'Student');
      await Payment.create([
        { userId, kind: 'credit_package', productId: new mongoose.Types.ObjectId(creditPackageId), amount: 500000, orderCode: 111, status: 'succeeded' },
        { userId, kind: 'subscription_plan', productId: new mongoose.Types.ObjectId(subscriptionPlanId), amount: 199000, orderCode: 222, status: 'pending' },
      ]);

      const res = await request(app).get('/api/payments').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.payments).toHaveLength(2);
    });
  });

  describe('GET /api/payments/wallet', () => {
    it('returns wallet and subscription', async () => {
      const token = signToken(userId.toString(), 'student', 'active', 'Student');
      const uid = userId;
      await StudentCreditWallet.create({ studentId: uid, expertSessionCredits: 5 });
      await StudentSubscription.create({
        studentId: uid,
        planId: new mongoose.Types.ObjectId(subscriptionPlanId),
        status: 'active',
        currentPeriodEndAt: new Date(Date.now() + 86400000),
        remainingExpertSessions: 1,
      });

      const res = await request(app).get('/api/payments/wallet').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.wallet.expertSessionCredits).toBe(5);
      expect(res.body.subscription).not.toBeNull();
      expect(res.body.subscription.status).toBe('active');
    });
  });

  describe('POST /api/payments/payos/webhook', () => {
    it('processes credit package payment and grants credits', async () => {
      const uid = userId;
      const payment = await Payment.create({
        userId: uid,
        kind: 'credit_package',
        productId: new mongoose.Types.ObjectId(creditPackageId),
        productSnapshot: { name: '5 sessions', type: 'expert_sessions', quantity: 5, price: 500000 },
        amount: 500000,
        orderCode: 999001,
        status: 'pending',
      });

      mockPayOSVerify.mockResolvedValue({
        orderCode: 999001,
        amount: 500000,
        description: '5 sessions',
        reference: 'TF123456',
        transactionDateTime: '2024-01-15 10:30:00',
        currency: 'VND',
        paymentLinkId: 'test-link-webhook-1',
        code: '00',
        desc: 'success',
      });

      const res = await request(app).post('/api/payments/payos/webhook').send({});
      expect(res.status).toBe(200);

      const updated = await Payment.findOne({ orderCode: 999001 });
      expect(updated?.status).toBe('succeeded');
      expect(updated?.paidAt).toBeTruthy();

      const wallet = await StudentCreditWallet.findOne({ studentId: uid });
      expect(wallet?.expertSessionCredits).toBe(5);

      const txn = await CreditTransaction.findOne({ paymentId: payment._id });
      expect(txn).not.toBeNull();
      expect(txn?.direction).toBe('add');
    });

    it('is idempotent - does not apply benefits twice', async () => {
      const uid = userId;
      await Payment.create({
        userId: uid,
        kind: 'credit_package',
        productId: new mongoose.Types.ObjectId(creditPackageId),
        productSnapshot: { name: '5 sessions', type: 'expert_sessions', quantity: 5, price: 500000 },
        amount: 500000,
        orderCode: 999002,
        status: 'succeeded',
      });

      mockPayOSVerify.mockResolvedValue({
        orderCode: 999002,
        amount: 500000,
        description: '5 sessions',
        reference: 'TF123457',
        transactionDateTime: '2024-01-15 10:30:00',
        currency: 'VND',
        paymentLinkId: 'test-link-idem',
        code: '00',
        desc: 'success',
      });

      const res = await request(app).post('/api/payments/payos/webhook').send({});
      expect(res.status).toBe(200);

      const wallet = await StudentCreditWallet.findOne({ studentId: uid });
      expect(wallet).toBeNull();
    });

    it('processes subscription payment and creates/extends subscription', async () => {
      const uid = userId;
      await Payment.create({
        userId: uid,
        kind: 'subscription_plan',
        productId: new mongoose.Types.ObjectId(subscriptionPlanId),
        productSnapshot: {
          name: 'Monthly',
          price: 199000,
          billingPeriod: 'monthly',
          includedExpertSessions: 1,
          aiChatLimitPerMonth: 100,
        },
        amount: 199000,
        orderCode: 999003,
        status: 'pending',
      });

      mockPayOSVerify.mockResolvedValue({
        orderCode: 999003,
        amount: 199000,
        description: 'Monthly',
        reference: 'TF123458',
        transactionDateTime: '2024-01-15 10:30:00',
        currency: 'VND',
        paymentLinkId: 'test-link-sub',
        code: '00',
        desc: 'success',
      });

      const res = await request(app).post('/api/payments/payos/webhook').send({});
      expect(res.status).toBe(200);

      const sub = await StudentSubscription.findOne({ studentId: uid });
      expect(sub).not.toBeNull();
      expect(sub?.status).toBe('active');
      expect(sub?.remainingExpertSessions).toBe(1);
      expect(sub?.remainingAiChatMessages).toBe(100);
    });
  });

  describe('Admin: credit packages CRUD', () => {
    it('lists credit packages', async () => {
      const res = await request(adminApp)
        .get('/api/admin/payments/credit-packages')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.creditPackages).toHaveLength(1);
    });

    it('creates a credit package', async () => {
      const res = await request(adminApp)
        .post('/api/admin/payments/credit-packages')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: '20 sessions', type: 'expert_sessions', quantity: 20, price: 1600000 });
      expect(res.status).toBe(201);
      expect(res.body.creditPackage.name).toBe('20 sessions');
    });

    it('deactivates a credit package', async () => {
      const res = await request(adminApp)
        .delete(`/api/admin/payments/credit-packages/${creditPackageId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);

      const pkg = await CreditPackage.findById(creditPackageId);
      expect(pkg?.isActive).toBe(false);
    });
  });

  describe('Admin: payments list and summary', () => {
    it('lists all payments', async () => {
      await Payment.create([
        { userId, kind: 'credit_package', amount: 500000, orderCode: 777, status: 'succeeded' },
        { userId, kind: 'subscription_plan', amount: 199000, orderCode: 888, status: 'pending' },
      ]);

      const res = await request(adminApp)
        .get('/api/admin/payments')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.payments.length).toBeGreaterThanOrEqual(2);
    });

    it('returns payment summary', async () => {
      const res = await request(adminApp)
        .get('/api/admin/payments/summary')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.summary).toHaveProperty('totalMoneyIn');
      expect(res.body.summary).toHaveProperty('successCount');
    });
  });
});
