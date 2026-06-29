import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const chatInvitationSchema = new Schema(
  {
    chatRoomId: { type: Schema.Types.ObjectId, ref: 'ChatRoom', required: true },
    invitedUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    invitedRole: { type: String },
    invitedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    invitedByRole: { type: String },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'cancelled'],
      default: 'pending',
    },
    reason: { type: String, trim: true },
    respondedAt: { type: Date },
  },
  { timestamps: true }
);

chatInvitationSchema.index({ chatRoomId: 1, invitedUserId: 1 });
chatInvitationSchema.index({ invitedUserId: 1, status: 1 });

export type ChatInvitationDoc = InferSchemaType<typeof chatInvitationSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
};

export default mongoose.model<ChatInvitationDoc>('ChatInvitation', chatInvitationSchema);
