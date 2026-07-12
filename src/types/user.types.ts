import mongoose from 'mongoose';

// LƯU Ý: Interface này là một giải pháp tạm thời để cung cấp kiểu dữ liệu đầy đủ
// cho các controller mà không cần sửa đổi file user.model.ts gốc.
// Giải pháp lâu dài và tốt nhất vẫn là cập nhật trực tiếp user.model.ts.
export interface FullExpertUserDoc {
  _id: mongoose.Types.ObjectId;
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  expert?: {
    profile?: {
      professionalTitle?: string | null;
      bio?: string | null;
      yearsOfExperience?: number | null;
      languages?: string[] | null;
    } | null;
    specialties?: string[] | null;
    consultationSettings?: {
      sessionDurationMinutes?: number | null;
      maxSessionsPerDay?: number | null;
      acceptsVolunteerSessions?: boolean | null;
    } | null;
    performanceStats?: {
      completedSessionCount?: number | null;
      averageRating?: number | null;
    } | null;
  } | null;
}