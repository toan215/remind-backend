import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const studentCreditWalletSchema = new Schema(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    expertSessionCredits: { type: Number, default: 0 },
    freeExpertSessionCredits: { type: Number, default: 0 },
    aiChatMessageCredits: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

export type StudentCreditWalletDoc = InferSchemaType<typeof studentCreditWalletSchema> & {
  _id: mongoose.Types.ObjectId;
  updatedAt?: Date;
};

export default mongoose.model<StudentCreditWalletDoc>('StudentCreditWallet', studentCreditWalletSchema);
