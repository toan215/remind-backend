import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const forumGroupMemberSchema = new Schema(
  {
    groupId: { type: Schema.Types.ObjectId, ref: 'ForumGroup', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['member', 'moderator'], default: 'member' },
    lastReadAt: { type: Date },
    joinedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

forumGroupMemberSchema.index({ groupId: 1, userId: 1 }, { unique: true });

export type ForumGroupMemberDoc = InferSchemaType<typeof forumGroupMemberSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
};

export default mongoose.model<ForumGroupMemberDoc>('ForumGroupMember', forumGroupMemberSchema);
