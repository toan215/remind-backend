import { Router } from 'express';
import { requireAuth, requireActiveUser, requireRole } from '../middlewares/auth.middleware';
import {
  getProducts,
  createPayment,
  listMyPayments,
  getMyWallet,
  payOSWebhook,
  createAppointmentPayment,
  vnpayIpn,
  vnpayReturn,
} from '../controllers/payments.controller';

const router = Router();

// Public webhook (payOS calls this)
router.post('/payos/webhook', payOSWebhook);

// Authenticated student routes
router.get('/products', requireAuth, getProducts);
router.post('/payos', requireAuth, requireActiveUser, createPayment);
router.get('/', requireAuth, listMyPayments);
router.get('/wallet', requireAuth, getMyWallet);

// Appointment payment (VNPAY demo)
router.post('/appointment', requireAuth, requireActiveUser, requireRole('student'), createAppointmentPayment);
router.post('/vnpay/ipn', vnpayIpn); // public
router.get('/vnpay/return', vnpayReturn); // public

export default router;
