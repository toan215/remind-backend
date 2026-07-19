import type { RequestHandler } from 'express';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { createHash } from 'crypto';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../models/user.model';
import Notification from '../models/notification.model';
import type { AuthTokenPayload, UserRole, UserStatus } from '../types/common';
import Otp from '../models/otp.model';
import { sendMail } from '../utils/email.service';
import { uploadToCloudinary } from '../services/cloudinary.service';

interface RegisterBody {
  email?: unknown;
  password?: unknown;
  fullName?: unknown;
  role?: unknown;
}

interface LoginBody {
  email?: unknown;
  identifier?: unknown;
  password?: unknown;
}

interface RefreshBody {
  refreshToken?: unknown;
}

interface ForgotPasswordBody {
  email?: unknown;
}

interface ResetPasswordBody {
  email?: unknown;
  otp?: unknown;
  newPassword?: unknown;
}

const ACCESS_TOKEN_EXPIRES_IN = '15m';
const REFRESH_TOKEN_EXPIRES_IN = '7d';

const getAccessTokenSecret = (): string => process.env.JWT_SECRET || 'fallback_secret';
const getRefreshTokenSecret = (): string => process.env.REFRESH_TOKEN_SECRET || getAccessTokenSecret();

const isString = (value: unknown): value is string => typeof value === 'string';

const normalizeEmail = (value: unknown): string => (isString(value) ? value.trim().toLowerCase() : '');

const normalizeName = (value: unknown): string => (isString(value) ? value.trim() : '');

const digestToken = (value: string): string => createHash('sha256').update(value).digest('hex');

const buildTokenPayload = (user: {
  _id: mongoose.Types.ObjectId;
  role: UserRole;
  status: UserStatus;
  fullName?: string | null;
}): AuthTokenPayload => ({
  id: user._id.toString(),
  role: user.role,
  status: user.status,
  tokenType: 'access',
  jti: randomUUID(),
  ...(typeof user.fullName === 'string' && user.fullName.trim() ? { fullName: user.fullName.trim() } : {}),
});

const buildRefreshTokenPayload = (user: {
  _id: mongoose.Types.ObjectId;
  role: UserRole;
  status: UserStatus;
  fullName?: string | null;
}): AuthTokenPayload => ({
  id: user._id.toString(),
  role: user.role,
  status: user.status,
  tokenType: 'refresh',
  jti: randomUUID(),
  ...(typeof user.fullName === 'string' && user.fullName.trim() ? { fullName: user.fullName.trim() } : {}),
});

const buildSafeUserDto = (user: any) => ({
  id: user._id.toString(),
  email: user.email,
  ...(typeof user.fullName === 'string' && user.fullName.trim() ? { fullName: user.fullName.trim() } : {}),
  role: user.role,
  status: user.status,
  avatar: user.avatar || "",
  isAnonymous: !!user.isAnonymous,
});

const issueTokenPair = async (user: {
  _id: mongoose.Types.ObjectId;
  email: string;
  fullName?: string | null;
  role: UserRole;
  status: UserStatus;
}): Promise<{ accessToken: string; refreshToken: string }> => {
  const accessToken = jwt.sign(buildTokenPayload(user), getAccessTokenSecret(), {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  });
  const refreshToken = jwt.sign(buildRefreshTokenPayload(user), getRefreshTokenSecret(), {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
  });

  return { accessToken, refreshToken };
};

const storeRefreshToken = async (userId: mongoose.Types.ObjectId, refreshToken: string): Promise<void> => {
  const hashedRefreshToken = await bcrypt.hash(digestToken(refreshToken), 12);
  await User.updateOne({ _id: userId }, { $set: { refreshToken: hashedRefreshToken } });
};

const getUserByRefreshToken = async (refreshToken: string) => {
  const decoded = jwt.verify(refreshToken, getRefreshTokenSecret()) as AuthTokenPayload;
  if (decoded.tokenType !== 'refresh') {
    return null;
  }

  const user = await User.findById(decoded.id).select('+refreshToken');
  if (!user || !user.refreshToken) {
    return null;
  }

  const isMatch = await bcrypt.compare(digestToken(refreshToken), user.refreshToken);
  if (!isMatch) {
    return null;
  }

  return user;
};

const isDuplicateEmailError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  return 'code' in error && (error as { code?: number }).code === 11000;
};

export const register: RequestHandler<{}, unknown, RegisterBody> = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = isString(req.body.password) ? req.body.password : '';
    const fullName = normalizeName(req.body.fullName);
    const requestedRole = isString(req.body.role) ? req.body.role : undefined;

    if (!email || !password || !fullName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (requestedRole && !['student', 'expert'].includes(requestedRole)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const role = (requestedRole || 'student') as 'student' | 'expert';
    const status: UserStatus = role === 'expert' ? 'pending' : 'active';

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      email,
      password: hashedPassword,
      fullName,
      role,
      status,
    });

    if (role === 'expert') {
      const io = req.app.get('io');
      try {
        io.emit('admin:new-expert', {
          expertId: user._id.toString(),
          fullName: user.fullName,
          email: user.email,
        });
      } catch (error) {
        console.error('Failed to emit new expert notification:', error);
      }

      void (async () => {
        try {
          const admins = await User.find({ role: 'admin' }).select('_id');
          await Notification.insertMany(
            admins.map((admin) => ({
              recipient: admin._id,
              type: 'NEW_EXPERT',
              content: `Chuyên gia mới đăng ký: ${user.fullName}`,
              referenceId: user._id,
              isRead: false,
            }))
          );
        } catch (error) {
          console.error('Failed to create new expert notifications:', error);
        }
      })();
    }

    const { accessToken, refreshToken } = await issueTokenPair(user);
    await storeRefreshToken(user._id, refreshToken);

    return res.status(201).json({
      user: buildSafeUserDto(user),
      accessToken,
      refreshToken,
    });
  } catch (error) {
    if (isDuplicateEmailError(error)) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    console.error('Register error:', error);
    return res.status(500).json({ error: 'Failed to register user' });
  }
};

export const login: RequestHandler<{}, unknown, LoginBody> = async (req, res) => {
  try {
    const idField = req.body.identifier || req.body.email;
    const identifier = isString(idField) ? idField.trim() : '';
    const password = isString(req.body.password) ? req.body.password : '';

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Email/Tên đăng nhập và mật khẩu là bắt buộc' });
    }

    const isEmail = identifier.includes('@');

    let user;
    if (isEmail) {
      user = await User.findOne({ email: identifier.toLowerCase() }).select('+password');
    } else {
      // Find by exact fullName if it's not an email
      user = await User.findOne({ fullName: identifier }).select('+password');
    }

    if (!user || !user.password) {
      return res.status(401).json({ error: 'Thông tin đăng nhập không hợp lệ' });
    }

    if (user.status === 'banned' || user.status === 'rejected') {
      return res.status(403).json({ error: 'Account is blocked' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Thông tin đăng nhập không hợp lệ' });
    }

    const { accessToken, refreshToken } = await issueTokenPair(user);
    await storeRefreshToken(user._id, refreshToken);

    return res.status(200).json({
      user: buildSafeUserDto(user),
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Failed to log in' });
  }
};

export const refresh: RequestHandler<{}, unknown, RefreshBody> = async (req, res) => {
  try {
    const refreshToken = isString(req.body.refreshToken) ? req.body.refreshToken : '';

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    const user = await getUserByRefreshToken(refreshToken);

    if (!user) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    if (user.status === 'banned' || user.status === 'rejected') {
      return res.status(403).json({ error: 'Account is blocked' });
    }

    const { accessToken, refreshToken: nextRefreshToken } = await issueTokenPair(user);
    await storeRefreshToken(user._id, nextRefreshToken);

    return res.status(200).json({
      user: buildSafeUserDto(user),
      accessToken,
      refreshToken: nextRefreshToken,
    });
  } catch (error) {
    console.error('Refresh error:', error);
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
};

interface GoogleLoginBody {
  googleToken?: unknown;
}

interface GoogleUserInfo {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
}

const getGoogleUserInfo = async (accessToken: string): Promise<GoogleUserInfo> => {
  const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error('Invalid Google token');
  }
  const data = await response.json() as GoogleUserInfo;
  if (!data.email) {
    throw new Error('Google account has no email');
  }
  return data;
};

const uploadGoogleAvatarToCloudinary = async (pictureUrl: string): Promise<string> => {
  try {
    const response = await fetch(pictureUrl);
    if (!response.ok) return '';
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return await uploadToCloudinary(buffer, 'avatars');
  } catch (error) {
    console.error('Failed to upload Google avatar to Cloudinary:', error);
    return pictureUrl; // fallback to original google url
  }
};

export const googleLogin: RequestHandler<{}, unknown, GoogleLoginBody> = async (req, res) => {
  try {
    const googleToken = isString(req.body.googleToken) ? req.body.googleToken : '';
    if (!googleToken) {
      return res.status(400).json({ error: 'Google token is required' });
    }

    const info = await getGoogleUserInfo(googleToken);

    const email = info.email.toLowerCase();
    const fullName = info.name?.trim() || email.split('@')[0];
    const googleId = info.sub;

    let user = await User.findOne({ email });
    if (user) {
      if (user.status === 'banned' || user.status === 'rejected') {
        return res.status(403).json({ error: 'Account is blocked' });
      }
      const updateData: any = {};
      if (!user.googleId) {
        updateData.googleId = googleId;
      }
      const hasGoogleAvatar = user.avatar && user.avatar.includes('googleusercontent.com');
      if ((!user.avatar || hasGoogleAvatar) && info.picture) {
        const cloudinaryUrl = await uploadGoogleAvatarToCloudinary(info.picture);
        if (cloudinaryUrl) {
          updateData.avatar = cloudinaryUrl;
        }
      }
      if (Object.keys(updateData).length > 0) {
        user = await User.findByIdAndUpdate(user._id, { $set: updateData }, { new: true }) as typeof user;
      }
    } else {
      let cloudinaryUrl = '';
      if (info.picture) {
        cloudinaryUrl = await uploadGoogleAvatarToCloudinary(info.picture);
      }
      user = await User.create({
        email,
        fullName,
        googleId,
        role: 'student',
        status: 'active',
        avatar: cloudinaryUrl,
      });
    }

    const { accessToken, refreshToken } = await issueTokenPair(user);
    await storeRefreshToken(user._id, refreshToken);

    return res.status(200).json({
      user: buildSafeUserDto(user),
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error('Google login error:', error);
    return res.status(401).json({ error: 'Invalid Google token' });
  }
};

export const logout: RequestHandler<{}, unknown, RefreshBody> = async (req, res) => {
  try {
    const refreshToken = isString(req.body.refreshToken) ? req.body.refreshToken : '';

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    try {
      const user = await getUserByRefreshToken(refreshToken);
      if (user) {
        await User.updateOne({ _id: user._id }, { $unset: { refreshToken: '' } });
      }
    } catch (err) {
      console.log('Logout token validation skipped/failed:', err);
    }

    return res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(200).json({ message: 'Logged out successfully' });
  }
};

export const forgotPassword: RequestHandler<{}, unknown, ForgotPasswordBody> = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // 1. Kiểm tra user tồn tại
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'Email does not exist' });
    }

    // 2. Tạo mã OTP gồm 6 chữ số ngẫu nhiên
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 phút

    // 3. Lưu OTP vào DB (cập nhật nếu đã tồn tại bản ghi cùng email)
    await Otp.findOneAndUpdate(
      { email },
      { otp, expiresAt },
      { upsert: true, new: true }
    );

    // 4. Gửi email chứa OTP
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #4f46e5; text-align: center;">Yêu Cầu Đặt Lại Mật Khẩu</h2>
        <p>Xin chào <strong>${user.fullName || 'Người dùng'}</strong>,</p>
        <p>Chúng tôi nhận được yêu cầu khôi phục mật khẩu cho tài khoản ReMind AI của bạn. Vui lòng sử dụng mã OTP dưới đây để hoàn tất quá trình đặt lại mật khẩu:</p>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; text-align: center; margin: 20px 0;">
          <span style="font-size: 28px; font-weight: bold; letter-spacing: 5px; color: #1f2937;">${otp}</span>
        </div>
        <p style="color: #ef4444; font-size: 14px;">Lưu ý: Mã OTP này có giá trị trong vòng 10 phút. Không chia sẻ mã này với bất kỳ ai.</p>
        <hr style="border: 0; border-top: 1px solid #e0e0e0; margin: 20px 0;" />
        <p style="font-size: 12px; color: #9ca3af; text-align: center;">Đây là email tự động từ hệ thống ReMind AI. Vui lòng không trả lời email này.</p>
      </div>
    `;

    await sendMail({
      to: email,
      subject: '[ReMind AI] Mã OTP xác nhận khôi phục mật khẩu',
      html: htmlContent
    });

    return res.status(200).json({ message: 'OTP sent successfully' });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ error: 'Failed to process forgot password request' });
  }
};

export const resetPassword: RequestHandler<{}, unknown, ResetPasswordBody> = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const otp = isString(req.body.otp) ? req.body.otp.trim() : '';
    const newPassword = isString(req.body.newPassword) ? req.body.newPassword : '';

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ error: 'Email, OTP and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // 1. Kiểm tra OTP
    const otpRecord = await Otp.findOne({ email });
    if (!otpRecord) {
      return res.status(400).json({ error: 'OTP has expired or is invalid' });
    }

    if (otpRecord.otp !== otp) {
      return res.status(400).json({ error: 'Invalid OTP code' });
    }

    if (otpRecord.expiresAt < new Date()) {
      await Otp.deleteOne({ _id: otpRecord._id });
      return res.status(400).json({ error: 'OTP code has expired' });
    }

    // 2. Tìm user và cập nhật mật khẩu mới
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await User.updateOne({ _id: user._id }, { $set: { password: hashedPassword } });

    // 3. Xóa OTP sau khi sử dụng thành công
    await Otp.deleteOne({ _id: otpRecord._id });

    return res.status(200).json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ error: 'Failed to reset password' });
  }
};
