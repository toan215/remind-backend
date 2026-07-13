# Chat API Overview

This document outlines the API routes for the ReMind Chat features. For detailed AI/UI integration payloads, see `docs/agents/chat-api-knowledge.md`.

## Room Types
- `direct`: 1:1 chat between student and expert (requires existing appointment)
- `group`: Multi-participant chat room

## Display Mode Convention
- (not applicable to chat — real names always visible to participants)

---

## 1. REST Endpoints (Authentication + Active Account Required)

| Method | Path | Description |
|---|---|---|
| POST | /api/chats | Create a chat room (type `direct` requires `appointmentId` + `participantId`) |
| GET | /api/chats | List user's active chat rooms |
| GET | /api/chats/:id | Get room detail |
| GET | /api/chats/:id/messages | Cursor-paginated message history (`?cursor=&limit=`) |
| POST | /api/chats/:id/invite | Invite a user to a group chat |
| PATCH | /api/chats/:id/leave | Leave a chat room |
| GET | /api/chats/invitations | List user's pending invitations |
| PATCH | /api/chats/invitations/:invitationId/accept | Accept an invitation |
| PATCH | /api/chats/invitations/:invitationId/reject | Reject an invitation |

---

## 2. Socket.io Events (JWT Auth via handshake.auth.token)

### Client → Server
| Event | Payload | Description |
|---|---|---|
| `chat:join` | `{ roomId }` | Join a chat room |
| `chat:leave` | `{ roomId }` | Leave a chat room |
| `chat:message` | `{ roomId, text, type? }` | Send a message |
| `chat:typing` | `{ roomId, isTyping }` | Typing indicator |
| `chat:read` | `{ roomId, messageIds[] }` | Mark messages as read |

### Server → Client
| Event | Payload | Description |
|---|---|---|
| `chat:message` | `ChatMessage` document | Broadcast new message to all in room |
| `chat:typing` | `{ roomId, userId, isTyping }` | Typing status |
| `chat:read` | `{ roomId, userId, messageIds[] }` | Read receipts |
| `chat:error` | `{ code, message }` | Error feedback |
