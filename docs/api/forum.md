# Forum API Overview

This document outlines the API routes for the ReMind Forum features. For detailed AI/UI integration payloads, see `docs/agents/forum-api-knowledge.md`.

## Display Mode Convention
- `authorDisplayMode`: `0` = Real Name, `1` = Anonymous

---

## 1. Public / Guest API (No Authentication Required)
- `GET /api/forums` - List active main forum sections (supports cursor-based pagination).
- `GET /api/forums/posts` - List active posts globally (supports cursor-based pagination).
- `GET /api/forums/posts/:postId` - Get post details and its active comments.
- `GET /api/forums/search?q=...` - Full-text search across active posts.

---

## 2. User API (Authentication + Active Account Required)
- `POST /api/forums/posts` - Create a new post (**required** `forumId` in body; validates forum exists and is active).
- `PATCH /api/forums/posts/:postId` - Edit own post.
- `DELETE /api/forums/posts/:postId` - Delete own post.
- `POST /api/forums/posts/:postId/like` - Toggle like/unlike on a post.
- `POST /api/forums/posts/:postId/comments` - Create a comment on a post (supports nested comments via parentId).
- `PATCH /api/forums/comments/:commentId` - Edit own comment.
- `DELETE /api/forums/comments/:commentId` - Delete own comment.

All write routes require active account status; pending/rejected users receive 403.

---

## 3. Admin API (Authentication + 'admin' role Required)
- `POST /api/admin/forums` - Create a new forum section.
- `PATCH /api/admin/forums/:forumId` - Edit a forum section.
- `DELETE /api/admin/forums/:forumId` - Delete a forum section.
- `GET /api/admin/forums/posts` - List all posts (optional `forumId`, `status`, `q`, `limit`, `cursor` for filtering).
- `GET /api/admin/forums/posts/:postId` - Get any post detail (including deleted/hidden posts and all comments).
- `DELETE /api/admin/forums/posts/:postId` - Moderation soft-delete of any post.
- `DELETE /api/admin/forums/comments/:commentId` - Moderation soft-delete of any comment.