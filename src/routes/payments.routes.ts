import { Router } from 'express';
import { requireAuth, requireActiveUser } from '../middlewares/auth.middleware';
import {
  getProducts,
  createPayment,
  listMyPayments,
  getMyWallet,
  payOSWebhook,
} from '../controllers/payments.controller';

const router = Router();

// Public webhook (payOS calls this)
router.post('/payos/webhook', payOSWebhook);

// Authenticated student routes
router.get('/products', requireAuth, getProducts);
router.post('/payos', requireAuth, requireActiveUser, createPayment);
router.get('/', requireAuth, listMyPayments);
router.get('/wallet', requireAuth, getMyWallet);

export default router;
