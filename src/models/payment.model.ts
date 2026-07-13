import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const paymentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    kind: { type: String, enum: ['credit_package', 'subscription_plan', 'appointment'], required: true },
    productId: { type: Schema.Types.ObjectId },
    appointmentId: { type: Schema.Types.ObjectId, ref: 'Appointment' },
    productSnapshot: { type: Schema.Types.Mixed },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'VND' },
    status: {
      type: String,
      enum: ['pending', 'succeeded', 'failed', 'cancelled'],
      default: 'pending',
    },
    orderCode: { type: Number, required: true, unique: true },
    provider: { type: String, default: 'payos' },
    providerPaymentLinkId: { type: String },
    checkoutUrl: { type: String },
    qrCode: { type: String },
    paidAt: { type: Date },
    expiresAt: { type: Date },
  },
  { timestamps: true }
);

paymentSchema.index({ userId: 1, createdAt: -1 });

paymentSchema.index({ status: 1 });

export type PaymentDoc = InferSchemaType<typeof paymentSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
};

export default mongoose.model<PaymentDoc>('Payment', paymentSchema);
