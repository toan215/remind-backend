# ReMind MongoDB Database Design

Nguồn tham chiếu: `backend/src/models/*.ts` (Cập nhật mới nhất theo codebase backend).

## 1. Nguyên tắc cốt lõi (Core Rules)

- **Cơ sở dữ liệu chính (Primary Database)**: Sử dụng MongoDB với Mongoose ODM trong Node.js / Express.
- **Định danh tài khoản (User Identifier)**: Tất cả tài khoản lưu tại collection `users` dùng ObjectId (`_id`) làm khóa chính.
- **Tối ưu hóa dữ liệu không tồn tại (No Null Fields)**: Không lưu trữ các field mang giá trị `null` trừ khi cần thiết cho logic query.
- **Truy cập trực tiếp (Direct Access Policy)**: Frontend không bao giờ trực tiếp thao tác ghi/đọc dữ liệu MongoDB mà luôn thông qua backend REST/Socket API.
- **Audit Logging**: Tất cả các thao tác thay đổi dữ liệu quan trọng (mua hàng, đổi trạng thái, duyệt bài, đặt lịch...) phải tạo log ở collection `logs`.

---

## 2. Vai trò người dùng (Actors & Roles)

Trong hệ thống backend hiện tại (`user.model.ts`), các vai trò (`role`) chính thức bao gồm:
- `student`: Học sinh / Sinh viên / Người dùng cần hỗ trợ tâm lý.
- `expert`: Chuyên gia tâm lý / Tư vấn viên đã đăng ký.
- `admin`: Quản trị viên nền tảng (duyệt bài, duyệt chuyên gia, xử lý báo cáo).
- `system_manager`: Quản trị viên hệ thống cấp cao.

---

## 3. Danh sách Collections Đã Triển Khai (Implemented Collections - 19 Models)

### 3.1. `users`
Lưu trữ toàn bộ tài khoản trong hệ thống.

```typescript
{
  _id: ObjectId,
  email: String, // required, unique, lowercase, trim
  password?: String, // select: false
  refreshToken?: String, // select: false
  fullName?: String, // trim
  googleId?: String, // sparse, unique (Google OAuth)
  role: String, // 'student' | 'expert' | 'admin' | 'system_manager' (required)
  status: String, // 'active' | 'pending' | 'rejected' | 'banned' (default: 'pending')
  avatar: String, // default: ""
  isAnonymous: Boolean, // default: false
  isValidatedExpert: Boolean, // default: false (điều kiện để chuyên gia tạo slot)
  
  // Thông tin mở rộng dành cho Expert
  expert?: {
    profile: {
      professionalTitle?: String,
      bio?: String,
      specialties: [String],
      languages: [String],
      yearsOfExperience: Number // default: 0
    },
    license: {
      licenseNumber?: String,
      issuedBy?: String,
      verificationStatus?: String
    },
    credentials: [
      {
        fileId?: ObjectId,
        fileName?: String,
        uploadedAt: Date // default: Date.now
      }
    ],
    approval: {
      reviewedBy?: ObjectId, // ref: 'User'
      reviewedAt?: Date,
      rejectionReason?: String
    },
    performanceStats: {
      completedSessionCount: Number, // default: 0
      averageRating: Number, // default: 0
      reviewCount: Number // default: 0
    }
  },
  createdAt: Date,
  updatedAt: Date
}
```

---

### 3.2. `subscriptionPlans`
Danh sách gói đăng ký (Plan templates) do Admin tạo.

```typescript
{
  _id: ObjectId,
  name: String, // required, trim
  price: Number, // required
  currency: String, // default: 'VND'
  billingPeriod: String, // 'monthly' | 'yearly' (required)
  includedExpertSessions: Number, // default: 0
  aiChatLimitPerMonth: Number, // default: 0
  expertSessionValue: Number, // default: 0
  platformFeeRate: Number, // default: 0
  isActive: Boolean, // default: true
  createdAt: Date,
  updatedAt: Date
}
```

---

### 3.3. `studentSubscriptions`
Thông tin gói dịch vụ hiện tại mà học sinh/sinh viên đang đăng ký.

```typescript
{
  _id: ObjectId,
  studentId: ObjectId, // ref: 'User', required, unique (1 student - 1 active sub)
  planId?: ObjectId, // ref: 'SubscriptionPlan'
  status: String, // 'active' | 'expired' | 'cancelled' (default: 'active')
  currentPeriodStartAt?: Date,
  currentPeriodEndAt?: Date,
  remainingExpertSessions: Number, // default: 0
  lockedExpertSessions: Number, // default: 0
  remainingAiChatMessages: Number, // default: 0
  createdAt: Date,
  updatedAt: Date
}
```

---

### 3.4. `studentCreditWallets`
Ví lưu trữ lượt tư vấn / lượt chat AI còn dư của học sinh.

```typescript
{
  _id: ObjectId,
  studentId: ObjectId, // ref: 'User', required, unique
  expertSessionCredits: Number, // default: 0
  freeExpertSessionCredits: Number, // default: 0
  aiChatMessageCredits: Number, // default: 0
  updatedAt: Date
}
```

---

### 3.5. `creditPackages`
Các gói mua thêm lượt lẻ (Credits Package) khả dụng.

```typescript
{
  _id: ObjectId,
  name: String, // required, trim
  type: String, // 'expert_sessions' | 'ai_chat_messages' (required)
  quantity: Number, // required
  price: Number, // required
  currency: String, // default: 'VND'
  isActive: Boolean, // default: true
  createdAt: Date,
  updatedAt: Date
}
```

---

### 3.6. `creditTransactions`
Sổ nhật ký ghi nhận toàn bộ biến động lượt tư vấn/chat.

```typescript
{
  _id: ObjectId,
  studentId: ObjectId, // ref: 'User', required
  type: String, // 'expert_session' | 'free_expert_session' | 'ai_chat_message' (required)
  direction: String, // 'add' | 'lock' | 'use' | 'release' | 'refund' | 'adjust' (required)
  quantity: Number, // required
  source: String, // 'subscription' | 'purchase' | 'organization' | 'trial' | 'volunteer' | 'admin_adjustment' (required)
  paymentId?: ObjectId, // ref: 'Payment'
  note?: String,
  createdAt: Date
}
```

---

### 3.7. `payments`
Lịch sử giao dịch thanh toán qua cổng thanh toán (PayOS / Gateway).

```typescript
{
  _id: ObjectId,
  userId: ObjectId, // ref: 'User', required
  kind: String, // 'credit_package' | 'subscription_plan' | 'appointment' (required)
  productId?: ObjectId,
  appointmentId?: ObjectId, // ref: 'Appointment'
  productSnapshot?: Mixed,
  amount: Number, // required
  currency: String, // default: 'VND'
  status: String, // 'pending' | 'succeeded' | 'failed' | 'cancelled' (default: 'pending')
  orderCode: Number, // required, unique (PayOS numeric order code)
  provider: String, // default: 'payos'
  providerPaymentLinkId?: String,
  checkoutUrl?: String,
  qrCode?: String,
  paidAt?: Date,
  expiresAt?: Date,
  createdAt: Date,
  updatedAt: Date
}
```

---

### 3.8. `otps`
Mã xác thực dùng một lần (Mã OTP khôi phục mật khẩu).

```typescript
{
  _id: ObjectId,
  email: String, // required, lowercase, trim
  otp: String, // required
  expiresAt: Date, // required (TTL Index: tự động xóa khi hết hạn)
  createdAt: Date,
  updatedAt: Date
}
```

---

### 3.9. `expertSlots`
Lịch rảnh (Khung giờ tư vấn) do Chuyên gia tạo cho học sinh đặt lịch.

```typescript
{
  _id: ObjectId,
  expertId: ObjectId, // ref: 'User', required
  startAt: Date, // required
  endAt: Date, // required
  price: Number, // required (Đơn giá VND / lượt tư vấn)
  status: String, // 'available' | 'booked' | 'unavailable' (default: 'available')
  createdAt: Date,
  updatedAt: Date
}
```

---

### 3.10. `appointments`
Lịch hẹn tư vấn giữa Học sinh và Chuyên gia.

```typescript
{
  _id: ObjectId,
  studentId: ObjectId, // ref: 'User', required
  expertId: ObjectId, // ref: 'User', required
  slotId: ObjectId, // ref: 'ExpertSlot', required
  subscriptionId?: ObjectId, // ref: 'StudentSubscription'
  paymentId?: ObjectId, // ref: 'Payment'
  amount?: Number,
  status: String, // 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show' | 'rescheduled' | 'pending_payment' | 'booked' (required)
  creditSource?: String,
  scheduledStartAt: Date, // required
  scheduledEndAt: Date, // required
  cancellation?: {
    cancelledBy: ObjectId, // ref: 'User', required
    cancelledByRole: String, // required
    reason: String, // required
    cancelledAt: Date, // required
    creditRefunded: Boolean // default: false
  },
  createdAt: Date,
  updatedAt: Date
}
```

---

### 3.11. `chatRooms`
Phòng nhắn tin riêng (Direct) hoặc phòng chat nhóm (Group).

```typescript
{
  _id: ObjectId,
  type: String, // 'direct' | 'group' (required)
  appointmentId?: ObjectId, // ref: 'Appointment'
  createdBy: ObjectId, // ref: 'User', required
  participants: [
    {
      userId: ObjectId, // ref: 'User', required
      role: String, // required
      status: String, // 'active' | 'removed' (default: 'active')
      joinedAt: Date // default: Date.now
    }
  ],
  status: String, // 'active' | 'closed' | 'archived' (default: 'active')
  lastMessage?: {
    text?: String,
    senderId?: ObjectId, // ref: 'User'
    sentAt?: Date
  },
  createdAt: Date,
  updatedAt: Date
}
```

---

### 3.12. `chatMessages`
Tin nhắn trò chuyện trong các `chatRooms`.

```typescript
{
  _id: ObjectId,
  chatRoomId: ObjectId, // ref: 'ChatRoom', required
  senderId: ObjectId, // ref: 'User', required
  senderRole: String, // required
  messageType: String, // 'text' | 'image' | 'file' | 'system' (default: 'text')
  text?: String, // trim
  fileId?: ObjectId, // ref: 'File'
  status: String, // 'active' | 'hidden' | 'deleted' (default: 'active')
  readBy: [ObjectId], // ref: 'User', default: []
  createdAt: Date,
  updatedAt: Date
}
```

---

### 3.13. `chatInvitations`
Lời mời tham gia phòng nhắn tin.

```typescript
{
  _id: ObjectId,
  chatRoomId: ObjectId, // ref: 'ChatRoom', required
  invitedUserId: ObjectId, // ref: 'User', required
  invitedRole?: String,
  invitedBy: ObjectId, // ref: 'User', required
  invitedByRole?: String,
  status: String, // 'pending' | 'accepted' | 'rejected' | 'cancelled' (default: 'pending')
  reason?: String, // trim
  respondedAt?: Date,
  createdAt: Date,
  updatedAt: Date
}
```

---

### 3.14. `forums`
Danh mục Diễn đàn do Admin quản lý.

```typescript
{
  _id: ObjectId,
  title: String, // required, trim
  description: String, // required, trim
  category: String, // required, trim
  createdByAdminId: ObjectId, // ref: 'User', required
  isActive: Boolean, // default: true
  createdAt: Date,
  updatedAt: Date
}
```

---

### 3.15. `forumPosts`
Bài đăng trên Diễn đàn của người dùng.

```typescript
{
  _id: ObjectId,
  forumId: ObjectId, // ref: 'Forum', required
  authorId: ObjectId, // ref: 'User', required
  authorDisplayMode: Number, // 0: Hiển thị tên thật, 1: Ẩn danh (required)
  publicAuthorName: String, // required, trim (đã xử lý hiển thị ở server)
  title: String, // required, trim
  content: String, // required, trim
  tags: [String], // default: []
  status: String, // 'active' | 'hidden' | 'deleted' | 'under_review' (default: 'active')
  likeCount: Number, // default: 0
  likedBy: [ObjectId], // ref: 'User', default: []
  commentCount: Number, // default: 0
  createdAt: Date,
  updatedAt: Date
}
```

---

### 3.16. `forumComments`
Bình luận bài viết Diễn đàn (hỗ trợ trả lời lồng ghép bằng `parentId`).

```typescript
{
  _id: ObjectId,
  postId: ObjectId, // ref: 'ForumPost', required
  authorId: ObjectId, // ref: 'User', required
  authorDisplayMode: Number, // 0: Tên thật, 1: Ẩn danh (required)
  publicAuthorName: String, // required, trim
  content: String, // required, trim
  status: String, // 'active' | 'hidden' | 'deleted' | 'under_review' (default: 'active')
  likeCount: Number, // default: 0
  likedBy: [ObjectId], // ref: 'User'
  parentId?: ObjectId, // ref: 'ForumComment', default: null
  createdAt: Date,
  updatedAt: Date
}
```

---

### 3.17. `reports`
Báo cáo vi phạm nội dung hoặc sự cố hệ thống.

```typescript
{
  _id: ObjectId,
  reporterId: ObjectId, // ref: 'User', required
  targetType: String, // 'user' | 'expert' | 'post' | 'comment' | 'message' | 'bug' (required)
  targetId: ObjectId, // required
  reason: String, // required, trim
  description?: String, // trim
  status: String, // 'open' | 'reviewing' | 'resolved' | 'dismissed' (default: 'open')
  resolutionAction?: String, // trim
  resolvedBy?: ObjectId, // ref: 'User'
  resolvedAt?: Date,
  createdAt: Date,
  updatedAt: Date
}
```

---

### 3.18. `notifications`
Thông báo gửi tới người dùng.

```typescript
{
  _id: ObjectId,
  recipient: ObjectId, // ref: 'User', required
  sender?: ObjectId, // ref: 'User'
  type: String, // 'NEW_EXPERT' | 'LIKE_POST' | 'COMMENT_POST' | 'REPLY_COMMENT' | 'POST_APPROVED' | 'EXPERT_APPROVED' | 'EXPERT_REJECTED' | 'SYSTEM' (required)
  content?: String,
  referenceId?: ObjectId, // ID tham chiếu bài viết, comment...
  isRead: Boolean, // default: false
  createdAt: Date,
  updatedAt: Date
}
```

---

### 3.19. `logs`
Nhật ký kiểm toán hệ thống (System Audit Logs).

```typescript
{
  _id: ObjectId,
  actorId: ObjectId, // ref: 'User', required
  actorRole: String, // required
  action: String, // required, trim
  targetType?: String, // trim
  targetId?: ObjectId,
  metadata?: Mixed,
  createdAt: Date
}
```

---

## 4. Các Chỉ MụcMongoDB Cần Thiết (Essential MongoDB Indexes)

Dưới đây là các Indexes đã được khai báo trong các Mongoose Model để tối ưu hiệu năng truy vấn:

```javascript
// User
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ role: 1, status: 1 });
db.users.createIndex({ googleId: 1 }, { sparse: true, unique: true });

// OTP
db.otps.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
db.otps.createIndex({ email: 1 });

// Forum & Discussion
db.forumPosts.createIndex({ forumId: 1, status: 1, createdAt: -1 });
db.forumPosts.createIndex({ title: "text", content: "text", tags: "text" });
db.forumComments.createIndex({ postId: 1, status: 1 });

// Expert Slots & Appointments
db.expertSlots.createIndex({ expertId: 1, startAt: 1 });
db.expertSlots.createIndex({ status: 1 });
db.appointments.createIndex({ studentId: 1, status: 1 });
db.appointments.createIndex({ expertId: 1, status: 1 });
db.appointments.createIndex({ slotId: 1 });

// Chat
db.chatRooms.createIndex({ 'participants.userId': 1, status: 1 });
db.chatRooms.createIndex({ type: 1, appointmentId: 1 });
db.chatMessages.createIndex({ chatRoomId: 1, createdAt: -1 });
db.chatInvitations.createIndex({ chatRoomId: 1, invitedUserId: 1 });
db.chatInvitations.createIndex({ invitedUserId: 1, status: 1 });

// Financial & Ledger
db.payments.createIndex({ userId: 1, createdAt: -1 });
db.payments.createIndex({ status: 1 });
db.payments.createIndex({ orderCode: 1 }, { unique: true });
db.creditTransactions.createIndex({ studentId: 1, createdAt: -1 });

// Moderation & Audit
db.reports.createIndex({ status: 1, createdAt: -1 });
db.reports.createIndex({ targetType: 1, targetId: 1 });
db.logs.createIndex({ actorId: 1, createdAt: -1 });
db.logs.createIndex({ action: 1, createdAt: -1 });
```

---

## 5. Collections Mở Rộng / Dự Kiến (Prospective Architecture Collections)

Các collection dưới đây nằm trong định hướng phát triển tính năng mở rộng (như Khảo sát tổ chức, AI Chat tự động nâng cao, phòng cấp cứu Crisis, cấp phát hạn mức Doanh nghiệp...):
- `organizations`, `organizationMembers`, `organizationSubscriptions`, `organizationCreditAllocations`, `organizationInvitations`, `organizationJoinCodes`.
- `supportRequests`, `expertOnCallStatus`.
- `files` (Quản lý metadata file tập trung nâng cao ngoài GridFS).
- `platformSettings`, `policyVersions`, `userConsents`.
- `analyticsDaily`, `expertAnalyticsDaily`, `organizationAnalyticsDaily`.
