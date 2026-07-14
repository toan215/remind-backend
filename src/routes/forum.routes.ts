import { Router } from 'express';
import { createComment, createPost, updatePost, deletePost, updateComment, deleteComment, getPostDetail, listForumPosts, listForums, searchPosts, toggleLike, toggleCommentLike } from '../controllers/forum.controller';
import { requireAuth, requireActiveUser } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', listForums);
router.get('/search', searchPosts);
router.get('/posts/:postId', getPostDetail);
router.patch('/posts/:postId', requireAuth, requireActiveUser, updatePost);
router.delete('/posts/:postId', requireAuth, requireActiveUser, deletePost);
router.post('/posts', requireAuth, requireActiveUser, createPost);
router.post('/posts/:postId/like', requireAuth, requireActiveUser, toggleLike);
router.patch('/comments/:commentId', requireAuth, requireActiveUser, updateComment);
router.delete('/comments/:commentId', requireAuth, requireActiveUser, deleteComment);
router.post('/comments/:commentId/like', requireAuth, requireActiveUser, toggleCommentLike);
router.post('/posts/:postId/comments', requireAuth, requireActiveUser, createComment);
router.get('/posts', listForumPosts);

export default router;
