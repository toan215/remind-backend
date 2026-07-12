import { type RequestHandler } from 'express';
import mongoose from 'mongoose';
import Forum from '../models/forum.model';
import ForumPost from '../models/forumPost.model';
import ForumComment from '../models/forumComment.model';
import User from '../models/user.model';
import Log from '../models/log.model';
import type { AuthorDisplayMode } from '../types/common';
import { logDB } from '../utils/log';

interface ForumParams {
  forumId: string;
}

interface PostParams {
  postId: string;
}

interface CreatePostBody {
  title?: unknown;
  content?: unknown;
  tags?: unknown;
  authorDisplayMode?: unknown;
  forumId?: unknown;
}

interface CreateCommentBody {
  content?: unknown;
  authorDisplayMode?: unknown;
}

interface SearchQuery {
  q?: string;
}

const isValidObjectId = (id: string | undefined): boolean => {
  if (!id) return false;
  return mongoose.Types.ObjectId.isValid(id);
};

const buildPublicAuthorName = (
  user: { fullName?: string | null } | null,
  authorDisplayMode: AuthorDisplayMode
): string => {
  if (authorDisplayMode === 1) {
    return 'Anonymous';
  }

  return (user && typeof user.fullName === 'string' && user.fullName.trim()) || 'Anonymous';
};

const toSafeDocument = (doc: Record<string, unknown> | null | undefined, currentUserId?: string): Record<string, unknown> | null | undefined => {
  const payload = doc && typeof (doc as { toObject?: () => Record<string, unknown> }).toObject === 'function'
    ? (doc as { toObject: () => Record<string, unknown> }).toObject()
    : doc;
  if (!payload) {
    return payload;
  }

  const safePayload = { ...payload };
  if (currentUserId && safePayload.authorId) {
    safePayload.isMine = safePayload.authorId.toString() === currentUserId.toString();
  } else {
    safePayload.isMine = false;
  }

  if (Object.prototype.hasOwnProperty.call(safePayload, 'authorId')) {
    delete safePayload.authorId;
  }
  if (Object.prototype.hasOwnProperty.call(safePayload, 'likedBy')) {
    delete safePayload.likedBy;
  }
  return safePayload;
};

export const listForums: RequestHandler = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const cursor = req.query.cursor as string;

    const query: any = { isActive: true };

    if (cursor && mongoose.Types.ObjectId.isValid(cursor)) {
      query._id = { $lt: new mongoose.Types.ObjectId(cursor) };
    }

    const forums = await Forum.find(query)
      .sort({ _id: -1 }) // Sắp xếp giảm dần để tin mới nhất lên đầu
      .limit(limit + 1)
      .lean();

    const hasNext = forums.length > limit;
    
    const items = hasNext ? forums.slice(0, limit) : forums;
    
    const nextCursor = items.length > 0 ? items[items.length - 1]._id : null;

    return res.status(200).json({ 
      forums: items,
      nextCursor,
      hasNext
    });
  } catch (err) {
    console.error('listForums error:', err);
    return res.status(500).json({ error: 'Failed to fetch forums' });
  }
};


export const createPost: RequestHandler = async (req, res) => {
  const { title, content, tags, authorDisplayMode, forumId } = (req.body || {}) as CreatePostBody;
  const displayMode = authorDisplayMode as AuthorDisplayMode;
  const userId = req.user && req.user.id;

  if (!isValidObjectId(userId)) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'Title is required' });
  }
  if (!content || typeof content !== 'string' || !content.trim()) {
    return res.status(400).json({ error: 'Content is required' });
  }
  if (![0, 1].includes(displayMode as number)) {
    return res.status(400).json({ error: 'Invalid author display mode' });
  }
  if (typeof forumId !== 'string' || !isValidObjectId(forumId)) {
    return res.status(400).json({ error: 'Valid forum id is required' });
  }

  try {
    const forum = await Forum.findOne({ _id: forumId, isActive: true }).lean();
    if (!forum) {
      return res.status(404).json({ error: 'Forum not found' });
    }

    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const post = await ForumPost.create({
      forumId,
      authorId: userId,
      authorDisplayMode: displayMode,
      publicAuthorName: buildPublicAuthorName(user, displayMode),
      title: title.trim(),
      content: content.trim(),
      tags: Array.isArray(tags)
        ? tags.filter((tag) => typeof tag === 'string').map((tag) => tag.trim()).filter(Boolean)
        : [],
      status: 'active',
      likeCount: 0,
      commentCount: 0,
    });

    logDB.write('ForumPost', 'create', post._id.toString(), { title: post.title });

    return res.status(201).json({ post: toSafeDocument(await ForumPost.findById(post._id).lean(), userId) });
  } catch (err: any) {
    logDB.error('ForumPost', 'create', err);
    console.error('createPost error:', err);
    return res.status(500).json({ error: 'Failed to create forum post' });
  }
};

export const updatePost: RequestHandler = async (req, res) => {
  const { postId } = req.params;
  const { title, content, tags, authorDisplayMode } = req.body;
  const userId = req.user?.id;

    if (!isValidObjectId(postId as string)) {
    return res.status(400).json({ error: 'Invalid post id' });
  }

  if (!userId) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    const post = await ForumPost.findById(postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (post.authorId.toString() !== userId) {
      return res.status(403).json({ error: 'Forbidden: You can only edit your own posts' });
    }

    if (title !== undefined) {
      if (typeof title !== 'string' || !title.trim()) return res.status(400).json({ error: 'Invalid title' });
      post.title = title.trim();
    }
    
    if (content !== undefined) {
      if (typeof content !== 'string' || !content.trim()) return res.status(400).json({ error: 'Invalid content' });
      post.content = content.trim();
    }

    if (tags !== undefined) {
      if (!Array.isArray(tags)) return res.status(400).json({ error: 'Tags must be an array' });
      post.tags = tags.filter((tag) => typeof tag === 'string').map((tag) => tag.trim()).filter(Boolean);
    }

    if (authorDisplayMode !== undefined) {
      if (![0, 1].includes(authorDisplayMode as number)) {
        return res.status(400).json({ error: 'Invalid author display mode' });
      }
      post.authorDisplayMode = authorDisplayMode as AuthorDisplayMode;
      const dbUser = await User.findById(userId).select('fullName').lean();
      post.publicAuthorName = buildPublicAuthorName(dbUser, post.authorDisplayMode as AuthorDisplayMode);
    }

    await post.save();

    await Log.create({
      actorId: new mongoose.Types.ObjectId(userId),
      actorRole: req.user?.role || 'student',
      action: 'post.update',
      targetType: 'post',
      targetId: post._id,
      metadata: { authorDisplayMode: post.authorDisplayMode }
    }).catch(err => console.error('Failed to write post.update log:', err));

    return res.status(200).json({ message: 'Post updated successfully', post: toSafeDocument(post as any, userId) });
  } catch (err) {
    console.error('updatePost error:', err);
    return res.status(500).json({ error: 'Failed to update post' });
  }
};

export const createComment: RequestHandler = async (req, res) => {
  const { postId } = req.params as unknown as PostParams;
  const { content, authorDisplayMode, parentId } = (req.body || {}) as CreateCommentBody & { parentId?: string };
  const displayMode = authorDisplayMode as AuthorDisplayMode;
  const userId = req.user && req.user.id;

    if (!isValidObjectId(postId as string)) {
    return res.status(400).json({ error: 'Invalid post id' });
  }
  if (!isValidObjectId(userId)) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  if (!content || typeof content !== 'string' || !content.trim()) {
    return res.status(400).json({ error: 'Content is required' });
  }
  if (![0, 1].includes(displayMode as number)) {
    return res.status(400).json({ error: 'Invalid author display mode' });
  }

  try {
    const post = await ForumPost.findOne({ _id: postId, status: 'active' }).lean();
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const comment = await ForumComment.create({
      postId,
      authorId: userId,
      authorDisplayMode: displayMode,
      publicAuthorName: buildPublicAuthorName(user, displayMode),
      content: content.trim(),
      status: 'active',
      likeCount: 0,
      parentId: parentId && isValidObjectId(parentId) ? parentId : null,
    });

    await ForumPost.updateOne({ _id: postId }, { $inc: { commentCount: 1 } });

    return res.status(201).json({ comment: toSafeDocument(await ForumComment.findById(comment._id).lean(), userId) });
  } catch (err) {
    console.error('createComment error:', err);
    return res.status(500).json({ error: 'Failed to create forum comment' });
  }
};

export const deletePost: RequestHandler = async (req, res) => {
  const { postId } = req.params;
  const userId = req.user?.id;

  if (!isValidObjectId(postId as string)) {
    return res.status(400).json({ error: 'Invalid post id' });
  }

  if (!userId) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    const post = await ForumPost.findById(postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (post.authorId.toString() !== userId) {
      return res.status(403).json({ error: 'Forbidden: You can only delete your own posts' });
    }

    post.status = 'deleted';
    await post.save();

    await Log.create({
      actorId: new mongoose.Types.ObjectId(userId),
      actorRole: req.user?.role || 'student',
      action: 'post.delete',
      targetType: 'post',
      targetId: post._id
    }).catch(err => console.error('Failed to write post.delete log:', err));

    return res.status(200).json({ message: 'Post deleted successfully', post: toSafeDocument(post as any, userId) });
  } catch (err) {
    console.error('deletePost error:', err);
    return res.status(500).json({ error: 'Failed to delete post' });
  }
};

export const updateComment: RequestHandler = async (req, res) => {
  const { commentId } = req.params;
  const { content, authorDisplayMode } = req.body;
  const userId = req.user?.id;

  if (!isValidObjectId(commentId as string)) {
    return res.status(400).json({ error: 'Invalid comment id' });
  }

  if (!userId) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    const comment = await ForumComment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    if (comment.authorId.toString() !== userId) {
      return res.status(403).json({ error: 'Forbidden: You can only edit your own comments' });
    }

    if (content !== undefined) {
      if (typeof content !== 'string' || !content.trim()) return res.status(400).json({ error: 'Invalid content' });
      comment.content = content.trim();
    }

    if (authorDisplayMode !== undefined) {
      if (![0, 1].includes(authorDisplayMode as number)) {
        return res.status(400).json({ error: 'Invalid author display mode' });
      }
      comment.authorDisplayMode = authorDisplayMode as AuthorDisplayMode;
      comment.publicAuthorName = buildPublicAuthorName(req.user as any, comment.authorDisplayMode as AuthorDisplayMode);
    }

    await comment.save();

    await Log.create({
      actorId: new mongoose.Types.ObjectId(userId),
      actorRole: req.user?.role || 'student',
      action: 'comment.update',
      targetType: 'comment',
      targetId: comment._id,
      metadata: { postId: comment.postId, authorDisplayMode: comment.authorDisplayMode }
    }).catch(err => console.error('Failed to write comment.update log:', err));

    return res.status(200).json({ message: 'Comment updated successfully', comment: toSafeDocument(comment as any, userId) });
  } catch (err) {
    console.error('updateComment error:', err);
    return res.status(500).json({ error: 'Failed to update comment' });
  }
};

export const deleteComment: RequestHandler = async (req, res) => {
  const { commentId } = req.params;
  const userId = req.user?.id;

  if (!isValidObjectId(commentId as string)) {
    return res.status(400).json({ error: 'Invalid comment id' });
  }

  if (!userId) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    const comment = await ForumComment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    if (comment.authorId.toString() !== userId) {
      return res.status(403).json({ error: 'Forbidden: You can only delete your own comments' });
    }

    comment.status = 'deleted';
    await comment.save();

    await ForumPost.updateOne({ _id: comment.postId }, { $inc: { commentCount: -1 } });

    await Log.create({
      actorId: new mongoose.Types.ObjectId(userId),
      actorRole: req.user?.role || 'student',
      action: 'comment.delete',
      targetType: 'comment',
      targetId: comment._id,
      metadata: { postId: comment.postId }
    }).catch(err => console.error('Failed to write comment.delete log:', err));

    return res.status(200).json({ message: 'Comment deleted successfully', comment: toSafeDocument(comment as any, userId) });
  } catch (err) {
    console.error('deleteComment error:', err);
    return res.status(500).json({ error: 'Failed to delete comment' });
  }
};

export const listForumPosts: RequestHandler = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const cursor = req.query.cursor as string;
    const page = req.query.page ? parseInt(req.query.page as string) : undefined;
    const forumId = req.query.forumId as string | undefined;

    const query: any = { status: 'active' };

    if (forumId !== undefined) {
      if (!isValidObjectId(forumId)) {
        return res.status(400).json({ error: 'Invalid forum id' });
      }
      query.forumId = new mongoose.Types.ObjectId(forumId);
    }

    // Page-based Pagination Logic
    if (page !== undefined && page > 0) {
      const skip = (page - 1) * limit;
      const totalItems = await ForumPost.countDocuments(query);
      const posts = await ForumPost.find(query)
        .select('-likedBy')
        .sort({ _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      logDB.read('ForumPost', query, posts.length);

      return res.status(200).json({
        posts: posts.map(p => toSafeDocument(p, req.user?.id)),
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        currentPage: page
      });
    }

    // Cursor-based Pagination Logic (Backward Compatibility)
    if (cursor && mongoose.Types.ObjectId.isValid(cursor)) {
      query._id = { $lt: new mongoose.Types.ObjectId(cursor) };
    }

    const posts = await ForumPost.find(query)
      .select('-likedBy')
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean();

    const hasNext = posts.length > limit;
    const items = hasNext ? posts.slice(0, limit) : posts;
    const nextCursor = items.length > 0 ? items[items.length - 1]._id : null;

    logDB.read('ForumPost', query, items.length);

    return res.status(200).json({
      posts: items.map(p => toSafeDocument(p, req.user?.id)),
      nextCursor,
      hasNext
    });
  } catch (err: any) {
    logDB.error('ForumPost', 'listForumPosts', err);
    console.error('listForumPosts error:', err);
    return res.status(500).json({ error: 'Failed to fetch forum posts' });
  }
};

export const getPostDetail: RequestHandler = async (req, res) => {
  const { postId } = req.params as unknown as PostParams;

    if (!isValidObjectId(postId as string)) {
    return res.status(400).json({ error: 'Invalid post id' });
  }

  try {
    const post = await ForumPost.findOne({ _id: postId, status: 'active' }).select('-likedBy').lean();

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const comments = await ForumComment.find({ postId, status: 'active' })
      .sort({ createdAt: 1 })
      .lean();

    return res.status(200).json({ post: toSafeDocument(post, req.user?.id), comments: comments.map(c => toSafeDocument(c, req.user?.id)) });
  } catch (err) {
    console.error('getPostDetail error:', err);
    return res.status(500).json({ error: 'Failed to fetch post detail' });
  }
};

export const searchPosts: RequestHandler = async (req, res) => {
  const { q } = req.query as SearchQuery;
  const searchQuery = typeof q === 'string' ? q.trim() : '';

  if (!searchQuery) {
    return res.status(200).json({ posts: [] });
  }

  try {
    const posts = await ForumPost.find(
      { $text: { $search: searchQuery }, status: 'active' },
      { score: { $meta: 'textScore' } }
    )
      .sort({ score: { $meta: 'textScore' }, createdAt: -1 } as any)
      .lean();

    return res.status(200).json({
      posts: posts.map((post) => {
        const { authorId, likedBy, score, ...safePost } = post as Record<string, unknown> & {
          authorId?: unknown;
          likedBy?: unknown;
          score?: unknown;
        };
        if (req.user?.id && authorId) {
          (safePost as any).isMine = authorId.toString() === req.user.id.toString();
        } else {
          (safePost as any).isMine = false;
        }
        return safePost;
      }),
    });
  } catch (err) {
    console.error('searchPosts error:', err);
    return res.status(500).json({ error: 'Failed to search forum posts' });
  }
};

export const toggleLike: RequestHandler = async (req, res) => {
  const { postId } = req.params;
  const userId = req.user?.id;

  if (!isValidObjectId(postId as string)) {
    return res.status(400).json({ error: 'Invalid post id' });
  }
  if (!isValidObjectId(userId)) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    const post = await ForumPost.findById(postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const likedBy = (post.likedBy || []).map((id: any) => id.toString());
    const index = likedBy.indexOf(userId);
    const wasLiked = index !== -1;

    if (wasLiked) {
      likedBy.splice(index, 1);
    } else {
      likedBy.push(userId);
    }

    post.likedBy = likedBy;
    post.likeCount = likedBy.length;
    await post.save();

    return res.status(200).json({
      message: 'Toggle like successful',
      liked: !wasLiked,
      post: toSafeDocument(post.toObject(), userId)
    });
  } catch (err) {
    console.error('toggleLike error:', err);
    return res.status(500).json({ error: 'Failed to toggle like' });
  }
};

export const toggleCommentLike: RequestHandler = async (req, res) => {
  const { commentId } = req.params;
  const userId = req.user?.id;

  if (!isValidObjectId(commentId as string)) {
    return res.status(400).json({ error: 'Invalid comment id' });
  }
  if (!isValidObjectId(userId)) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    const comment = await ForumComment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    const likedBy = (comment.likedBy || []).map((id: any) => id.toString());
    const index = likedBy.indexOf(userId);
    const wasLiked = index !== -1;

    if (wasLiked) {
      likedBy.splice(index, 1);
    } else {
      likedBy.push(userId);
    }

    comment.likedBy = likedBy;
    comment.likeCount = likedBy.length;
    await comment.save();

    return res.status(200).json({
      message: 'Toggle like successful',
      liked: !wasLiked,
      comment: toSafeDocument(comment.toObject(), userId)
    });
  } catch (err) {
    console.error('toggleCommentLike error:', err);
    return res.status(500).json({ error: 'Failed to toggle comment like' });
  }
};
