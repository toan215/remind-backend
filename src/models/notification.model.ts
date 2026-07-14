import mongoose, { Schema, Document } from 'mongoose';

export enum NotificationType {
  LIKE_POST = 'LIKE_POST',
  COMMENT_POST = 'COMMENT_POST',
  REPLY_COMMENT = 'REPLY_COMMENT',
  POST_APPROVED = 'POST_APPROVED',
  SYSTEM = 'SYSTEM',
}

export interface INotification extends Document {
  recipient: mongoose.Types.ObjectId;
  sender?: mongoose.Types.ObjectId;
  type: NotificationType;
  content?: string;
  referenceId?: mongoose.Types.ObjectId;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema: Schema = new Schema(
  {
    recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    sender: { type: Schema.Types.ObjectId, ref: 'User' },
    type: { type: String, enum: Object.values(NotificationType), required: true },
    content: { type: String },
    referenceId: { type: Schema.Types.ObjectId }, // Can ref to Post, Comment, etc. based on type
    isRead: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<INotification>('Notification', NotificationSchema);
