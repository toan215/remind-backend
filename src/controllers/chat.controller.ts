import { type RequestHandler } from 'express';
import mongoose from 'mongoose';
import type { Server as SocketIOServer } from 'socket.io';
import User from '../models/user.model';
import ChatRoom from '../models/chatRoom.model';
import ChatMessage from '../models/chatMessage.model';
import ChatInvitation from '../models/chatInvitation.model';
import Log from '../models/log.model';
import { logDB } from '../utils/log';

interface RoomParams {
  id: string;
}

interface InvitationParams {
  invitationId: string;
}

const isValidObjectId = (id: string | undefined): boolean => {
  if (!id) return false;
  return mongoose.Types.ObjectId.isValid(id);
};

interface CreateRoomBody {
  type?: string;
  participantId?: string;
  appointmentId?: string;
}

export const createRoom: RequestHandler = async (req, res) => {
  const userId = req.user?.id;
  if (!isValidObjectId(userId)) return res.status(401).json({ error: 'Invalid token' });

  const { type, participantId, appointmentId } = (req.body || {}) as CreateRoomBody;
  if (type !== 'direct' && type !== 'group') {
    return res.status(400).json({ error: 'Type must be "direct" or "group"' });
  }

  try {
    if (type === 'direct') {
      if (!isValidObjectId(participantId)) {
        return res.status(400).json({ error: 'participantId is required for direct chat' });
      }
      if (participantId === userId) {
        return res.status(400).json({ error: 'Cannot create chat with yourself' });
      }

      if (!appointmentId || !isValidObjectId(appointmentId)) {
        return res.status(400).json({ error: 'appointmentId is required for direct chat' });
      }

      const existing = await ChatRoom.findOne({
        type: 'direct',
        appointmentId: new mongoose.Types.ObjectId(appointmentId),
        status: 'active',
      }).lean();

      if (existing) {
        return res.status(200).json({ room: existing });
      }

      const participantUser = await User.findById(participantId).select('role').lean();
      if (!participantUser) {
        return res.status(400).json({ error: 'Participant user not found' });
      }

      const room = await ChatRoom.create({
        type: 'direct',
        appointmentId: new mongoose.Types.ObjectId(appointmentId),
        createdBy: new mongoose.Types.ObjectId(userId),
        participants: [
          { userId: new mongoose.Types.ObjectId(userId), role: req.user!.role, status: 'active', joinedAt: new Date() },
          { userId: new mongoose.Types.ObjectId(participantId), role: participantUser.role, status: 'active', joinedAt: new Date() },
        ],
      });

      logDB.write('ChatRoom', 'create', room._id.toString(), { type: 'direct' });
      return res.status(201).json({ room });
    }

    const room = await ChatRoom.create({
      type: 'group',
      createdBy: new mongoose.Types.ObjectId(userId),
      participants: [
        { userId: new mongoose.Types.ObjectId(userId), role: req.user!.role, status: 'active', joinedAt: new Date() },
      ],
    });

    logDB.write('ChatRoom', 'create', room._id.toString(), { type: 'group' });
    return res.status(201).json({ room });
  } catch (err: any) {
    logDB.error('ChatRoom', 'create', err);
    console.error('createRoom error:', err);
    return res.status(500).json({ error: 'Failed to create chat room' });
  }
};

export const listRooms: RequestHandler = async (req, res) => {
  const userId = req.user?.id;
  if (!isValidObjectId(userId)) return res.status(401).json({ error: 'Invalid token' });

  try {
    const rooms = await ChatRoom.find({
      'participants.userId': new mongoose.Types.ObjectId(userId),
      'participants.status': 'active',
      status: 'active',
    })
      .sort({ updatedAt: -1 })
      .lean();

    logDB.read('ChatRoom', { userId }, rooms.length);
    return res.status(200).json({ rooms });
  } catch (err) {
    console.error('listRooms error:', err);
    return res.status(500).json({ error: 'Failed to list chat rooms' });
  }
};

export const getRoom: RequestHandler = async (req, res) => {
  const userId = req.user?.id;
  const { id } = req.params as unknown as RoomParams;
  if (!isValidObjectId(id)) return res.status(400).json({ error: 'Invalid room id' });

  try {
    const room = await ChatRoom.findOne({
      _id: id,
      'participants.userId': new mongoose.Types.ObjectId(userId),
    }).lean();

    if (!room) return res.status(404).json({ error: 'Room not found' });

    return res.status(200).json({ room });
  } catch (err) {
    console.error('getRoom error:', err);
    return res.status(500).json({ error: 'Failed to get room' });
  }
};

export const getMessages: RequestHandler = async (req, res) => {
  const userId = req.user?.id;
  const { id } = req.params as unknown as RoomParams;
  if (!isValidObjectId(id)) return res.status(400).json({ error: 'Invalid room id' });

  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const cursor = req.query.cursor as string;

  try {
    const room = await ChatRoom.findOne({
      _id: id,
      'participants.userId': new mongoose.Types.ObjectId(userId),
    }).lean();
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const query: any = { chatRoomId: new mongoose.Types.ObjectId(id) };
    if (cursor && mongoose.Types.ObjectId.isValid(cursor)) {
      query._id = { $lt: new mongoose.Types.ObjectId(cursor) };
    }

    const messages = await ChatMessage.find(query)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean();

    const hasNext = messages.length > limit;
    const items = hasNext ? messages.slice(0, limit) : messages;
    const nextCursor = items.length > 0 ? items[items.length - 1]._id : null;

    logDB.read('ChatMessage', { chatRoomId: id }, items.length);
    return res.status(200).json({ messages: items, nextCursor, hasNext });
  } catch (err) {
    console.error('getMessages error:', err);
    return res.status(500).json({ error: 'Failed to get messages' });
  }
};

export const inviteUser: RequestHandler = async (req, res) => {
  const userId = req.user?.id;
  const { id } = req.params as unknown as RoomParams;
  const { invitedUserId } = req.body;

  if (!isValidObjectId(id)) return res.status(400).json({ error: 'Invalid room id' });
  if (!isValidObjectId(invitedUserId)) return res.status(400).json({ error: 'Invalid invited user id' });

  try {
    const room = await ChatRoom.findById(id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.type !== 'group') return res.status(400).json({ error: 'Can only invite to group chats' });

    const isMember = room.participants.some(
      (p) => p.userId.toString() === userId && p.status === 'active'
    );
    if (!isMember) return res.status(403).json({ error: 'You are not an active member of this room' });

    const alreadyInvited = room.participants.some(
      (p) => p.userId.toString() === invitedUserId && p.status === 'active'
    );
    if (alreadyInvited) return res.status(400).json({ error: 'User is already a participant' });

    const invitation = await ChatInvitation.create({
      chatRoomId: new mongoose.Types.ObjectId(id),
      invitedUserId: new mongoose.Types.ObjectId(invitedUserId),
      invitedBy: new mongoose.Types.ObjectId(userId),
      invitedByRole: req.user!.role,
      status: 'pending',
    });

    await Log.create({
      actorId: new mongoose.Types.ObjectId(userId),
      actorRole: req.user!.role,
      action: 'chat.invite',
      targetType: 'chatRoom',
      targetId: new mongoose.Types.ObjectId(id),
      metadata: { invitedUserId },
    }).catch(() => {});

    return res.status(201).json({ invitation });
  } catch (err) {
    console.error('inviteUser error:', err);
    return res.status(500).json({ error: 'Failed to invite user' });
  }
};

export const acceptInvitation: RequestHandler = async (req, res) => {
  const userId = req.user?.id;
  const { invitationId } = req.params as unknown as InvitationParams;
  if (!isValidObjectId(invitationId)) return res.status(400).json({ error: 'Invalid invitation id' });

  try {
    const invitation = await ChatInvitation.findById(invitationId);
    if (!invitation) return res.status(404).json({ error: 'Invitation not found' });
    if (invitation.invitedUserId.toString() !== userId) {
      return res.status(403).json({ error: 'This invitation is not for you' });
    }
    if (invitation.status !== 'pending') return res.status(400).json({ error: 'Invitation is not pending' });

    invitation.status = 'accepted';
    invitation.respondedAt = new Date();
    await invitation.save();

    await ChatRoom.updateOne(
      { _id: invitation.chatRoomId },
      {
        $push: {
          participants: {
            userId: new mongoose.Types.ObjectId(userId),
            role: req.user!.role,
            status: 'active',
            joinedAt: new Date(),
          },
        },
      }
    );

    const systemMsg = await ChatMessage.create({
      chatRoomId: invitation.chatRoomId,
      senderId: new mongoose.Types.ObjectId(userId),
      senderRole: 'system',
      messageType: 'system',
      text: `${req.user!.fullName || 'A user'} joined the chat`,
    });

    const chatIO: SocketIOServer | undefined = req.app.get('io');
    chatIO?.to(`chat:${invitation.chatRoomId.toString()}`).emit('chat:message', systemMsg.toObject());

    return res.status(200).json({ invitation, systemMessage: systemMsg });
  } catch (err) {
    console.error('acceptInvitation error:', err);
    return res.status(500).json({ error: 'Failed to accept invitation' });
  }
};

export const rejectInvitation: RequestHandler = async (req, res) => {
  const userId = req.user?.id;
  const { invitationId } = req.params as unknown as InvitationParams;
  if (!isValidObjectId(invitationId)) return res.status(400).json({ error: 'Invalid invitation id' });

  try {
    const invitation = await ChatInvitation.findById(invitationId);
    if (!invitation) return res.status(404).json({ error: 'Invitation not found' });
    if (invitation.invitedUserId.toString() !== userId) {
      return res.status(403).json({ error: 'This invitation is not for you' });
    }
    if (invitation.status !== 'pending') return res.status(400).json({ error: 'Invitation is not pending' });

    invitation.status = 'rejected';
    invitation.respondedAt = new Date();
    await invitation.save();

    return res.status(200).json({ invitation });
  } catch (err) {
    console.error('rejectInvitation error:', err);
    return res.status(500).json({ error: 'Failed to reject invitation' });
  }
};

export const leaveRoom: RequestHandler = async (req, res) => {
  const userId = req.user?.id;
  const { id } = req.params as unknown as RoomParams;
  if (!isValidObjectId(id)) return res.status(400).json({ error: 'Invalid room id' });

  try {
    const room = await ChatRoom.findById(id);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const idx = room.participants.findIndex((p) => p.userId.toString() === userId);
    if (idx === -1) return res.status(403).json({ error: 'You are not a participant' });

    room.participants[idx].status = 'removed';
    await room.save();

    return res.status(200).json({ message: 'Left the room' });
  } catch (err) {
    console.error('leaveRoom error:', err);
    return res.status(500).json({ error: 'Failed to leave room' });
  }
};

export const listInvitations: RequestHandler = async (req, res) => {
  const userId = req.user?.id;
  if (!isValidObjectId(userId)) return res.status(401).json({ error: 'Invalid token' });

  try {
    const invitations = await ChatInvitation.find({
      invitedUserId: new mongoose.Types.ObjectId(userId),
      status: 'pending',
    })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ invitations });
  } catch (err) {
    console.error('listInvitations error:', err);
    return res.status(500).json({ error: 'Failed to list invitations' });
  }
};
