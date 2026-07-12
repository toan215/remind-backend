import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const otpSchema = new Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    otp: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// Tự động xóa tài liệu sau khi expiresAt đạt đến thời điểm hiện tại
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
otpSchema.index({ email: 1 });

export type OtpDoc = InferSchemaType<typeof otpSchema> & {
  _id: mongoose.Types.ObjectId;
};

export default mongoose.model<OtpDoc>('Otp', otpSchema);
