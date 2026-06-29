import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const forumGroupSchema = new Schema(
  {
    forumId: { type: Schema.Types.ObjectId, ref: 'Forum', required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['active', 'closed', 'archived'], default: 'active' },
    isPublic: { type: Boolean, default: false },
    maxParticipants: { type: Number, default: 50 },
    participantCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export type ForumGroupDoc = InferSchemaType<typeof forumGroupSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
};

export default mongoose.model<ForumGroupDoc>('ForumGroup', forumGroupSchema);
