import express from 'express';
import request from 'supertest';
import mongoose from 'mongoose';
import type { Express } from 'express';
import chatRoutes from '../routes/chat.routes';
import ChatRoom from '../models/chatRoom.model';
import ChatMessage from '../models/chatMessage.model';
import ChatInvitation from '../models/chatInvitation.model';
import User from '../models/user.model';
import { signToken } from './helpers';

const buildApp = (): Express => {
  const app = express();
  app.use(express.json());
  app.use('/api/chats', chatRoutes);
  return app;
};

describe('Chat API security & behavior', () => {
  const app = buildApp();

  describe('Authentication & authorization', () => {
    it('returns 401 without token for POST /api/chats', async () => {
      const res = await request(app).post('/api/chats').send({ type: 'group' });

      expect(res.status).toBe(401);
    });

    it('returns 401 without token for GET /api/chats', async () => {
      const res = await request(app).get('/api/chats');

      expect(res.status).toBe(401);
    });

    it('returns 401 without token for GET /api/chats/:id', async () => {
      const res = await request(app).get(`/api/chats/${new mongoose.Types.ObjectId().toString()}`);

      expect(res.status).toBe(401);
    });

    it('returns 403 for a pending user trying to create a room', async () => {
      const token = signToken(new mongoose.Types.ObjectId().toString(), 'expert', 'pending');

      const res = await request(app)
        .post('/api/chats')
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'group' });

      expect(res.status).toBe(403);
    });
  });

  describe('Room creation', () => {
    it('creates a direct chat with valid appointmentId and participantId', async () => {
      const creator = await User.create({ email: 'creator@test.com', role: 'student', status: 'active', fullName: 'Creator' });
      const token = signToken(creator._id.toString(), 'student', 'active', 'Creator');
      const participant = await User.create({ email: 'participant@test.com', role: 'expert', status: 'active', fullName: 'Participant' });
      const participantId = participant._id.toString();
      const appointmentId = new mongoose.Types.ObjectId().toString();

      const res = await request(app)
        .post('/api/chats')
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'direct', participantId, appointmentId });

      expect(res.status).toBe(201);
      expect(res.body.room.type).toBe('direct');
      expect(res.body.room.appointmentId).toBe(appointmentId);
      expect(res.body.room.participants).toHaveLength(2);
    });

    it('returns existing direct chat if one exists for the same appointmentId', async () => {
      const creator = await User.create({ email: 'creator2@test.com', role: 'student', status: 'active', fullName: 'Creator Two' });
      const token = signToken(creator._id.toString(), 'student', 'active', 'Creator Two');
      const appointmentId = new mongoose.Types.ObjectId();

      const first = await ChatRoom.create({
        type: 'direct',
        appointmentId,
        createdBy: creator._id,
        participants: [
          { userId: creator._id, role: 'student', status: 'active', joinedAt: new Date() },
          { userId: new mongoose.Types.ObjectId(), role: 'expert', status: 'active', joinedAt: new Date() },
        ],
      });

      const res = await request(app)
        .post('/api/chats')
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'direct', participantId: new mongoose.Types.ObjectId().toString(), appointmentId: appointmentId.toString() });

      expect(res.status).toBe(200);
      expect(res.body.room._id).toBe(first._id.toString());
    });

    it('rejects direct chat without appointmentId', async () => {
      const creator = await User.create({ email: 'creator3@test.com', role: 'student', status: 'active' });
      const token = signToken(creator._id.toString(), 'student');

      const res = await request(app)
        .post('/api/chats')
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'direct', participantId: new mongoose.Types.ObjectId().toString() });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('appointmentId');
    });

    it('rejects direct chat without participantId', async () => {
      const creator = await User.create({ email: 'creator4@test.com', role: 'student', status: 'active' });
      const token = signToken(creator._id.toString(), 'student');

      const res = await request(app)
        .post('/api/chats')
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'direct', appointmentId: new mongoose.Types.ObjectId().toString() });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('participantId');
    });

    it('creates a group chat', async () => {
      const creator = await User.create({ email: 'group@test.com', role: 'student', status: 'active', fullName: 'Group Creator' });
      const token = signToken(creator._id.toString(), 'student', 'active', 'Group Creator');

      const res = await request(app)
        .post('/api/chats')
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'group' });

      expect(res.status).toBe(201);
      expect(res.body.room.type).toBe('group');
      expect(res.body.room.participants).toHaveLength(1);
    });
  });

  describe('Room listing', () => {
    it('lists rooms where the user is an active participant', async () => {
      const user = await User.create({ email: 'list@test.com', role: 'student', status: 'active' });
      const token = signToken(user._id.toString(), 'student');

      const room = await ChatRoom.create({
        type: 'group',
        createdBy: user._id,
        participants: [{ userId: user._id, role: 'student', status: 'active', joinedAt: new Date() }],
      });

      const res = await request(app).get('/api/chats').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.rooms).toHaveLength(1);
      expect(res.body.rooms[0]._id).toBe(room._id.toString());
    });

    it('does not list rooms where the user is removed', async () => {
      const user = await User.create({ email: 'removed@test.com', role: 'student', status: 'active' });
      const token = signToken(user._id.toString(), 'student');

      const room = await ChatRoom.create({
        type: 'group',
        createdBy: user._id,
        participants: [{ userId: user._id, role: 'student', status: 'active', joinedAt: new Date() }],
      });

      await request(app).patch(`/api/chats/${room._id.toString()}/leave`).set('Authorization', `Bearer ${token}`);

      const res = await request(app).get('/api/chats').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.rooms).toHaveLength(0);
    });
  });

  describe('Room detail', () => {
    it('returns room detail for a participant', async () => {
      const user = await User.create({ email: 'detail@test.com', role: 'student', status: 'active' });
      const token = signToken(user._id.toString(), 'student');

      const room = await ChatRoom.create({
        type: 'group',
        createdBy: user._id,
        participants: [{ userId: user._id, role: 'student', status: 'active', joinedAt: new Date() }],
      });

      const res = await request(app).get(`/api/chats/${room._id.toString()}`).set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.room._id).toBe(room._id.toString());
    });

    it('returns 404 for a non-participant', async () => {
      const participant = await User.create({ email: 'room-owner@test.com', role: 'student', status: 'active' });
      const outsider = await User.create({ email: 'outsider@test.com', role: 'student', status: 'active' });
      const token = signToken(outsider._id.toString(), 'student');

      const room = await ChatRoom.create({
        type: 'group',
        createdBy: participant._id,
        participants: [{ userId: participant._id, role: 'student', status: 'active', joinedAt: new Date() }],
      });

      const res = await request(app).get(`/api/chats/${room._id.toString()}`).set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  describe('Messages', () => {
    it('returns an empty list for a room with no messages', async () => {
      const user = await User.create({ email: 'nomsg@test.com', role: 'student', status: 'active' });
      const token = signToken(user._id.toString(), 'student');

      const room = await ChatRoom.create({
        type: 'group',
        createdBy: user._id,
        participants: [{ userId: user._id, role: 'student', status: 'active', joinedAt: new Date() }],
      });

      const res = await request(app).get(`/api/chats/${room._id.toString()}/messages`).set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.messages).toHaveLength(0);
      expect(res.body.nextCursor).toBeNull();
      expect(res.body.hasNext).toBe(false);
    });

    it('supports cursor pagination', async () => {
      const user = await User.create({ email: 'paginate@test.com', role: 'student', status: 'active' });
      const token = signToken(user._id.toString(), 'student');

      const room = await ChatRoom.create({
        type: 'group',
        createdBy: user._id,
        participants: [{ userId: user._id, role: 'student', status: 'active', joinedAt: new Date() }],
      });

      const msg1 = await ChatMessage.create({ chatRoomId: room._id, senderId: user._id, senderRole: 'student', messageType: 'text', text: 'one' });
      const msg2 = await ChatMessage.create({ chatRoomId: room._id, senderId: user._id, senderRole: 'student', messageType: 'text', text: 'two' });
      await ChatMessage.create({ chatRoomId: room._id, senderId: user._id, senderRole: 'student', messageType: 'text', text: 'three' });

      const firstPage = await request(app)
        .get(`/api/chats/${room._id.toString()}/messages`)
        .query({ limit: 2 })
        .set('Authorization', `Bearer ${token}`);

      expect(firstPage.status).toBe(200);
      expect(firstPage.body.messages).toHaveLength(2);
      expect(firstPage.body.hasNext).toBe(true);
      expect(firstPage.body.nextCursor).toBeDefined();
      expect(firstPage.body.messages[0].text).toBe('three');
      expect(firstPage.body.messages[1].text).toBe('two');

      const secondPage = await request(app)
        .get(`/api/chats/${room._id.toString()}/messages`)
        .query({ limit: 2, cursor: firstPage.body.nextCursor })
        .set('Authorization', `Bearer ${token}`);

      expect(secondPage.status).toBe(200);
      expect(secondPage.body.messages).toHaveLength(1);
      expect(secondPage.body.messages[0].text).toBe('one');
      expect(secondPage.body.hasNext).toBe(false);
      expect(secondPage.body.nextCursor).toBe(msg1._id.toString());
      expect(msg2._id).toBeDefined();
    });
  });

  describe('Invitation flow', () => {
    it('invites a user to a group chat and lists pending invitations', async () => {
      const creator = await User.create({ email: 'invite-creator@test.com', role: 'student', status: 'active', fullName: 'Invite Creator' });
      const invited = await User.create({ email: 'invited@test.com', role: 'expert', status: 'active', fullName: 'Invited Expert' });
      const token = signToken(creator._id.toString(), 'student', 'active', 'Invite Creator');
      const invitedToken = signToken(invited._id.toString(), 'expert', 'active', 'Invited Expert');

      const room = await ChatRoom.create({
        type: 'group',
        createdBy: creator._id,
        participants: [{ userId: creator._id, role: 'student', status: 'active', joinedAt: new Date() }],
      });

      const inviteRes = await request(app)
        .post(`/api/chats/${room._id.toString()}/invite`)
        .set('Authorization', `Bearer ${token}`)
        .send({ invitedUserId: invited._id.toString() });

      expect(inviteRes.status).toBe(201);
      expect(inviteRes.body.invitation.invitedUserId).toBe(invited._id.toString());

      const listRes = await request(app).get('/api/chats/invitations').set('Authorization', `Bearer ${invitedToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.invitations).toHaveLength(1);
      expect(listRes.body.invitations[0]._id).toBe(inviteRes.body.invitation._id);
    });

    it('accepts an invitation and adds the user to room participants', async () => {
      const creator = await User.create({ email: 'accept-creator@test.com', role: 'student', status: 'active' });
      const invited = await User.create({ email: 'accept-user@test.com', role: 'expert', status: 'active', fullName: 'Accept User' });
      const creatorToken = signToken(creator._id.toString(), 'student');
      const invitedToken = signToken(invited._id.toString(), 'expert', 'active', 'Accept User');

      const room = await ChatRoom.create({
        type: 'group',
        createdBy: creator._id,
        participants: [{ userId: creator._id, role: 'student', status: 'active', joinedAt: new Date() }],
      });

      const invitation = await ChatInvitation.create({
        chatRoomId: room._id,
        invitedUserId: invited._id,
        invitedBy: creator._id,
        invitedByRole: 'student',
        status: 'pending',
      });

      const res = await request(app)
        .patch(`/api/chats/invitations/${invitation._id.toString()}/accept`)
        .set('Authorization', `Bearer ${invitedToken}`);

      expect(res.status).toBe(200);
      expect(res.body.invitation.status).toBe('accepted');

      const updatedRoom = await ChatRoom.findById(room._id);
      expect(updatedRoom).not.toBeNull();
      expect(updatedRoom!.participants.some((p) => p.userId.toString() === invited._id.toString() && p.status === 'active')).toBe(true);

      const messages = await ChatMessage.find({ chatRoomId: room._id });
      expect(messages.some((m) => m.messageType === 'system')).toBe(true);

      const creatorRes = await request(app).get('/api/chats').set('Authorization', `Bearer ${creatorToken}`);
      expect(creatorRes.status).toBe(200);
    });

    it('rejects an invitation and marks it rejected', async () => {
      const creator = await User.create({ email: 'reject-creator@test.com', role: 'student', status: 'active' });
      const invited = await User.create({ email: 'reject-user@test.com', role: 'expert', status: 'active' });
      const invitedToken = signToken(invited._id.toString(), 'expert');

      const room = await ChatRoom.create({
        type: 'group',
        createdBy: creator._id,
        participants: [{ userId: creator._id, role: 'student', status: 'active', joinedAt: new Date() }],
      });

      const invitation = await ChatInvitation.create({
        chatRoomId: room._id,
        invitedUserId: invited._id,
        invitedBy: creator._id,
        invitedByRole: 'student',
        status: 'pending',
      });

      const res = await request(app)
        .patch(`/api/chats/invitations/${invitation._id.toString()}/reject`)
        .set('Authorization', `Bearer ${invitedToken}`);

      expect(res.status).toBe(200);
      expect(res.body.invitation.status).toBe('rejected');

      const updated = await ChatInvitation.findById(invitation._id);
      expect(updated?.status).toBe('rejected');
      expect(updated?.respondedAt).toBeInstanceOf(Date);
    });

    it('returns 400 when inviting a user who is already in the room again', async () => {
      const creator = await User.create({ email: 'dup-creator@test.com', role: 'student', status: 'active' });
      const invited = await User.create({ email: 'dup-user@test.com', role: 'expert', status: 'active' });
      const token = signToken(creator._id.toString(), 'student');
      const invitedToken = signToken(invited._id.toString(), 'expert');

      const room = await ChatRoom.create({
        type: 'group',
        createdBy: creator._id,
        participants: [{ userId: creator._id, role: 'student', status: 'active', joinedAt: new Date() }],
      });

      const invitation = await ChatInvitation.create({
        chatRoomId: room._id,
        invitedUserId: invited._id,
        invitedBy: creator._id,
        invitedByRole: 'student',
        status: 'pending',
      });

      const acceptRes = await request(app)
        .patch(`/api/chats/invitations/${invitation._id.toString()}/accept`)
        .set('Authorization', `Bearer ${invitedToken}`);

      expect(acceptRes.status).toBe(200);

      const res = await request(app)
        .post(`/api/chats/${room._id.toString()}/invite`)
        .set('Authorization', `Bearer ${token}`)
        .send({ invitedUserId: invited._id.toString() });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('already a participant');
    });

    it('returns 400 when inviting to a direct chat', async () => {
      const creator = await User.create({ email: 'direct-invite@test.com', role: 'student', status: 'active' });
      const invited = await User.create({ email: 'direct-target@test.com', role: 'expert', status: 'active' });
      const token = signToken(creator._id.toString(), 'student');

      const room = await ChatRoom.create({
        type: 'direct',
        appointmentId: new mongoose.Types.ObjectId(),
        createdBy: creator._id,
        participants: [
          { userId: creator._id, role: 'student', status: 'active', joinedAt: new Date() },
          { userId: invited._id, role: 'expert', status: 'active', joinedAt: new Date() },
        ],
      });

      const res = await request(app)
        .post(`/api/chats/${room._id.toString()}/invite`)
        .set('Authorization', `Bearer ${token}`)
        .send({ invitedUserId: invited._id.toString() });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('group chats');
    });
  });

  describe('Leave room', () => {
    it('removes the user from participants', async () => {
      const user = await User.create({ email: 'leave@test.com', role: 'student', status: 'active' });
      const token = signToken(user._id.toString(), 'student');

      const room = await ChatRoom.create({
        type: 'group',
        createdBy: user._id,
        participants: [{ userId: user._id, role: 'student', status: 'active', joinedAt: new Date() }],
      });

      const res = await request(app).patch(`/api/chats/${room._id.toString()}/leave`).set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const updated = await ChatRoom.findById(room._id);
      expect(updated).not.toBeNull();
      expect(updated!.participants[0].status).toBe('removed');
    });

    it('returns 403 if not a participant', async () => {
      const owner = await User.create({ email: 'owner@test.com', role: 'student', status: 'active' });
      const outsider = await User.create({ email: 'not-participant@test.com', role: 'student', status: 'active' });
      const token = signToken(outsider._id.toString(), 'student');

      const room = await ChatRoom.create({
        type: 'group',
        createdBy: owner._id,
        participants: [{ userId: owner._id, role: 'student', status: 'active', joinedAt: new Date() }],
      });

      const res = await request(app).patch(`/api/chats/${room._id.toString()}/leave`).set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });
  });
});
