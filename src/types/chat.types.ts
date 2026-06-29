export type ChatRoomType = 'direct' | 'group';
export type ChatRoomStatus = 'active' | 'closed' | 'archived';
export type ParticipantStatus = 'active' | 'removed';
export type ChatMessageType = 'text' | 'image' | 'file' | 'system';
export type ChatMessageStatus = 'active' | 'hidden' | 'deleted';
export type InvitationStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';

export interface ChatRoomParticipant {
  userId: string;
  role: string;
  status: ParticipantStatus;
  joinedAt: Date;
}

export interface ServerToClientEvents {
  'chat:message': (msg: any) => void;
  'chat:typing': (data: { roomId: string; userId: string; isTyping: boolean }) => void;
  'chat:read': (data: { roomId: string; userId: string; messageIds: string[] }) => void;
  'chat:error': (data: { code: string; message: string }) => void;
  'group:message': (msg: any) => void;
  'group:typing': (data: { groupId: string; userId: string; isTyping: boolean }) => void;
  'group:error': (data: { code: string; message: string }) => void;
}

export interface ClientToServerEvents {
  'chat:join': (data: { roomId: string }) => void;
  'chat:leave': (data: { roomId: string }) => void;
  'chat:message': (data: { roomId: string; text: string; type?: ChatMessageType }) => void;
  'chat:typing': (data: { roomId: string; isTyping: boolean }) => void;
  'chat:read': (data: { roomId: string; messageIds: string[] }) => void;
  'group:join': (data: { groupId: string }) => void;
  'group:leave': (data: { groupId: string }) => void;
  'group:message': (data: { groupId: string; content: string }) => void;
  'group:typing': (data: { groupId: string; isTyping: boolean }) => void;
}

export interface SocketAuthData {
  userId: string;
  role: string;
  status: string;
  fullName?: string;
}
