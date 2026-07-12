import mongoose, { Schema, Document, model } from 'mongoose';

/**
 * @interface ICancellation
 * Defines the structure for the cancellation sub-document.
 */
interface ICancellation {
  cancelledBy: mongoose.Types.ObjectId;
  cancelledByRole: string;
  reason: string;
  cancelledAt: Date;
  creditRefunded: boolean;
}

/**
 * @interface IAppointment
 * Defines the main Appointment document interface.
 */
export interface IAppointment extends Document {
  studentId: mongoose.Types.ObjectId;
  expertId: mongoose.Types.ObjectId;
  slotId: mongoose.Types.ObjectId;
  subscriptionId?: mongoose.Types.ObjectId;
  status: 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show' | 'rescheduled';
  creditSource: string;
  creditType: string;
  creditStatus: string;
  scheduledStartAt: Date;
  scheduledEndAt: Date;
  expertJoinedAt?: Date;
  studentJoinedAt?: Date;
  actualStartAt?: Date;
  actualEndAt?: Date;
  expertSessionRate?: number;
  platformFeeRate?: number;
  platformFeeAmount?: number;
  expertPayoutAmount?: number;
  payoutStatus?: string;
  studentNote?: string;
  expertNote?: string;
  cancellation?: ICancellation;
  rescheduleOfAppointmentId?: mongoose.Types.ObjectId;
}

const CancellationSchema = new Schema<ICancellation>({
  cancelledBy: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
  cancelledByRole: { type: String, required: true },
  reason: { type: String, required: true },
  cancelledAt: { type: Date, required: true },
  creditRefunded: { type: Boolean, default: false },
}, { _id: false });

const AppointmentSchema = new Schema<IAppointment>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    expertId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    slotId: { type: Schema.Types.ObjectId, ref: 'ExpertSlot', required: true, index: true },
    subscriptionId: { type: Schema.Types.ObjectId, ref: 'StudentSubscription' },
    status: { type: String, enum: ['confirmed', 'in_progress', 'completed', 'cancelled', 'no_show', 'rescheduled'], required: true, index: true },
    creditSource: { type: String },
    scheduledStartAt: { type: Date, required: true },
    scheduledEndAt: { type: Date, required: true },
    cancellation: { type: CancellationSchema },
    // ... other fields from your design doc
  },
  { timestamps: true }
);

const Appointment = model<IAppointment>('Appointment', AppointmentSchema);

export default Appointment;