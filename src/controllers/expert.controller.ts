import { type Request, type Response } from 'express';
import mongoose from 'mongoose';
// Giả định các model này đã được tạo và export từ thư mục models
import User from '../models/user.model';
import Appointment from '../models/appointment.model';
import ExpertSlot from '../models/expertSlot.model';
import type { FullExpertUserDoc } from '../types/user.types';

export const listPublicExperts = async (req: Request, res: Response) => {
  try {
    const experts = await User.find({ role: 'expert', status: 'active' })
      .select('fullName expert createdAt')
      .lean();

    const expertIds = experts.map((e) => e._id);
    const priceAgg = await ExpertSlot.aggregate([
      { $match: { expertId: { $in: expertIds }, status: 'available' } },
      { $group: { _id: '$expertId', priceFrom: { $min: '$price' } } },
    ]);
    const priceMap = new Map(priceAgg.map((p) => [p._id.toString(), p.priceFrom]));

    const result = experts.map((e) => ({
      _id: e._id,
      fullName: e.fullName,
      title: e.expert?.profile?.professionalTitle,
      specialties: e.expert?.profile?.specialties ?? [],
      languages: e.expert?.profile?.languages ?? [],
      bio: e.expert?.profile?.bio,
      priceFrom: priceMap.get(e._id.toString()) ?? null,
    }));

    return res.status(200).json({ experts: result });
  } catch (err) {
    console.error('listPublicExperts error:', err);
    return res.status(500).json({ error: 'Failed to fetch experts' });
  }
};

/**
 * Lấy dữ liệu cho trang dashboard của chuyên gia.
 * Dữ liệu này sẽ được truy vấn trực tiếp từ MongoDB.
 * @param req - Request object, chứa thông tin user đã đăng nhập
 * @param res - Response object
 */
export const getExpertDashboard = async (req: Request, res: Response) => {
  try {
    const expertId = req.user?.id;
    if (!expertId || !mongoose.Types.ObjectId.isValid(expertId)) {
        return res.status(401).json({ message: 'Xác thực không hợp lệ.' });
    }

    const expert = (await User.findById(expertId).select('expert').lean()) as FullExpertUserDoc | null;
    if (!expert || !expert.expert) {
      return res.status(404).json({ message: 'Không tìm thấy chuyên gia.' });
    }

    const upcomingAppointments = await Appointment.find({
      expertId: expert._id,
      status: 'confirmed',
      scheduledStartAt: { $gte: new Date() },
    }).sort({ scheduledStartAt: 'asc' }).limit(2).populate('studentId', 'fullName').lean();

    // Tính toán % hoàn thiện hồ sơ
    const profile = expert.expert?.profile;
    const totalFields = 4;
    let completedFields = 0;
    if (profile?.professionalTitle) completedFields++;
    if (profile?.bio) completedFields++;
    if (profile?.yearsOfExperience) completedFields++;
    if (profile?.languages && profile.languages.length > 0) completedFields++;
    const profileCompletion = Math.round((completedFields / totalFields) * 100);

    // Tính toán thu nhập tháng này từ các cuộc hẹn đã hoàn thành
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const earningsAggregation = await Appointment.aggregate([
      {
        $match: {
          expertId: expert._id,
          status: 'completed',
          // Giả định dùng scheduledEndAt, có thể đổi thành actualEndAt nếu có
          scheduledEndAt: { $gte: startOfMonth, $lte: endOfMonth },
        },
      },
      { $group: { _id: null, total: { $sum: '$expertPayoutAmount' } } },
    ]);

    const monthlyEarnings = earningsAggregation.length > 0 ? earningsAggregation[0].total : 0;

    res.status(200).json({
      upcomingAppointments: upcomingAppointments.map((appt: any) => ({
        id: appt._id,
        studentName: appt.studentId?.fullName || 'Học viên ẩn danh',
        time: appt.scheduledStartAt,
        status: appt.status,
      })),
      stats: {
        completedSessions: expert.expert?.performanceStats?.completedSessionCount || 0,
        monthlyEarnings,
        rating: expert.expert?.performanceStats?.averageRating || 0,
      },
      profileCompletion,
    });
  } catch (error) {
    console.error('Lỗi khi lấy dashboard chuyên gia:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
};

/**
 * Lấy thông tin cài đặt của chuyên gia.
 */
export const getExpertSettings = async (req: Request, res: Response) => {
  try {
    const expertId = req.user?.id;
    if (!expertId || !mongoose.Types.ObjectId.isValid(expertId)) {
        return res.status(401).json({ message: 'Xác thực không hợp lệ.' });
    }

    const expert = await User.findById(expertId)
      .select('fullName email phone expert.profile expert.specialties expert.consultationSettings')
      .lean() as FullExpertUserDoc | null;

    if (!expert || !expert.expert) {
      return res.status(404).json({ message: 'Không tìm thấy chuyên gia.' });
    }

    res.status(200).json({
        fullName: expert.fullName,
        email: expert.email,
        phone: expert.phone,
        profile: expert.expert?.profile,
        specialties: expert.expert?.specialties,
        consultationSettings: expert.expert?.consultationSettings
    });
  } catch (error) {
    console.error('Lỗi khi lấy cài đặt chuyên gia:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
};

/**
 * Cập nhật thông tin cài đặt của chuyên gia.
 */
export const updateExpertSettings = async (req: Request, res: Response) => {
  try {
    const expertId = req.user?.id;
    if (!expertId || !mongoose.Types.ObjectId.isValid(expertId)) {
        return res.status(401).json({ message: 'Xác thực không hợp lệ.' });
    }

    const { fullName, specialties, profile } = req.body;

    // Chỉ cho phép cập nhật các trường được chỉ định để tránh lỗ hổng Mass Assignment
    const updateData: Record<string, any> = {};
    if (fullName && typeof fullName === 'string') {
      updateData.fullName = fullName;
    }
    if (specialties && Array.isArray(specialties)) {
      updateData['expert.specialties'] = specialties;
    }
    if (profile) {
      if (typeof profile.bio === 'string') {
        updateData['expert.profile.bio'] = profile.bio;
      }
      if (typeof profile.professionalTitle === 'string') {
        updateData['expert.profile.professionalTitle'] = profile.professionalTitle;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: 'Không có thông tin hợp lệ để cập nhật.' });
    }

    const updatedExpert = await User.findByIdAndUpdate(expertId, { $set: updateData }, { new: true, runValidators: true }).lean();

    if (!updatedExpert) {
        return res.status(404).json({ message: 'Không tìm thấy chuyên gia để cập nhật.' });
    }

    console.log('Đã cập nhật cài đặt chuyên gia với:', req.body);
    res.status(200).json({ message: 'Cập nhật cài đặt thành công!', settings: updatedExpert });
  } catch (error) {
    console.error('Lỗi khi cập nhật cài đặt chuyên gia:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
};

// --- Expert slot management ---

interface SlotInput {
  startAt?: unknown;
  endAt?: unknown;
  price?: unknown;
}

const toDate = (v: unknown): Date | null => {
  if (typeof v === 'string') {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  if (v instanceof Date) return v;
  return null;
};

export const createExpertSlots = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ message: 'Xác thực không hợp lệ.' });
    }
    const id = req.params.id as string;
    if (id !== userId) return res.status(403).json({ error: 'Forbidden' });

    const raw = req.body?.slots;
    const list: SlotInput[] = Array.isArray(raw) ? raw : [req.body];
    if (list.length === 0 || (list.length === 1 && !list[0])) {
      return res.status(400).json({ error: 'No slots provided' });
    }

    const docs: Record<string, unknown>[] = [];
    for (const s of list) {
      const startAt = toDate(s.startAt);
      const endAt = toDate(s.endAt);
      const price = typeof s.price === 'number' ? s.price : Number(s.price);
      if (!startAt || !endAt || isNaN(price) || price <= 0) {
        return res.status(400).json({ error: 'Invalid slot data' });
      }
      docs.push({
        expertId: new mongoose.Types.ObjectId(userId),
        startAt,
        endAt,
        price,
        status: 'available',
      });
    }

    const created = await ExpertSlot.insertMany(docs);
    return res.status(201).json({ slots: created });
  } catch (error) {
    console.error('Lỗi khi tạo slot chuyên gia:', error);
    return res.status(500).json({ error: 'Failed to create slots' });
  }
};

export const listOwnSlots = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    const id = req.params.id as string;
    if (id !== userId) return res.status(403).json({ error: 'Forbidden' });

    const slots = await ExpertSlot.find({ expertId: new mongoose.Types.ObjectId(userId) })
      .sort({ startAt: 1 })
      .lean();
    return res.status(200).json({ slots });
  } catch (error) {
    console.error('Lỗi khi lấy slot chuyên gia:', error);
    return res.status(500).json({ error: 'Failed to fetch slots' });
  }
};

export const listAvailableSlots = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid id' });

    const slots = await ExpertSlot.find({ expertId: new mongoose.Types.ObjectId(id), status: 'available' })
      .sort({ startAt: 1 })
      .lean();
    return res.status(200).json({ slots });
  } catch (error) {
    console.error('Lỗi khi lấy slot khả dụng:', error);
    return res.status(500).json({ error: 'Failed to fetch slots' });
  }
};

export const deleteExpertSlot = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    const slotId = req.params.slotId as string;
    if (!mongoose.Types.ObjectId.isValid(slotId)) return res.status(400).json({ error: 'Invalid slotId' });

    const slot = await ExpertSlot.findOne({
      _id: new mongoose.Types.ObjectId(slotId),
      expertId: new mongoose.Types.ObjectId(userId),
    });
    if (!slot) return res.status(404).json({ error: 'Slot not found' });
    if (slot.status === 'booked') return res.status(409).json({ error: 'Cannot delete a booked slot' });

    await ExpertSlot.deleteOne({ _id: slot._id });
    return res.status(200).json({ message: 'Slot deleted' });
  } catch (error) {
    console.error('Lỗi khi xóa slot:', error);
    return res.status(500).json({ error: 'Failed to delete slot' });
  }
};