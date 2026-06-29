import { Router } from 'express';
import {
  createRoom,
  listRooms,
  getRoom,
  getMessages,
  inviteUser,
  acceptInvitation,
  rejectInvitation,
  leaveRoom,
  listInvitations,
} from '../controllers/chat.controller';
import { requireAuth, requireActiveUser } from '../middlewares/auth.middleware';

const router = Router();

router.use(requireAuth, requireActiveUser);

router.post('/', createRoom);
router.get('/', listRooms);
router.get('/invitations', listInvitations);
router.get('/:id', getRoom);
router.get('/:id/messages', getMessages);
router.post('/:id/invite', inviteUser);
router.patch('/:id/leave', leaveRoom);
router.patch('/invitations/:invitationId/accept', acceptInvitation);
router.patch('/invitations/:invitationId/reject', rejectInvitation);

export default router;
