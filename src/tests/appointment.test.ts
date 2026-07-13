import express from 'express';
import request from 'supertest';
import type { Express } from 'express';
import mongoose from 'mongoose';
import appointmentRoutes from '../routes/appointment.routes';
import paymentRoutes from '../routes/payments.routes';
import Appointment from '../models/appointment.model';
import ExpertSlot from '../models/expertSlot.model';
import Payment from '../models/payment.model';
import User from '../models/user.model';
import { signToken } from './helpers';
import { computeVnpaySecureHash } from '../utils/vnpay';
import { sweepExpiredBookings } from '../utils/bookingSweeper';

const buildApp = (): Express => {
  const app = express();
  app.use(express.json());
  app.use('/api/appointments', appointmentRoutes);
  app.use('/api/payments', paymentRoutes);
  return app;
};

const app = buildApp();

const makeStudent = async () => {
  const id = new mongoose.Types.ObjectId();
  await User.create({ _id: id, email: `student-${id}@test.com`, role: 'student', status: 'active', fullName: 'Student' });
  return { id: id.toString(), token: signToken(id.toString(), 'student', 'active', 'Student') };
};

const makeExpert = async () => {
  const id = new mongoose.Types.ObjectId();
  await User.create({ _id: id, email: `expert-${id}@test.com`, role: 'expert', status: 'active', fullName: 'Expert' });
  return { id: id.toString(), token: signToken(id.toString(), 'expert', 'active', 'Expert') };
};

const makeSlot = async (expertId: string, price = 300000) => {
  const slot = await ExpertSlot.create({
    expertId: new mongoose.Types.ObjectId(expertId),
    startAt: new Date(Date.now() + 86400000),
    endAt: new Date(Date.now() + 86400000 + 3600000),
    price,
    status: 'available',
  });
  return slot._id.toString();
};

// Build a signed VNPAY IPN query (mirrors how VNPAY signs outgoing requests).
const buildIpnQuery = (orderCode: number, responseCode = '00', txnStatus = '00'): Record<string, string> => {
  const query: Record<string, string> = {
    vnp_TxnRef: String(orderCode),
    vnp_ResponseCode: responseCode,
    vnp_TransactionStatus: txnStatus,
  };
  const secret = process.env.VNPAY_HASH_SECRET || '';
  query.vnp_SecureHash = computeVnpaySecureHash(query, secret);
  return query;
};

describe('Appointment booking + VNPAY demo payment flow', () => {
  describe('POST /api/appointments/book', () => {
    it('reserves the slot and creates a pending_payment appointment', async () => {
      const student = await makeStudent();
      const expert = await makeExpert();
      const slotId = await makeSlot(expert.id);

      const res = await request(app)
        .post('/api/appointments/book')
        .set('Authorization', `Bearer ${student.token}`)
        .send({ expertId: expert.id, slotId });

      expect(res.status).toBe(201);
      expect(res.body.appointment.status).toBe('pending_payment');

      const slot = await ExpertSlot.findById(slotId);
      expect(slot?.status).toBe('booked');

      const appt = await Appointment.findOne({ studentId: student.id });
      expect(appt).not.toBeNull();
      expect(appt?.status).toBe('pending_payment');
      expect(appt?.slotId.toString()).toBe(slotId);
    });

    it('rejects a second booking of the same slot with 409', async () => {
      const studentA = await makeStudent();
      const studentB = await makeStudent();
      const expert = await makeExpert();
      const slotId = await makeSlot(expert.id);

      const first = await request(app)
        .post('/api/appointments/book')
        .set('Authorization', `Bearer ${studentA.token}`)
        .send({ expertId: expert.id, slotId });
      expect(first.status).toBe(201);

      const second = await request(app)
        .post('/api/appointments/book')
        .set('Authorization', `Bearer ${studentB.token}`)
        .send({ expertId: expert.id, slotId });
      expect(second.status).toBe(409);
      expect(second.body.error).toBe('Slot not available');

      // Slot remains booked by the first student
      const slot = await ExpertSlot.findById(slotId);
      expect(slot?.status).toBe('booked');
    });
  });

  describe('POST /api/payments/appointment', () => {
    it('creates a VNPAY checkout link for the appointment', async () => {
      const student = await makeStudent();
      const expert = await makeExpert();
      const slotId = await makeSlot(expert.id);

      const book = await request(app)
        .post('/api/appointments/book')
        .set('Authorization', `Bearer ${student.token}`)
        .send({ expertId: expert.id, slotId });
      const appointmentId = book.body.appointment._id;

      const res = await request(app)
        .post('/api/payments/appointment')
        .set('Authorization', `Bearer ${student.token}`)
        .send({ appointmentId });

      expect(res.status).toBe(201);
      expect(typeof res.body.orderCode).toBe('number');
      expect(res.body.checkoutUrl).toContain(process.env.VNPAY_URL || '');
      expect(res.body.checkoutUrl).toContain('?');

      const payment = await Payment.findOne({ orderCode: res.body.orderCode });
      expect(payment).not.toBeNull();
      expect(payment?.kind).toBe('appointment');
      expect(payment?.status).toBe('pending');
      expect(payment?.provider).toBe('vnpay');
      expect(payment?.appointmentId?.toString()).toBe(appointmentId);
    });
  });

  describe('POST /api/payments/vnpay/ipn', () => {
    it('marks payment succeeded and appointment booked on successful IPN', async () => {
      const student = await makeStudent();
      const expert = await makeExpert();
      const slotId = await makeSlot(expert.id);

      const book = await request(app)
        .post('/api/appointments/book')
        .set('Authorization', `Bearer ${student.token}`)
        .send({ expertId: expert.id, slotId });
      const appointmentId = book.body.appointment._id;

      const pay = await request(app)
        .post('/api/payments/appointment')
        .set('Authorization', `Bearer ${student.token}`)
        .send({ appointmentId });
      const orderCode: number = pay.body.orderCode;
      const paymentId = pay.body.paymentId;

      const ipn = buildIpnQuery(orderCode);
      const res = await request(app).post('/api/payments/vnpay/ipn').query(ipn);

      expect(res.status).toBe(200);
      expect(res.body.RspCode).toBe('00');

      const payment = await Payment.findById(paymentId);
      expect(payment?.status).toBe('succeeded');
      expect(payment?.paidAt).toBeTruthy();

      const appt = await Appointment.findById(appointmentId);
      expect(appt?.status).toBe('booked');
      expect(appt?.paymentId?.toString()).toBe(paymentId);
    });

    it('is idempotent - a repeated valid IPN keeps the appointment booked', async () => {
      const student = await makeStudent();
      const expert = await makeExpert();
      const slotId = await makeSlot(expert.id);

      const book = await request(app)
        .post('/api/appointments/book')
        .set('Authorization', `Bearer ${student.token}`)
        .send({ expertId: expert.id, slotId });
      const appointmentId = book.body.appointment._id;

      const pay = await request(app)
        .post('/api/payments/appointment')
        .set('Authorization', `Bearer ${student.token}`)
        .send({ appointmentId });
      const orderCode: number = pay.body.orderCode;
      const paymentId = pay.body.paymentId;

      const ipn = buildIpnQuery(orderCode);
      const first = await request(app).post('/api/payments/vnpay/ipn').query(ipn);
      expect(first.body.RspCode).toBe('00');

      const second = await request(app).post('/api/payments/vnpay/ipn').query(ipn);
      expect(second.status).toBe(200);
      expect(second.body.RspCode).toBe('00');

      const appt = await Appointment.findById(appointmentId);
      expect(appt?.status).toBe('booked');

      const payment = await Payment.findById(paymentId);
      expect(payment?.status).toBe('succeeded');
    });

    it('rejects an IPN with an invalid signature and leaves the appointment pending', async () => {
      const student = await makeStudent();
      const expert = await makeExpert();
      const slotId = await makeSlot(expert.id);

      const book = await request(app)
        .post('/api/appointments/book')
        .set('Authorization', `Bearer ${student.token}`)
        .send({ expertId: expert.id, slotId });
      const appointmentId = book.body.appointment._id;

      const pay = await request(app)
        .post('/api/payments/appointment')
        .set('Authorization', `Bearer ${student.token}`)
        .send({ appointmentId });
      const orderCode: number = pay.body.orderCode;
      const paymentId = pay.body.paymentId;

      const res = await request(app)
        .post('/api/payments/vnpay/ipn')
        .query({
          vnp_TxnRef: String(orderCode),
          vnp_ResponseCode: '00',
          vnp_TransactionStatus: '00',
          vnp_SecureHash: 'deadbeefdeadbeef',
        });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ RspCode: '97', Message: 'Invalid signature' });

      const appt = await Appointment.findById(appointmentId);
      expect(appt?.status).toBe('pending_payment');

      const payment = await Payment.findById(paymentId);
      expect(payment?.status).toBe('pending');
    });
  });

  describe('POST /api/appointments/:id/cancel', () => {
    it('cancels a pending_payment appointment and frees the slot (student)', async () => {
      const student = await makeStudent();
      const expert = await makeExpert();
      const slotId = await makeSlot(expert.id);

      const book = await request(app)
        .post('/api/appointments/book')
        .set('Authorization', `Bearer ${student.token}`)
        .send({ expertId: expert.id, slotId });
      const appointmentId = book.body.appointment._id;

      const res = await request(app)
        .post(`/api/appointments/${appointmentId}/cancel`)
        .set('Authorization', `Bearer ${student.token}`);

      expect(res.status).toBe(200);

      const appt = await Appointment.findById(appointmentId);
      expect(appt?.status).toBe('cancelled');

      const slot = await ExpertSlot.findById(slotId);
      expect(slot?.status).toBe('available');
    });

    it('cancels a booked appointment and frees the slot (expert)', async () => {
      const student = await makeStudent();
      const expert = await makeExpert();
      const slotId = await makeSlot(expert.id);

      const book = await request(app)
        .post('/api/appointments/book')
        .set('Authorization', `Bearer ${student.token}`)
        .send({ expertId: expert.id, slotId });
      const appointmentId = book.body.appointment._id;

      const pay = await request(app)
        .post('/api/payments/appointment')
        .set('Authorization', `Bearer ${student.token}`)
        .send({ appointmentId });
      const orderCode: number = pay.body.orderCode;

      const ipn = buildIpnQuery(orderCode);
      await request(app).post('/api/payments/vnpay/ipn').query(ipn);

      const apptBefore = await Appointment.findById(appointmentId);
      expect(apptBefore?.status).toBe('booked');

      const res = await request(app)
        .post(`/api/appointments/${appointmentId}/cancel`)
        .set('Authorization', `Bearer ${expert.token}`);

      expect(res.status).toBe(200);

      const appt = await Appointment.findById(appointmentId);
      expect(appt?.status).toBe('cancelled');

      const slot = await ExpertSlot.findById(slotId);
      expect(slot?.status).toBe('available');
    });
  });

  describe('booking expiry sweeper', () => {
    it('releases the slot and cancels the appointment when payment times out', async () => {
      const student = await makeStudent();
      const expert = await makeExpert();
      const slotId = await makeSlot(expert.id);

      const book = await request(app)
        .post('/api/appointments/book')
        .set('Authorization', `Bearer ${student.token}`)
        .send({ expertId: expert.id, slotId });
      const appointmentId = book.body.appointment._id;

      const pay = await request(app)
        .post('/api/payments/appointment')
        .set('Authorization', `Bearer ${student.token}`)
        .send({ appointmentId });
      const paymentId = pay.body.paymentId;

      // Force the payment to be expired
      await Payment.updateOne(
        { _id: paymentId },
        { $set: { expiresAt: new Date(Date.now() - 1000) } }
      );

      const released = await sweepExpiredBookings();
      expect(released).toBe(1);

      const appt = await Appointment.findById(appointmentId);
      expect(appt?.status).toBe('cancelled');

      const slot = await ExpertSlot.findById(slotId);
      expect(slot?.status).toBe('available');

      const payment = await Payment.findById(paymentId);
      expect(payment?.status).toBe('cancelled');
    });
  });
});
