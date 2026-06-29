import type { Socket } from 'socket.io';
import mongoose from 'mongoose';
import ChatRoom from '../../models/chatRoom.model';
import ChatMessage from '../../models/chatMessage.model';
import type { SocketAuthData, ClientToServerEvents, ServerToClientEvents } from '../../types/chat.types';

type ChatSocket = Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketAuthData>;

export const registerChatHandlers = (socket: ChatSocket): void => {
  socket.on('chat:join', async ({ roomId }) => {
    if (!mongoose.Types.ObjectId.isValid(roomId)) {
      socket.emit('chat:error', { code: 'INVALID_ROOM', message: 'Invalid room ID' });
      return;
    }

    try {
      const room = await ChatRoom.findOne({
        _id: new mongoose.Types.ObjectId(roomId),
        'participants.userId': new mongoose.Types.ObjectId(socket.data.userId),
        'participants.status': 'active',
      }).lean();

      if (!room) {
        socket.emit('chat:error', { code: 'NOT_MEMBER', message: 'You are not a participant of this room' });
        return;
      }

      socket.join(`chat:${roomId}`);
    } catch (err) {
      socket.emit('chat:error', { code: 'SERVER_ERROR', message: 'Failed to join room' });
    }
  });

  socket.on('chat:leave', ({ roomId }) => {
    socket.leave(`chat:${roomId}`);
  });

  socket.on('chat:message', async ({ roomId, text, type }) => {
    if (!mongoose.Types.ObjectId.isValid(roomId)) {
      socket.emit('chat:error', { code: 'INVALID_ROOM', message: 'Invalid room ID' });
      return;
    }
    if (!text || typeof text !== 'string' || !text.trim()) {
      socket.emit('chat:error', { code: 'EMPTY_MESSAGE', message: 'Message cannot be empty' });
      return;
    }

    try {
      const room = await ChatRoom.findOne({
        _id: new mongoose.Types.ObjectId(roomId),
        'participants.userId': new mongoose.Types.ObjectId(socket.data.userId),
        'participants.status': 'active',
      }).lean();

      if (!room) {
        socket.emit('chat:error', { code: 'NOT_MEMBER', message: 'You are not a participant' });
        return;
      }

      const msg = await ChatMessage.create({
        chatRoomId: new mongoose.Types.ObjectId(roomId),
        senderId: new mongoose.Types.ObjectId(socket.data.userId),
        senderRole: socket.data.role,
        messageType: type || 'text',
        text: text.trim(),
        readBy: [new mongoose.Types.ObjectId(socket.data.userId)],
      });

      await ChatRoom.updateOne(
        { _id: new mongoose.Types.ObjectId(roomId) },
        {
          lastMessage: {
            text: text.trim().slice(0, 100),
            senderId: new mongoose.Types.ObjectId(socket.data.userId),
            sentAt: new Date(),
          },
        }
      );

      const populated = await ChatMessage.findById(msg._id).lean();
      socket.to(`chat:${roomId}`).emit('chat:message', populated);
      socket.emit('chat:message', populated);
    } catch (err) {
      socket.emit('chat:error', { code: 'SERVER_ERROR', message: 'Failed to send message' });
    }
  });

  socket.on('chat:typing', ({ roomId, isTyping }) => {
    socket.to(`chat:${roomId}`).emit('chat:typing', {
      roomId,
      userId: socket.data.userId,
      isTyping,
    });
  });

  socket.on('chat:read', async ({ roomId, messageIds }) => {
    if (!mongoose.Types.ObjectId.isValid(roomId)) return;

    try {
      const ids = messageIds
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .map((id) => new mongoose.Types.ObjectId(id));

      if (ids.length === 0) return;

      await ChatMessage.updateMany(
        { _id: { $in: ids }, chatRoomId: new mongoose.Types.ObjectId(roomId) },
        { $addToSet: { readBy: new mongoose.Types.ObjectId(socket.data.userId) } }
      );

      socket.to(`chat:${roomId}`).emit('chat:read', {
        roomId,
        userId: socket.data.userId,
        messageIds,
      });
    } catch {
      // silent fail for read receipts
    }
  });
};
