import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const forumGroupMessageSchema = new Schema(
  {
    groupId: { type: Schema.Types.ObjectId, ref: 'ForumGroup', required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    senderRole: { type: String, required: true },
    senderDisplayName: { type: String, trim: true },
    content: { type: String, required: true, trim: true },
    status: { type: String, enum: ['active', 'hidden', 'deleted'], default: 'active' },
  },
  { timestamps: true }
);

forumGroupMessageSchema.index({ groupId: 1, createdAt: 1 });

export type ForumGroupMessageDoc = InferSchemaType<typeof forumGroupMessageSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
};

export default mongoose.model<ForumGroupMessageDoc>('ForumGroupMessage', forumGroupMessageSchema);
