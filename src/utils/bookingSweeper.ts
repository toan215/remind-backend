import mongoose from 'mongoose';
import Payment from '../models/payment.model';
import Appointment from '../models/appointment.model';
import ExpertSlot from '../models/expertSlot.model';

// ponytail: single global interval; pass a stop fn if throughput/per-account matters later
export const sweepExpiredBookings = async (): Promise<number> => {
  const now = new Date();
  const expired = await Payment.find({
    kind: 'appointment',
    status: 'pending',
    expiresAt: { $lt: now },
  }).lean();

  let released = 0;
  for (const payment of expired) {
    const appt = await Appointment.findOneAndUpdate(
      { _id: payment.appointmentId, status: 'pending_payment' },
      { $set: { status: 'cancelled' } },
      { returnDocument: 'after' }
    );
    if (!appt) continue;

    await ExpertSlot.updateOne(
      { _id: appt.slotId, status: 'booked' },
      { $set: { status: 'available' } }
    );
    await Payment.updateOne(
      { _id: payment._id },
      { $set: { status: 'cancelled' } }
    );
    released += 1;
  }
  return released;
};

export const startBookingSweeper = (intervalMs = 60_000): NodeJS.Timeout => {
  return setInterval(() => {
    void sweepExpiredBookings().catch((err) =>
      console.error('sweepExpiredBookings error:', err)
    );
  }, intervalMs);
};
