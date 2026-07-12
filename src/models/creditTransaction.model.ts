import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const creditTransactionSchema = new Schema(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: ['expert_session', 'free_expert_session', 'ai_chat_message'],
      required: true,
    },
    direction: {
      type: String,
      enum: ['add', 'lock', 'use', 'release', 'refund', 'adjust'],
      required: true,
    },
    quantity: { type: Number, required: true },
    source: {
      type: String,
      enum: ['subscription', 'purchase', 'organization', 'trial', 'volunteer', 'admin_adjustment'],
      required: true,
    },
    paymentId: { type: Schema.Types.ObjectId, ref: 'Payment' },
    note: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

creditTransactionSchema.index({ studentId: 1, createdAt: -1 });

export type CreditTransactionDoc = InferSchemaType<typeof creditTransactionSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt?: Date;
};

export default mongoose.model<CreditTransactionDoc>('CreditTransaction', creditTransactionSchema);
