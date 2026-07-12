import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const subscriptionPlanSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true },
    currency: { type: String, default: 'VND' },
    billingPeriod: { type: String, enum: ['monthly', 'yearly'], required: true },
    includedExpertSessions: { type: Number, default: 0 },
    aiChatLimitPerMonth: { type: Number, default: 0 },
    expertSessionValue: { type: Number, default: 0 },
    platformFeeRate: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export type SubscriptionPlanDoc = InferSchemaType<typeof subscriptionPlanSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
};

export default mongoose.model<SubscriptionPlanDoc>('SubscriptionPlan', subscriptionPlanSchema);
