import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const chatMessageSchema = new Schema(
  {
    chatRoomId: { type: Schema.Types.ObjectId, ref: 'ChatRoom', required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    senderRole: { type: String, required: true },
    messageType: { type: String, enum: ['text', 'image', 'file', 'system'], default: 'text' },
    text: { type: String, trim: true },
    fileId: { type: Schema.Types.ObjectId, ref: 'File' },
    status: { type: String, enum: ['active', 'hidden', 'deleted'], default: 'active' },
    readBy: { type: [Schema.Types.ObjectId], ref: 'User', default: [] },
  },
  { timestamps: true }
);

chatMessageSchema.index({ chatRoomId: 1, createdAt: -1 });

export type ChatMessageDoc = InferSchemaType<typeof chatMessageSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
};

export default mongoose.model<ChatMessageDoc>('ChatMessage', chatMessageSchema);
