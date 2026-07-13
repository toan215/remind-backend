import type { RequestHandler } from 'express';
import mongoose from 'mongoose';
import Appointment from '../models/appointment.model';
import ExpertSlot from '../models/expertSlot.model';

const isString = (v: unknown): v is string => typeof v === 'string';

export const bookAppointment: RequestHandler = async (req, res) => {
  try {
    const expertId = isString(req.body.expertId) ? req.body.expertId : '';
    const slotId = isString(req.body.slotId) ? req.body.slotId : '';
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    if (!mongoose.Types.ObjectId.isValid(expertId) || !mongoose.Types.ObjectId.isValid(slotId)) {
      return res.status(400).json({ error: 'Invalid expertId or slotId' });
    }

    const slot = await ExpertSlot.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(slotId),
        expertId: new mongoose.Types.ObjectId(expertId),
        status: 'available',
      },
      { $set: { status: 'booked' } },
      { new: true }
    );
    if (!slot) return res.status(409).json({ error: 'Slot not available' });

    const appointment = await Appointment.create({
      studentId: new mongoose.Types.ObjectId(userId),
      expertId: new mongoose.Types.ObjectId(expertId),
      slotId: slot._id,
      status: 'pending_payment',
      scheduledStartAt: slot.startAt,
      scheduledEndAt: slot.endAt,
      amount: slot.price,
    });

    return res.status(201).json({ appointment });
  } catch (err) {
    console.error('bookAppointment error:', err);
    return res.status(500).json({ error: 'Failed to book appointment' });
  }
};

export const listMyAppointments: RequestHandler = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const appointments = await Appointment.find({ studentId: new mongoose.Types.ObjectId(userId) })
      .sort({ scheduledStartAt: 1 })
      .lean();

    return res.status(200).json({ appointments });
  } catch (err) {
    console.error('listMyAppointments error:', err);
    return res.status(500).json({ error: 'Failed to fetch appointments' });
  }
};

export const listExpertAppointments: RequestHandler = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const appointments = await Appointment.find({ expertId: new mongoose.Types.ObjectId(userId) })
      .sort({ scheduledStartAt: 1 })
      .lean();

    return res.status(200).json({ appointments });
  } catch (err) {
    console.error('listExpertAppointments error:', err);
    return res.status(500).json({ error: 'Failed to fetch appointments' });
  }
};

export const cancelAppointment: RequestHandler = async (req, res) => {
  try {
    const id = req.params.id as string;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid id' });

    const appt = await Appointment.findById(id);
    if (!appt) return res.status(404).json({ error: 'Appointment not found' });
    if (appt.studentId.toString() !== userId && appt.expertId.toString() !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (appt.status !== 'pending_payment' && appt.status !== 'booked') {
      return res.status(409).json({ error: 'Appointment cannot be cancelled' });
    }

    await Appointment.updateOne({ _id: appt._id }, { $set: { status: 'cancelled' } });
    await ExpertSlot.updateOne({ _id: appt.slotId }, { $set: { status: 'available' } });

    return res.status(200).json({ message: 'Appointment cancelled' });
  } catch (err) {
    console.error('cancelAppointment error:', err);
    return res.status(500).json({ error: 'Failed to cancel appointment' });
  }
};
