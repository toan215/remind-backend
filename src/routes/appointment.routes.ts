import { Router } from 'express';
import { requireAuth, requireActiveUser, requireRole } from '../middlewares/auth.middleware';
import {
  bookAppointment,
  listMyAppointments,
  listExpertAppointments,
  cancelAppointment,
} from '../controllers/appointment.controller';

const router = Router();

router.post('/book', requireAuth, requireActiveUser, requireRole('student'), bookAppointment);
router.get('/mine', requireAuth, requireRole('student'), listMyAppointments);
router.get('/expert', requireAuth, requireRole('expert'), listExpertAppointments);
router.post('/:id/cancel', requireAuth, cancelAppointment);

export default router;
