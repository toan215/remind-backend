import { Router } from 'express';
import { requireAuth, requireActiveUser, requireRole } from '../middlewares/auth.middleware';
import {
  bookAppointment,
  listMyAppointments,
  listExpertAppointments,
  cancelAppointment,
  startSession,
  endSession,
} from '../controllers/appointment.controller';

const router = Router();

router.post('/book', requireAuth, requireActiveUser, requireRole('student'), bookAppointment);
router.get('/mine', requireAuth, requireRole('student'), listMyAppointments);
router.get('/expert', requireAuth, requireRole('expert'), listExpertAppointments);
router.post('/:id/cancel', requireAuth, cancelAppointment);
router.post('/:id/start', requireAuth, requireRole('expert'), startSession);
router.post('/:id/end', requireAuth, requireRole('expert'), endSession);

export default router;
