import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const participantSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, required: true },
    status: { type: String, enum: ['active', 'removed'], default: 'active' },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const chatRoomSchema = new Schema(
  {
    type: { type: String, enum: ['direct', 'group'], required: true },
    appointmentId: { type: Schema.Types.ObjectId, ref: 'Appointment', default: undefined },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    participants: { type: [participantSchema], default: [] },
    status: { type: String, enum: ['active', 'closed', 'archived'], default: 'active' },
    lastMessage: {
      text: { type: String },
      senderId: { type: Schema.Types.ObjectId, ref: 'User' },
      sentAt: { type: Date },
    },
  },
  { timestamps: true }
);

chatRoomSchema.index({ 'participants.userId': 1, status: 1 });
chatRoomSchema.index({ type: 1, appointmentId: 1 });

export type ChatRoomDoc = InferSchemaType<typeof chatRoomSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
};

export default mongoose.model<ChatRoomDoc>('ChatRoom', chatRoomSchema);
