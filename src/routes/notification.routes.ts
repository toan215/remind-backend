import { Router } from 'express';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
} from '../controllers/notification.controller';
import { requireAuth } from '../middlewares/auth.middleware'; // Wait, let's check the exact name of the auth middleware.

const router = Router();

router.use(requireAuth);

router.get('/', getNotifications);
router.put('/read-all', markAllAsRead);
router.put('/:id/read', markAsRead);

export default router;
