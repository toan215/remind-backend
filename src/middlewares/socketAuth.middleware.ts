import jwt from 'jsonwebtoken';
import type { AuthTokenPayload } from '../types/common';
import type { SocketAuthData } from '../types/chat.types';

const getAccessTokenSecret = (): string => process.env.JWT_SECRET || 'fallback_secret';

export const verifySocketToken = (token: string): SocketAuthData | null => {
  try {
    const decoded = jwt.verify(token, getAccessTokenSecret()) as AuthTokenPayload;
    if (decoded.tokenType !== 'access') return null;
    return {
      userId: decoded.id,
      role: decoded.role,
      status: decoded.status || 'active',
      fullName: decoded.fullName,
    };
  } catch {
    return null;
  }
};
