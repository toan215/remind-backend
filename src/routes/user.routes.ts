import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middlewares/auth.middleware';
import { getProfile, updateProfile, changePassword, uploadAvatar, createReport } from '../controllers/user.controller';

const router = Router();

// Cấu hình multer lưu file tạm thời vào Memory để truyền trực tiếp buffer sang Cloudinary
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // Giới hạn kích thước file 5MB
  },
});

router.get('/profile', requireAuth, getProfile);
router.put('/profile', requireAuth, updateProfile);
router.put('/change-password', requireAuth, changePassword);
router.put('/avatar', requireAuth, upload.single('avatar'), uploadAvatar);
router.post('/reports', requireAuth, createReport);

export default router;
