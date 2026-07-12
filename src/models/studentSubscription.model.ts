import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const studentSubscriptionSchema = new Schema(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    planId: { type: Schema.Types.ObjectId, ref: 'SubscriptionPlan' },
    status: {
      type: String,
      enum: ['active', 'expired', 'cancelled'],
      default: 'active',
    },
    currentPeriodStartAt: { type: Date },
    currentPeriodEndAt: { type: Date },
    remainingExpertSessions: { type: Number, default: 0 },
    lockedExpertSessions: { type: Number, default: 0 },
    remainingAiChatMessages: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export type StudentSubscriptionDoc = InferSchemaType<typeof studentSubscriptionSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
};

export default mongoose.model<StudentSubscriptionDoc>('StudentSubscription', studentSubscriptionSchema);
