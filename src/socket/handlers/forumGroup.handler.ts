import type { Socket } from 'socket.io';
import mongoose from 'mongoose';
import ForumGroupMessage from '../../models/forumGroupMessage.model';
import ForumGroupMember from '../../models/forumGroupMember.model';
import type { SocketAuthData, ClientToServerEvents, ServerToClientEvents } from '../../types/chat.types';

type GroupSocket = Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketAuthData>;

export const registerForumGroupHandlers = (socket: GroupSocket): void => {
  socket.on('group:join', async ({ groupId }) => {
    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      socket.emit('group:error', { code: 'INVALID_GROUP', message: 'Invalid group ID' });
      return;
    }

    try {
      const membership = await ForumGroupMember.findOne({
        groupId: new mongoose.Types.ObjectId(groupId),
        userId: new mongoose.Types.ObjectId(socket.data.userId),
      }).lean();

      if (!membership) {
        socket.emit('group:error', {
          code: 'NOT_MEMBER',
          message: 'You are not a member of this group',
        });
        return;
      }

      socket.join(`forum:${groupId}`);
    } catch (err) {
      socket.emit('group:error', { code: 'SERVER_ERROR', message: 'Failed to join group' });
    }
  });

  socket.on('group:leave', ({ groupId }) => {
    socket.leave(`forum:${groupId}`);
  });

  socket.on('group:message', async ({ groupId, content }) => {
    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      socket.emit('group:error', { code: 'INVALID_GROUP', message: 'Invalid group ID' });
      return;
    }
    if (!content || typeof content !== 'string' || !content.trim()) {
      socket.emit('group:error', { code: 'EMPTY_MESSAGE', message: 'Message cannot be empty' });
      return;
    }

    try {
      const membership = await ForumGroupMember.findOne({
        groupId: new mongoose.Types.ObjectId(groupId),
        userId: new mongoose.Types.ObjectId(socket.data.userId),
      }).lean();

      if (!membership) {
        socket.emit('group:error', { code: 'NOT_MEMBER', message: 'You are not a member' });
        return;
      }

      const msg = await ForumGroupMessage.create({
        groupId: new mongoose.Types.ObjectId(groupId),
        senderId: new mongoose.Types.ObjectId(socket.data.userId),
        senderRole: socket.data.role,
        senderDisplayName: socket.data.fullName || 'Anonymous',
        content: content.trim(),
      });

      const populated = await ForumGroupMessage.findById(msg._id).lean();
      socket.to(`forum:${groupId}`).emit('group:message', populated);
      socket.emit('group:message', populated);
    } catch (err) {
      socket.emit('group:error', { code: 'SERVER_ERROR', message: 'Failed to send message' });
    }
  });

  socket.on('group:typing', ({ groupId, isTyping }) => {
    socket.to(`forum:${groupId}`).emit('group:typing', {
      groupId,
      userId: socket.data.userId,
      isTyping,
    });
  });
};
