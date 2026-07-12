import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import { getExpertDashboard, getExpertSettings, updateExpertSettings } from '../controllers/expert.controller';

const router = Router();

// Tất cả các route trong file này yêu cầu đăng nhập và có vai trò 'expert'
router.use(requireAuth, requireRole('expert'));

router.get('/me/dashboard', getExpertDashboard);
router.get('/me/settings', getExpertSettings);
router.put('/me/settings', updateExpertSettings);

export default router;