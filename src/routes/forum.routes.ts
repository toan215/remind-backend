import { Router } from 'express';
import { createComment, createPost, updatePost, deletePost, updateComment, deleteComment, getPostDetail, listForumPosts, listForums, searchPosts, listAllPosts } from '../controllers/forum.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', listForums);
router.get('/search', searchPosts);
router.get('/posts', listAllPosts);
router.get('/posts/:postId', getPostDetail);
router.patch('/posts/:postId', requireAuth, updatePost);
router.delete('/posts/:postId', requireAuth, deletePost);
router.post('/:forumId/posts', requireAuth, createPost);
router.patch('/comments/:commentId', requireAuth, updateComment);
router.delete('/comments/:commentId', requireAuth, deleteComment);
router.post('/posts/:postId/comments', requireAuth, createComment);
router.get('/:forumId/posts', listForumPosts);

export default router;
