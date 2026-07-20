import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import { approveExpert, getPendingExperts, getReports, rejectExpert, resolveReport, createForum, updateForum, deleteForumPost, deleteForum, deleteForumComment, listForumPosts, getForumPost, downloadExpertCredential, listUsers, updateUserRole, banUser, unbanUser } from '../controllers/admin.controller';
import {
  adminListCreditPackages,
  adminCreateCreditPackage,
  adminUpdateCreditPackage,
  adminDeactivateCreditPackage,
  adminListSubscriptionPlans,
  adminCreateSubscriptionPlan,
  adminUpdateSubscriptionPlan,
  adminDeactivateSubscriptionPlan,
  adminListPayments,
  adminPaymentSummary,
} from '../controllers/payments.controller';

const router = Router();

router.use(requireAuth);
router.use(requireRole('admin'));

// ─── User Role & Permission Management ────────────────────────────────────
router.get('/users', listUsers);
router.put('/users/:id/role', updateUserRole);
router.post('/users/:id/ban', banUser);
router.post('/users/:id/unban', unbanUser);

router.post('/forums', createForum);
router.patch('/forums/:forumId', updateForum);
router.delete('/forums/:forumId', deleteForum);

router.get('/forums/posts', listForumPosts);
router.get('/forums/posts/:postId', getForumPost);
router.delete('/forums/posts/:postId', deleteForumPost);

router.delete('/forums/comments/:commentId', deleteForumComment);

router.get('/experts/pending', getPendingExperts);
router.post('/experts/:id/approve', approveExpert);
router.post('/experts/:id/reject', rejectExpert);
router.get('/experts/:id/credential/:fileId', downloadExpertCredential);

router.get('/reports', getReports);
router.post('/reports/:id/resolve', resolveReport);

// Payment product management
router.get('/payments/credit-packages', adminListCreditPackages);
router.post('/payments/credit-packages', adminCreateCreditPackage);
router.patch('/payments/credit-packages/:id', adminUpdateCreditPackage);
router.delete('/payments/credit-packages/:id', adminDeactivateCreditPackage);

router.get('/payments/subscription-plans', adminListSubscriptionPlans);
router.post('/payments/subscription-plans', adminCreateSubscriptionPlan);
router.patch('/payments/subscription-plans/:id', adminUpdateSubscriptionPlan);
router.delete('/payments/subscription-plans/:id', adminDeactivateSubscriptionPlan);

// Payment reports
router.get('/payments', adminListPayments);
router.get('/payments/summary', adminPaymentSummary);

export default router;
