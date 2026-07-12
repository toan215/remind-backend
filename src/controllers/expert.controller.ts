import { type Request, type Response } from 'express';
import mongoose from 'mongoose';
// Giả định các model này đã được tạo và export từ thư mục models
import User from '../models/user.model';
import Appointment from '../models/appointment.model';
import type { FullExpertUserDoc } from '../types/user.types';

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