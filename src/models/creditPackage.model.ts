import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const creditPackageSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ['expert_sessions', 'ai_chat_messages'], required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true },
    currency: { type: String, default: 'VND' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export type CreditPackageDoc = InferSchemaType<typeof creditPackageSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
};

export default mongoose.model<CreditPackageDoc>('CreditPackage', creditPackageSchema);
