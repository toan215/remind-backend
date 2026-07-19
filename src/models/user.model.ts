import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const expertSchema = new Schema(
  {
    profile: {
      professionalTitle: { type: String },
      bio: { type: String },
      specialties: { type: [String] },
      languages: { type: [String] },
      yearsOfExperience: { type: Number, default: 0 },
    },
    license: {
      licenseNumber: { type: String },
      issuedBy: { type: String },
      verificationStatus: { type: String },
    },
    // ponytail: credential files stored in GridFS; array so experts can attach more over time
    credentials: [
      {
        fileId: { type: Schema.Types.ObjectId },
        fileName: { type: String },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    approval: {
      reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      reviewedAt: { type: Date },
      rejectionReason: { type: String },
    },
    performanceStats: {
      completedSessionCount: { type: Number, default: 0 },
      averageRating: { type: Number, default: 0 },
      reviewCount: { type: Number, default: 0 },
    },
  },
  { _id: false }
);

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, select: false },
    refreshToken: { type: String, select: false },
    fullName: { type: String, trim: true },
    googleId: { type: String, sparse: true, unique: true },
    role: { type: String, enum: ['student', 'expert', 'admin', 'system_manager'], required: true },
    status: { type: String, enum: ['active', 'pending', 'rejected', 'banned'], default: 'pending' },
    avatar: { type: String, default: "" },
    isAnonymous: { type: Boolean, default: false },
    // ponytail: gate for slot creation; flipped true only after admin verifies the credential file
    isValidatedExpert: { type: Boolean, default: false },
    expert: { type: expertSchema, default: undefined },
  },
  { timestamps: true }
);

userSchema.index({ role: 1, status: 1 });

export type UserDoc = InferSchemaType<typeof userSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
};

export default mongoose.model<UserDoc>('User', userSchema);
