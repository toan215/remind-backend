import mongoose, { Schema, Document, model } from 'mongoose';

export interface IExpertSlot extends Document {
  expertId: mongoose.Types.ObjectId;
  startAt: Date;
  endAt: Date;
  price: number; // VND per session
  status: 'available' | 'booked' | 'unavailable';
}

const ExpertSlotSchema = new Schema<IExpertSlot>(
  {
    expertId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    price: { type: Number, required: true },
    status: {
      type: String,
      enum: ['available', 'booked', 'unavailable'],
      default: 'available',
      index: true,
    },
  },
  { timestamps: true }
);

ExpertSlotSchema.index({ expertId: 1, startAt: 1 });

export default model<IExpertSlot>('ExpertSlot', ExpertSlotSchema);
