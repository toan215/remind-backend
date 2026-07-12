import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const forumCommentSchema = new Schema(
  {
    postId: { type: Schema.Types.ObjectId, ref: 'ForumPost', required: true, index: true },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    authorDisplayMode: { type: Number, enum: [0, 1], required: true },
    publicAuthorName: { type: String, required: true, trim: true },
    content: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['active', 'hidden', 'deleted', 'under_review'],
      default: 'active',
      index: true,
    },
    likeCount: { type: Number, default: 0 },
    likedBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    parentId: { type: Schema.Types.ObjectId, ref: 'ForumComment', default: null },
  },
  { timestamps: true }
);

forumCommentSchema.index({ postId: 1, status: 1 });

export type ForumCommentDoc = InferSchemaType<typeof forumCommentSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
};

export default mongoose.model<ForumCommentDoc>('ForumComment', forumCommentSchema);
