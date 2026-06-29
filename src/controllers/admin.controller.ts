import { type RequestHandler } from 'express';
import mongoose from 'mongoose';
import User from '../models/user.model';
import Report from '../models/report.model';
import Log from '../models/log.model';
import Forum from '../models/forum.model';
import ForumPost from '../models/forumPost.model';
import ForumComment from '../models/forumComment.model';
import type { ReportStatus } from '../types/common';

const isValidObjectId = (id: string | undefined): boolean => {
  if (!id) return false;
  return mongoose.Types.ObjectId.isValid(id);
};

const writeLog = async (
  actorId: mongoose.Types.ObjectId,
  actorRole: string,
  action: string,
  targetType?: string,
  targetId?: mongoose.Types.ObjectId,
  metadata?: Record<string, unknown>
): Promise<void> => {
  try {
    await Log.create({ actorId, actorRole, action, targetType, targetId, metadata });
  } catch (err) {
    console.error('Failed to write admin log:', err);
  }
};

interface ExpertIdParams { id: string; }
interface ResolveReportParams { id: string; }
interface RejectExpertBody { reason?: unknown; }
interface ResolveReportBody { action?: unknown; }
interface ReportsQuery { status?: string; }

export const createForum: RequestHandler = async (req, res) => {
  try {
    const { title, description, category, isActive } = req.body;
    const adminId = req.user?.id;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({ error: 'Title is required' });
    }
    if (!category || typeof category !== 'string' || category.trim().length === 0) {
      return res.status(400).json({ error: 'Category is required' });
    }

    const forum = await Forum.create({
      title: title.trim(),
      description: description ? String(description).trim() : undefined,
      category: category.trim(),
      createdByAdminId: adminId ? new mongoose.Types.ObjectId(adminId) : new mongoose.Types.ObjectId(),
      isActive: isActive !== undefined ? Boolean(isActive) : true,
    });

    if (adminId) {
      await writeLog(
        new mongoose.Types.ObjectId(adminId),
        req.user?.role || 'admin',
        'forum.create',
        'forum',
        forum._id,
        { title: forum.title }
      );
    }

    return res.status(201).json({ message: 'Forum created successfully', forum });
  } catch (err) {
    console.error('createForum error:', err);
    return res.status(500).json({ error: 'Failed to create forum' });
  }
};

export const updateForum: RequestHandler = async (req, res) => {
  try {
    const { forumId } = req.params;
    const { title, description, category, isActive } = req.body;
    const adminId = req.user?.id;

    if (!isValidObjectId(forumId as string)) {
      return res.status(400).json({ error: 'Invalid forum id' });
    }

    const updates: Record<string, any> = {};
    if (title !== undefined) updates.title = String(title).trim();
    if (description !== undefined) updates.description = String(description).trim();
    if (category !== undefined) updates.category = String(category).trim();
    if (isActive !== undefined) updates.isActive = Boolean(isActive);

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'At least one field to update is required' });
    }

    const forum = await Forum.findByIdAndUpdate(forumId, { $set: updates }, { new: true });
    if (!forum) {
      return res.status(404).json({ error: 'Forum not found' });
    }

    if (adminId) {
      await writeLog(
        new mongoose.Types.ObjectId(adminId),
        req.user?.role || 'admin',
        'forum.update',
        'forum',
        forum._id,
        { updates }
      );
    }

    return res.status(200).json({ message: 'Forum updated successfully', forum });
  } catch (err) {
    console.error('updateForum error:', err);
    return res.status(500).json({ error: 'Failed to update forum' });
  }
};

export const listForumPosts: RequestHandler = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const cursor = req.query.cursor as string;
    const forumId = req.query.forumId as string | undefined;
    const status = req.query.status as string | undefined;
    const search = req.query.q as string | undefined;

    const filter: Record<string, unknown> = {};

    if (forumId !== undefined) {
      if (!isValidObjectId(forumId)) {
        return res.status(400).json({ error: 'Invalid forum id' });
      }
      filter.forumId = new mongoose.Types.ObjectId(forumId);
    }

    if (status !== undefined) {
      if (!['active', 'hidden', 'deleted', 'under_review'].includes(status)) {
        return res.status(400).json({ error: `Invalid status: ${status}. Valid: active, hidden, deleted, under_review` });
      }
      filter.status = status;
    }

    if (search !== undefined && search.trim().length > 0) {
      filter.$text = { $search: search.trim() };
    }

    if (cursor && mongoose.Types.ObjectId.isValid(cursor)) {
      filter._id = { $lt: new mongoose.Types.ObjectId(cursor) };
    }

    const posts = await ForumPost.find(filter)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean();

    const hasNext = posts.length > limit;
    const items = hasNext ? posts.slice(0, limit) : posts;
    const nextCursor = items.length > 0 ? items[items.length - 1]._id : null;

    return res.status(200).json({ posts: items, nextCursor, hasNext });
  } catch (err) {
    console.error('listForumPosts error:', err);
    return res.status(500).json({ error: 'Failed to fetch forum posts' });
  }
};

export const getForumPost: RequestHandler = async (req, res) => {
  try {
    const { postId } = req.params;

    if (!isValidObjectId(postId as string)) {
      return res.status(400).json({ error: 'Invalid post id' });
    }

    const post = await ForumPost.findById(postId).lean();
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const comments = await ForumComment.find({ postId }).sort({ createdAt: 1 }).lean();

    return res.status(200).json({ post, comments });
  } catch (err) {
    console.error('getForumPost error:', err);
    return res.status(500).json({ error: 'Failed to fetch forum post' });
  }
};

export const deleteForumPost: RequestHandler = async (req, res) => {
  try {
    const { postId } = req.params;
    const adminId = req.user?.id;

    if (!isValidObjectId(postId as string)) {
      return res.status(400).json({ error: 'Invalid post id' });
    }

    const post = await ForumPost.findByIdAndUpdate(
      postId,
      { $set: { status: 'deleted' } },
      { new: true }
    );

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (adminId) {
      await writeLog(
        new mongoose.Types.ObjectId(adminId),
        req.user?.role || 'admin',
        'post.delete',
        'post',
        post._id,
        { authorId: post.authorId }
      );
    }

    return res.status(200).json({ message: 'Post deleted successfully', post });
  } catch (err) {
    console.error('deleteForumPost error:', err);
    return res.status(500).json({ error: 'Failed to delete post' });
  }
};

export const deleteForum: RequestHandler = async (req, res) => {
  try {
    const { forumId } = req.params;
    const adminId = req.user?.id;

    if (!isValidObjectId(forumId as string)) {
      return res.status(400).json({ error: 'Invalid forum id' });
    }

    const forum = await Forum.findByIdAndUpdate(
      forumId,
      { $set: { isActive: false } },
      { new: true }
    );

    if (!forum) {
      return res.status(404).json({ error: 'Forum not found' });
    }

    if (adminId) {
      await writeLog(
        new mongoose.Types.ObjectId(adminId),
        req.user?.role || 'admin',
        'forum.delete',
        'forum',
        forum._id
      );
    }

    return res.status(200).json({ message: 'Forum deleted successfully', forum });
  } catch (err) {
    console.error('deleteForum error:', err);
    return res.status(500).json({ error: 'Failed to delete forum' });
  }
};

export const deleteForumComment: RequestHandler = async (req, res) => {
  try {
    const { commentId } = req.params;
    const adminId = req.user?.id;

    if (!isValidObjectId(commentId as string)) {
      return res.status(400).json({ error: 'Invalid comment id' });
    }

    const comment = await ForumComment.findByIdAndUpdate(
      commentId,
      { $set: { status: 'deleted' } },
      { new: true }
    );

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Decrement post comment count
    await ForumPost.updateOne({ _id: comment.postId }, { $inc: { commentCount: -1 } });

    if (adminId) {
      await writeLog(
        new mongoose.Types.ObjectId(adminId),
        req.user?.role || 'admin',
        'comment.delete',
        'comment',
        comment._id,
        { authorId: comment.authorId, postId: comment.postId }
      );
    }

    return res.status(200).json({ message: 'Comment deleted successfully', comment });
  } catch (err) {
    console.error('deleteForumComment error:', err);
    return res.status(500).json({ error: 'Failed to delete comment' });
  }
};

export const getPendingExperts: RequestHandler = async (req, res) => {
  try {
    const experts = await User.find({ role: 'expert', status: 'pending' })
      .select('email fullName role status expert createdAt')
      .lean();
    return res.status(200).json({ experts });
  } catch (err) {
    console.error('getPendingExperts error:', err);
    return res.status(500).json({ error: 'Failed to fetch pending experts' });
  }
};

export const approveExpert: RequestHandler = async (req, res) => {
  const { id } = req.params as unknown as ExpertIdParams;
  const adminId = req.user && req.user.id;

  if (!isValidObjectId(id)) {
    return res.status(400).json({ error: 'Invalid expert id' });
  }

  try {
    const expert = await User.findById(id);

    if (!expert) {
      return res.status(404).json({ error: 'Expert not found' });
    }
    if (expert.role !== 'expert') {
      return res.status(400).json({ error: 'Target user is not an expert' });
    }
    if ((expert.status as string) === 'active') {
      return res.status(409).json({ error: 'Expert already active' });
    }

    const reviewedBy = adminId ? new mongoose.Types.ObjectId(adminId) : undefined;

    expert.status = 'active';
    expert.expert = expert.expert || {};
    expert.expert.approval = {
      ...(expert.expert.approval || {}),
      ...(reviewedBy ? { reviewedBy } : {}),
      reviewedAt: new Date(),
      rejectionReason: undefined,
    };

    await expert.save();

    await writeLog(reviewedBy || new mongoose.Types.ObjectId(), (req.user && req.user.role) || 'admin', 'expert.approve', 'user', new mongoose.Types.ObjectId(id));

    return res.status(200).json({ message: `Expert ${id} approved.`, expertId: id });
  } catch (err) {
    console.error('approveExpert error:', err);
    return res.status(500).json({ error: 'Failed to approve expert' });
  }
};

export const rejectExpert: RequestHandler = async (req, res) => {
  const { id } = req.params as unknown as ExpertIdParams;
  const { reason } = req.body as RejectExpertBody;
  const adminId = req.user && req.user.id;

  if (!isValidObjectId(id)) {
    return res.status(400).json({ error: 'Invalid expert id' });
  }
  if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
    return res.status(400).json({ error: 'Rejection reason is required' });
  }

  try {
    const expert = await User.findById(id);

    if (!expert) {
      return res.status(404).json({ error: 'Expert not found' });
    }
    if (expert.role !== 'expert') {
      return res.status(400).json({ error: 'Target user is not an expert' });
    }

    expert.status = 'rejected';
    expert.expert = expert.expert || {};
    const reviewedBy = adminId ? new mongoose.Types.ObjectId(adminId) : undefined;
    expert.expert.approval = {
      ...(expert.expert.approval || {}),
      ...(reviewedBy ? { reviewedBy } : {}),
      reviewedAt: new Date(),
      rejectionReason: reason.trim(),
    };

    await expert.save();

    await writeLog(
      reviewedBy || new mongoose.Types.ObjectId(),
      (req.user && req.user.role) || 'admin',
      'expert.reject',
      'user',
      new mongoose.Types.ObjectId(id),
      { reason: reason.trim() }
    );

    return res.status(200).json({ message: `Expert ${id} rejected.`, expertId: id });
  } catch (err) {
    console.error('rejectExpert error:', err);
    return res.status(500).json({ error: 'Failed to reject expert' });
  }
};

export const getReports: RequestHandler = async (req, res) => {
  try {
    const { status } = req.query as ReportsQuery;
    const filter: { status?: ReportStatus } = {};
    if (status) filter.status = status as ReportStatus;

    const reports = await Report.find(filter)
      .select('reporterId targetType targetId reason description status resolutionAction resolvedBy resolvedAt createdAt')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return res.status(200).json({ reports });
  } catch (err) {
    console.error('getReports error:', err);
    return res.status(500).json({ error: 'Failed to fetch reports' });
  }
};

export const resolveReport: RequestHandler = async (req, res) => {
  const { id } = req.params as unknown as ResolveReportParams;
  const { action } = req.body as ResolveReportBody;
  const adminId = req.user && req.user.id;

  if (!isValidObjectId(id)) {
    return res.status(400).json({ error: 'Invalid report id' });
  }
  if (!action || typeof action !== 'string' || action.trim().length === 0) {
    return res.status(400).json({ error: 'Resolution action is required' });
  }

  try {
    const report = await Report.findById(id);

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }
    if (report.status === 'resolved') {
      return res.status(409).json({ error: 'Report already resolved' });
    }

    report.status = 'resolved';
    report.resolutionAction = action.trim();
    report.resolvedBy = adminId ? new mongoose.Types.ObjectId(adminId) : undefined;
    report.resolvedAt = new Date();

    await report.save();

    const resolvedBy = adminId ? new mongoose.Types.ObjectId(adminId) : new mongoose.Types.ObjectId();
    await writeLog(
      resolvedBy,
      (req.user && req.user.role) || 'admin',
      'report.resolve',
      'report',
      new mongoose.Types.ObjectId(id),
      { action: action.trim(), targetType: report.targetType, targetId: report.targetId.toString() }
    );

    return res.status(200).json({ message: `Report ${id} resolved.`, reportId: id });
  } catch (err) {
    console.error('resolveReport error:', err);
    return res.status(500).json({ error: 'Failed to resolve report' });
  }
};
