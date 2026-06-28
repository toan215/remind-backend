# Forum API Knowledge Base for AI Integration

**Purpose:** This document is explicitly written for AI agents and UI generators to understand the exact JSON request/response shapes, database behaviors, and authorization rules for the ReMind Forum.

## Architecture Notes
- **Display Mode:** `authorDisplayMode` strictly uses numbers: `0` = Real Name, `1` = Anonymous.
- **Separation of Concerns:** Moderation (Admin) APIs are separated from User APIs. This enforces strict security boundaries via `requireRole('admin')` middleware.
- **Data Safety:** Public routes automatically hide private fields like `authorId` and only expose `publicAuthorName`. Deletions are "soft deletes" (changing `status` to `deleted` or `isActive` to `false`) to preserve moderation and audit history.
- **Global Posts:** Post creation and retrieval are global. The backend automatically manages or defaults the associated forum under the hood.

---

## 🟢 1. Public / Guest APIs (No Auth Required)

### 1.1 List Active Forums
*   **Route:** `GET /api/forums`
*   **Query Parameters:**
    *   `limit` (number, optional, default: 20)
    *   `cursor` (string, optional) - cursor pagination ID.
*   **Response (200 OK):**
```json
{
  "forums": [
    {
      "_id": "60d5ec...",
      "title": "General Support",
      "description": "General discussions about mental health.",
      "category": "General",
      "isActive": true,
      "createdAt": "2026-06-14T10:00:00.000Z",
      "updatedAt": "2026-06-14T10:00:00.000Z"
    }
  ],
  "nextCursor": "60d5ec...",
  "hasNext": false
}
```

### 1.2 List Active Posts Globally
*   **Route:** `GET /api/forums/posts`
*   **Query Parameters:**
    *   `limit` (number, optional, default: 10)
    *   `cursor` (string, optional) - cursor pagination ID.
*   **Response (200 OK):**
```json
{
  "posts": [
    {
      "_id": "60d5fa...",
      "forumId": "60d5ec...",
      "title": "How to handle exam stress?",
      "content": "I have finals coming up and I am panicking...",
      "tags": ["stress", "exams"],
      "publicAuthorName": "Anonymous",
      "authorDisplayMode": 1,
      "status": "active",
      "likeCount": 5,
      "commentCount": 2,
      "createdAt": "2026-06-14T10:30:00.000Z",
      "updatedAt": "2026-06-14T10:30:00.000Z"
    }
  ],
  "nextCursor": "60d5fa...",
  "hasNext": false
}
```

### 1.3 Get Post Detail & Comments
*   **Route:** `GET /api/forums/posts/:postId`
*   **Response (200 OK):**
```json
{
  "post": {
    "_id": "60d5fa...",
    "forumId": "60d5ec...",
    "title": "How to handle exam stress?",
    "content": "I have finals coming up and I am panicking...",
    "tags": ["stress", "exams"],
    "publicAuthorName": "Anonymous",
    "authorDisplayMode": 1,
    "status": "active",
    "likeCount": 5,
    "commentCount": 1
  },
  "comments": [
    {
      "_id": "60d5fb...",
      "postId": "60d5fa...",
      "parentId": null,
      "content": "Take deep breaths. You can do this!",
      "publicAuthorName": "Dr. Sarah",
      "authorDisplayMode": 0,
      "status": "active",
      "likeCount": 2,
      "createdAt": "2026-06-14T10:45:00.000Z"
    }
  ]
}
```

### 1.4 Search Posts
*   **Route:** `GET /api/forums/search?q=stress`
*   **Response (200 OK):**
```json
{
  "posts": [
    {
      "_id": "60d5fa...",
      "forumId": "60d5ec...",
      "title": "How to handle exam stress?",
      "content": "I have finals coming up and I am panicking...",
      "tags": ["stress", "exams"],
      "publicAuthorName": "Anonymous",
      "authorDisplayMode": 1,
      "status": "active",
      "likeCount": 5,
      "commentCount": 2,
      "createdAt": "2026-06-14T10:30:00.000Z",
      "updatedAt": "2026-06-14T10:30:00.000Z"
    }
  ]
}
```

---

## 🔵 2. User APIs (Auth Required: Bearer Token)

### 2.1 Create a Post
*   **Route:** `POST /api/forums/posts`
*   **Request JSON:**
```json
{
  "title": "Need advice on sleep",
  "content": "I haven't been sleeping well lately.",
  "tags": ["sleep", "health"],
  "authorDisplayMode": 1
}
```
*   **Response (201 Created):**
```json
{
  "post": {
    "_id": "60d5fc...",
    "forumId": "60d5ec...",
    "title": "Need advice on sleep",
    "content": "I haven't been sleeping well lately.",
    "tags": ["sleep", "health"],
    "publicAuthorName": "Anonymous",
    "authorDisplayMode": 1,
    "status": "active",
    "commentCount": 0
  }
}
```
*Note: The backend automatically maps the post to the first active forum or a default one if none are active.*

### 2.2 Edit Own Post
*   **Route:** `PATCH /api/forums/posts/:postId`
*   **Request JSON (All fields optional):**
```json
{
  "title": "Need advice on sleep (Updated)",
  "content": "I haven't been sleeping well for 3 weeks now.",
  "tags": ["sleep", "health", "insomnia"],
  "authorDisplayMode": 0
}
```
*   **Response (200 OK):**
```json
{
  "message": "Post updated successfully",
  "post": {
     "_id": "60d5fc...",
     "title": "Need advice on sleep (Updated)",
     "publicAuthorName": "John Doe",
     "authorDisplayMode": 0,
     "content": "I haven't been sleeping well for 3 weeks now."
  }
}
```

### 2.3 Delete Own Post
*   **Route:** `DELETE /api/forums/posts/:postId`
*   **Response (200 OK):**
```json
{
  "message": "Post deleted successfully",
  "post": {
    "_id": "60d5fc...",
    "status": "deleted"
  }
}
```

### 2.4 Create a Comment
*   **Route:** `POST /api/forums/posts/:postId/comments`
*   **Request JSON:**
```json
{
  "content": "Try avoiding screens an hour before bed.",
  "authorDisplayMode": 0,
  "parentId": "60d5fb..."
}
```
*Note: `parentId` is optional, used for nesting comment replies.*
*   **Response (201 Created):**
```json
{
  "comment": {
    "_id": "60d5fd...",
    "postId": "60d5fc...",
    "parentId": "60d5fb...",
    "content": "Try avoiding screens an hour before bed.",
    "publicAuthorName": "John Doe",
    "authorDisplayMode": 0,
    "status": "active"
  }
}
```

### 2.5 Edit Own Comment
*   **Route:** `PATCH /api/forums/comments/:commentId`
*   **Request JSON:**
```json
{
  "content": "Try reading a book instead of screens before bed.",
  "authorDisplayMode": 1
}
```
*   **Response (200 OK):**
```json
{
  "message": "Comment updated successfully",
  "comment": {
    "_id": "60d5fd...",
    "content": "Try reading a book instead of screens before bed.",
    "publicAuthorName": "Anonymous",
    "authorDisplayMode": 1
  }
}
```

### 2.6 Delete Own Comment
*   **Route:** `DELETE /api/forums/comments/:commentId`
*   **Response (200 OK):**
```json
{
  "message": "Comment deleted successfully",
  "comment": {
    "_id": "60d5fd...",
    "status": "deleted"
  }
}
```

### 2.7 Toggle Like
*   **Route:** `POST /api/forums/posts/:postId/like`
*   **Response (200 OK):**
```json
{
  "message": "Toggle like successful",
  "post": {
    "_id": "60d5fc...",
    "title": "Need advice on sleep",
    "publicAuthorName": "Anonymous",
    "authorDisplayMode": 1,
    "likeCount": 1,
    "likedBy": ["user123..."]
  }
}
```

---

## 🔴 3. Admin APIs (Auth Required: Bearer Token + 'admin' role)

### 3.1 Create Forum Section
*   **Route:** `POST /api/admin/forums`
*   **Request JSON:**
```json
{
  "title": "Anxiety Support",
  "description": "A safe space to discuss anxiety.",
  "category": "Anxiety",
  "isActive": true
}
```
*   **Response (201 Created):**
```json
{
  "message": "Forum created successfully",
  "forum": {
    "_id": "60d5fe...",
    "title": "Anxiety Support",
    "description": "A safe space to discuss anxiety.",
    "category": "Anxiety",
    "isActive": true,
    "createdByAdminId": "admin123..."
  }
}
```

### 3.2 Edit Forum Section
*   **Route:** `PATCH /api/admin/forums/:forumId`
*   **Request JSON (All fields optional):**
```json
{
  "title": "Anxiety & Panic Support",
  "isActive": false
}
```
*   **Response (200 OK):**
```json
{
  "message": "Forum updated successfully",
  "forum": {
    "_id": "60d5fe...",
    "title": "Anxiety & Panic Support",
    "isActive": false
  }
}
```

### 3.3 Delete Forum Section
*   **Route:** `DELETE /api/admin/forums/:forumId`
*   **Response (200 OK):**
```json
{
  "message": "Forum deleted successfully",
  "forum": {
    "_id": "60d5fe...",
    "isActive": false
  }
}
```

### 3.4 Delete Any Post (Moderation)
*   **Route:** `DELETE /api/admin/forums/posts/:postId`
*   **Response (200 OK):**
```json
{
  "message": "Post deleted successfully",
  "post": {
    "_id": "60d5fa...",
    "status": "deleted"
  }
}
```

### 3.5 Delete Any Comment (Moderation)
*   **Route:** `DELETE /api/admin/forums/comments/:commentId`
*   **Response (200 OK):**
```json
{
  "message": "Comment deleted successfully",
  "comment": {
    "_id": "60d5fb...",
    "status": "deleted"
  }
}
```