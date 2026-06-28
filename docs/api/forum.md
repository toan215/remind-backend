# Forum API Overview

This document outlines the API routes for the ReMind Forum features. For detailed AI/UI integration payloads, see `docs/agents/forum-api-knowledge.md`.

## Display Mode Convention
- `authorDisplayMode`: `0` = Real Name, `1` = Anonymous

---

## 1. Public / Guest API (No Authentication Required)
- `GET /api/forums` - List active main forum sections.
- `GET /api/forums/posts?forumId=...&limit=...&cursor=...` - List active posts with optional forumId filter and cursor pagination.
- `GET /api/forums/posts/:postId` - Get post details and its active comments.
- `GET /api/forums/search?q=...` - Full-text search across active posts.

---

## 2. User API (Authentication Required)
- `POST /api/forums/posts` - Create a new post (optional `forumId` in body; falls back to default forum).
- `PATCH /api/forums/posts/:postId` - Edit own post.
- `DELETE /api/forums/posts/:postId` - Delete own post.
- `POST /api/forums/posts/:postId/comments` - Create a comment on a post.
- `PATCH /api/forums/comments/:commentId` - Edit own comment.
- `DELETE /api/forums/comments/:commentId` - Delete own comment.

---

## 3. Admin API (Authentication + 'admin' role Required)
- `POST /api/admin/forums` - Create a new forum section.
- `PATCH /api/admin/forums/:forumId` - Edit a forum section.
- `DELETE /api/admin/forums/:forumId` - Delete a forum section.
- `DELETE /api/admin/forums/posts/:postId` - Moderation delete of any post.
- `DELETE /api/admin/forums/comments/:commentId` - Moderation delete of any comment.