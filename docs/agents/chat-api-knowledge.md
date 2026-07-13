# Chat API Knowledge Base for AI Integration

**Purpose:** This document is explicitly written for AI agents and UI generators to understand the exact JSON request/response shapes, database behaviors, and authorization rules for the ReMind Chat feature.

## Architecture Notes
- **Auth Gate:** All chat REST routes use `requireAuth` + `requireActiveUser`. Pending, rejected, banned, or otherwise inactive users receive `403`.
- **Chat Domains:** Standalone chat uses `ChatRoom`, `ChatMessage`, and `ChatInvitation`. Forum group discussion uses `ForumGroup`, `ForumGroupMember`, and `ForumGroupMessage` over Socket.io.
- **No Anonymous Display:** Chat and forum group messages always show real names / live display names; there is no anonymous display mode.
- **Room Creation:** `POST /api/chats` supports `direct` and `group`. Direct rooms are tied to an existing appointment and return the existing active room if one already exists for that appointment.
- **Data Safety:** Null fields are omitted. Message history is cursor-paginated by `_id` in descending order.

---

## 🟢 1. Standalone Chat REST APIs

### 1.1 Create a Chat Room
*   **Route:** `POST /api/chats`
*   **Request JSON (direct room):**
```json
{
  "type": "direct",
  "participantId": "66a111111111111111111111",
  "appointmentId": "66a222222222222222222222"
}
```
*   **Request JSON (group room):**
```json
{
  "type": "group"
}
```
*   `type` must be `direct` or `group`.
*   For `direct`, `participantId` and `appointmentId` are required.
*   If an active direct room already exists for the appointment, the API returns it with `200 OK` instead of creating a duplicate.
*   **Response (201 Created, new direct room):**
```json
{
  "room": {
    "_id": "66a333333333333333333333",
    "type": "direct",
    "appointmentId": "66a222222222222222222222",
    "createdBy": "66a444444444444444444444",
    "participants": [
      {
        "userId": "66a444444444444444444444",
        "role": "student",
        "status": "active",
        "joinedAt": "2026-06-29T09:00:00.000Z"
      },
      {
        "userId": "66a111111111111111111111",
        "role": "expert",
        "status": "active",
        "joinedAt": "2026-06-29T09:00:00.000Z"
      }
    ],
    "status": "active",
    "createdAt": "2026-06-29T09:00:00.000Z",
    "updatedAt": "2026-06-29T09:00:00.000Z"
  }
}
```
*   **Response (201 Created, new group room):**
```json
{
  "room": {
    "_id": "66a555555555555555555555",
    "type": "group",
    "createdBy": "66a444444444444444444444",
    "participants": [
      {
        "userId": "66a444444444444444444444",
        "role": "student",
        "status": "active",
        "joinedAt": "2026-06-29T09:00:00.000Z"
      }
    ],
    "status": "active",
    "createdAt": "2026-06-29T09:00:00.000Z",
    "updatedAt": "2026-06-29T09:00:00.000Z"
  }
}
```

### 1.2 List User's Active Chat Rooms
*   **Route:** `GET /api/chats`
*   **Response (200 OK):**
```json
{
  "rooms": [
    {
      "_id": "66a333333333333333333333",
      "type": "direct",
      "appointmentId": "66a222222222222222222222",
      "createdBy": "66a444444444444444444444",
      "participants": [
        {
          "userId": "66a444444444444444444444",
          "role": "student",
          "status": "active",
          "joinedAt": "2026-06-29T09:00:00.000Z"
        },
        {
          "userId": "66a111111111111111111111",
          "role": "expert",
          "status": "active",
          "joinedAt": "2026-06-29T09:00:00.000Z"
        }
      ],
      "status": "active",
      "lastMessage": {
        "text": "See you at 3 PM",
        "senderId": "66a444444444444444444444",
        "sentAt": "2026-06-29T09:20:00.000Z"
      },
      "createdAt": "2026-06-29T09:00:00.000Z",
      "updatedAt": "2026-06-29T09:20:00.000Z"
    }
  ]
}
```

### 1.3 Get Room Detail
*   **Route:** `GET /api/chats/:id`
*   **Response (200 OK):**
```json
{
  "room": {
    "_id": "66a333333333333333333333",
    "type": "direct",
    "appointmentId": "66a222222222222222222222",
    "createdBy": "66a444444444444444444444",
    "participants": [
      {
        "userId": "66a444444444444444444444",
        "role": "student",
        "status": "active",
        "joinedAt": "2026-06-29T09:00:00.000Z"
      }
    ],
    "status": "active",
    "createdAt": "2026-06-29T09:00:00.000Z",
    "updatedAt": "2026-06-29T09:20:00.000Z"
  }
}
```

### 1.4 Get Message History
*   **Route:** `GET /api/chats/:id/messages`
*   **Query Parameters:**
    *   `limit` (number, optional, default: 50, max: 100)
    *   `cursor` (string, optional) - last message `_id` from the previous page.
*   **Pagination Rule:** Results are sorted by `_id` descending. If `cursor` is set, the next page returns messages with `_id < cursor`.
*   **Response (200 OK):**
```json
{
  "messages": [
    {
      "_id": "66a666666666666666666666",
      "chatRoomId": "66a333333333333333333333",
      "senderId": "66a444444444444444444444",
      "senderRole": "student",
      "messageType": "text",
      "text": "See you at 3 PM",
      "readBy": ["66a444444444444444444444"],
      "status": "active",
      "createdAt": "2026-06-29T09:20:00.000Z",
      "updatedAt": "2026-06-29T09:20:00.000Z"
    }
  ],
  "nextCursor": "66a666666666666666666666",
  "hasNext": false
}
```

### 1.5 Invite a User to a Group Chat
*   **Route:** `POST /api/chats/:id/invite`
*   **Request JSON:**
```json
{
  "invitedUserId": "66a777777777777777777777"
}
```
*   Only active room members can invite. The room must be `group` type.
*   **Response (201 Created):**
```json
{
  "invitation": {
    "_id": "66a888888888888888888888",
    "chatRoomId": "66a555555555555555555555",
    "invitedUserId": "66a777777777777777777777",
    "invitedBy": "66a444444444444444444444",
    "invitedByRole": "student",
    "status": "pending",
    "createdAt": "2026-06-29T09:25:00.000Z",
    "updatedAt": "2026-06-29T09:25:00.000Z"
  }
}
```

### 1.6 Leave a Chat Room
*   **Route:** `PATCH /api/chats/:id/leave`
*   **Response (200 OK):**
```json
{
  "message": "Left the room"
}
```

### 1.7 List Pending Invitations
*   **Route:** `GET /api/chats/invitations`
*   **Response (200 OK):**
```json
{
  "invitations": [
    {
      "_id": "66a888888888888888888888",
      "chatRoomId": "66a555555555555555555555",
      "invitedUserId": "66a777777777777777777777",
      "invitedBy": "66a444444444444444444444",
      "invitedByRole": "student",
      "status": "pending",
      "createdAt": "2026-06-29T09:25:00.000Z",
      "updatedAt": "2026-06-29T09:25:00.000Z"
    }
  ]
}
```

### 1.8 Accept an Invitation
*   **Route:** `PATCH /api/chats/invitations/:invitationId/accept`
*   **Response (200 OK):**
```json
{
  "invitation": {
    "_id": "66a888888888888888888888",
    "chatRoomId": "66a555555555555555555555",
    "invitedUserId": "66a777777777777777777777",
    "invitedBy": "66a444444444444444444444",
    "invitedByRole": "student",
    "status": "accepted",
    "respondedAt": "2026-06-29T09:30:00.000Z",
    "createdAt": "2026-06-29T09:25:00.000Z",
    "updatedAt": "2026-06-29T09:30:00.000Z"
  },
  "systemMessage": {
    "_id": "66a999999999999999999999",
    "chatRoomId": "66a555555555555555555555",
    "senderId": "66a777777777777777777777",
    "senderRole": "system",
    "messageType": "system",
    "text": "A user joined the chat",
    "readBy": [],
    "status": "active",
    "createdAt": "2026-06-29T09:30:00.000Z",
    "updatedAt": "2026-06-29T09:30:00.000Z"
  }
}
```

### 1.9 Reject an Invitation
*   **Route:** `PATCH /api/chats/invitations/:invitationId/reject`
*   **Response (200 OK):**
```json
{
  "invitation": {
    "_id": "66a888888888888888888888",
    "chatRoomId": "66a555555555555555555555",
    "invitedUserId": "66a777777777777777777777",
    "invitedBy": "66a444444444444444444444",
    "invitedByRole": "student",
    "status": "rejected",
    "respondedAt": "2026-06-29T09:31:00.000Z",
    "createdAt": "2026-06-29T09:25:00.000Z",
    "updatedAt": "2026-06-29T09:31:00.000Z"
  }
}
```

---

---

## 🔴 3. Standalone Chat Socket.io APIs

### 3.1 Join a Chat Room
*   **Client Event:** `chat:join`
*   **Payload:**
```json
{
  "roomId": "66a333333333333333333333"
}
```

### 3.2 Leave a Chat Room
*   **Client Event:** `chat:leave`
*   **Payload:**
```json
{
  "roomId": "66a333333333333333333333"
}
```

### 3.3 Send a Chat Message
*   **Client Event:** `chat:message`
*   **Payload:**
```json
{
  "roomId": "66a333333333333333333333",
  "text": "I can join at 3 PM.",
  "type": "text"
}
```
*   `type` is optional. Supported values follow `ChatMessage.messageType`: `text`, `image`, `file`, `system`.
*   **Server Broadcast (`chat:message`):**
```json
{
  "_id": "66ad22222222222222222222",
  "chatRoomId": "66a333333333333333333333",
  "senderId": "66a444444444444444444444",
  "senderRole": "student",
  "messageType": "text",
  "text": "I can join at 3 PM.",
  "readBy": ["66a444444444444444444444"],
  "status": "active",
  "createdAt": "2026-06-29T09:45:00.000Z",
  "updatedAt": "2026-06-29T09:45:00.000Z"
}
```

### 3.4 Typing Indicator
*   **Client Event:** `chat:typing`
*   **Payload:**
```json
{
  "roomId": "66a333333333333333333333",
  "isTyping": true
}
```
*   **Server Broadcast (`chat:typing`):**
```json
{
  "roomId": "66a333333333333333333333",
  "userId": "66a444444444444444444444",
  "isTyping": true
}
```

### 3.5 Read Receipts
*   **Client Event:** `chat:read`
*   **Payload:**
```json
{
  "roomId": "66a333333333333333333333",
  "messageIds": [
    "66ad22222222222222222222",
    "66ad33333333333333333333"
  ]
}
```
*   **Server Broadcast (`chat:read`):**
```json
{
  "roomId": "66a333333333333333333333",
  "userId": "66a444444444444444444444",
  "messageIds": [
    "66ad22222222222222222222",
    "66ad33333333333333333333"
  ]
}
```

### 3.6 Chat Errors
*   **Server Event:** `chat:error`
*   **Payload:**
```json
{
  "code": "NOT_MEMBER",
  "message": "You are not a participant of this room"
}
```
