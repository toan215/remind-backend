import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import {
  getExpertDashboard,
  getExpertSettings,
  updateExpertSettings,
  createExpertSlots,
  listOwnSlots,
  listAvailableSlots,
  deleteExpertSlot,
  listPublicExperts,
} from '../controllers/expert.controller';

const router = Router();

// Public endpoints (no auth)
router.get('/', listPublicExperts);
router.get('/:id/availability', listAvailableSlots);

// Tất cả các route phía dưới yêu cầu đăng nhập và có vai trò 'expert'
router.use(requireAuth, requireRole('expert'));

router.get('/me/dashboard', getExpertDashboard);
router.get('/me/settings', getExpertSettings);
router.put('/me/settings', updateExpertSettings);

router.post('/:id/slots', createExpertSlots);
router.get('/:id/slots', listOwnSlots);
router.delete('/slots/:slotId', deleteExpertSlot);

export default router;
