# ReMind MongoDB Database Design

Source plan: `ReMind-platformsupport.md`

## Core Rules

- Use MongoDB as the primary database.
- All user accounts are stored in `users` collection with MongoDB ObjectId `_id` as the primary identifier.
- Do not store fields with `null` values. Omit fields that do not apply.
- Frontend does not write directly to MongoDB.
- Backend Express.js/Fastify API performs all writes and validations.
- Client reads data through authenticated API endpoints that filter sensitive fields.
- Sensitive/private/business data is returned through backend APIs with proper authorization.
- Backend writes logs for important changes.

## Actors

- `guest`: unauthenticated visitor.
- `student`: user receiving support.
- `expert`: psychological expert.
- `manager`: organization staff account.
- `organization`: company/school/group container, not a login account.
- `admin`: platform operations staff.
- `system_manager`: top-level role that manages admins and platform permissions.

## Added Actors And Feature Areas

The original requirement document listed guests, students, psychological experts, and admins. This database design also adds these explicit actors/participants:

- `manager`: manages organization members, invitations, join codes, and organization credit allocation.
- `organization`: owns group subscriptions, member seats, and pooled credits.
- `system_manager`: manages admin accounts, admin permissions, and high-level platform controls.
- `ai`: non-human chat participant used in AI chat rooms and risk detection records.

The design also expands the original features into these database-backed areas:

- Authentication profiles, anonymous student mode, and role-based account status.
- Expert onboarding, license/certification review, approval, availability, slots, and performance stats.
- Student subscriptions, subscription plans, extra credit packages, wallets, and credit transaction ledger.
- Payments, payment provider references, expert payouts, platform commission, and trial-abuse prevention.
- Appointment booking, slot locking, cancellation, rescheduling, completion, no-show, and credit release/use logic.
- Direct chat, group chat, forum group discussions, chat messages, and chat invitations.
- Crisis/urgent support requests, self-reported risk, AI risk detection, emergency resources, and on-call experts.
- Forums, forum posts, forum comments, anonymous public display, and moderation status.
- Reports for users, experts, appointments, forum content, chat messages, and technical bugs.
- Ratings after completed appointments and admin-reviewed report impact on expert performance.
- Organization subscriptions, organization members, organization invitations, join codes, redemptions, and student credit allocation.
- Expert-to-organization de-identified performance sharing and organization-safe expert reports.
- Notifications, files, optimized image variants, signed access for sensitive files, logs, platform settings, policies, consents, and analytics summaries.

## Collections

### users

Stores every login account.

```javascript
{
  _id: ObjectId,
  email: String,
  passwordHash: String, // bcrypt, select: false
  refreshTokenHash: String, // bcrypt(sha256(token)), select: false
  googleId: String, // sparse unique index; null for email-only users
  fullName: String,
  avatarUrl: String,
  phone: String,
  role: String, // student | expert | manager | admin | system_manager
  status: String, // active | pending | rejected | banned
  activeSubscriptionId: ObjectId,
  paymentCustomerId: String,
  defaultPaymentMethodId: String,
  hasUsedTrial: Boolean,
  phoneVerified: Boolean,
  riskLevel: String, // low | medium | high
  createdAt: Date,
  updatedAt: Date,
  lastLoginAt: Date,

  student: {
    anonymousDisplayName: String,
    isAnonymousMode: Boolean,
    dateOfBirth: Date,
    gender: String,
    schoolName: String,
    educationLevel: String,
    emergencyContact: {
      name: String,
      phone: String,
      relationship: String
    },
    preferences: Object
  },

  expert: {
    profile: {
      professionalTitle: String,
      bio: String,
      profileSummary: String,
      yearsOfExperience: Number,
      languages: [String],
      consultationMethods: [String]
    },
    specialties: [String],
    education: [
      {
        degree: String,
        school: String,
        major: String,
        graduationYear: Number
      }
    ],
    certifications: [
      {
        name: String,
        issuedBy: String,
        issuedAt: Date,
        fileId: ObjectId
      }
    ],
    license: {
      licenseNumber: String,
      issuedBy: String,
      issuedAt: Date,
      expiresAt: Date,
      fileIds: [ObjectId],
      verificationStatus: String
    },
    consultationSettings: {
      sessionDurationMinutes: Number,
      maxSessionsPerDay: Number,
      acceptsVolunteerSessions: Boolean,
      volunteerSessionLimitPerMonth: Number,
      volunteerSessionUsedThisMonth: Number
    },
    approval: {
      reviewedBy: ObjectId,
      reviewedAt: Date,
      rejectionReason: String
    },
    performanceStats: {
      completedSessionCount: Number,
      cancelledByExpertCount: Number,
      noShowCount: Number,
      lateComplaintCount: Number,
      validComplaintCount: Number,
      averageRating: Number,
      responseTimeAvgMinutes: Number,
      lastCalculatedAt: Date
    }
  },

  admin: {
    permissions: Object
  },

  systemManager: {
    permissions: Object
  }
}
```

### subscriptionPlans

Plan templates used by individual students and organizations.

```javascript
{
  _id: ObjectId,
  name: String,
  price: Number,
  currency: String,
  billingPeriod: String, // monthly | yearly
  trialDays: Number,
  includedExpertSessions: Number,
  aiChatLimitPerMonth: Number,
  forumPostLimitPerDay: Number,
  expertSessionValue: Number,
  platformFeeRate: Number,
  canMessageExperts: Boolean,
  canUseAnonymousMode: Boolean,
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### studentSubscriptions

Actual subscription owned by a student.

```javascript
{
  _id: ObjectId,
  studentId: ObjectId,
  planId: ObjectId,
  paymentCustomerId: String,
  status: String, // trialing | active | expired | cancelled | replaced
  currentPeriodStartAt: Date,
  currentPeriodEndAt: Date,
  trialEndsAt: Date,
  remainingExpertSessions: Number,
  lockedExpertSessions: Number,
  remainingAiChatMessages: Number,
  replacedBySubscriptionId: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

### studentCreditWallets

Fast balance for credits. Purchased credits never expire.

```javascript
{
  _id: ObjectId,
  studentId: ObjectId,
  expertSessionCredits: Number,
  freeExpertSessionCredits: Number,
  aiChatMessageCredits: Number,
  updatedAt: Date
}
```

### creditTransactions

Ledger for every credit change.

```javascript
{
  _id: ObjectId,
  studentId: ObjectId,
  type: String, // expert_session | free_expert_session | ai_chat_message
  direction: String, // add | lock | use | release | refund | adjust
  quantity: Number,
  source: String, // subscription | purchase | organization | trial | volunteer | admin_adjustment
  appointmentId: ObjectId,
  paymentId: ObjectId,
  chatRoomId: ObjectId,
  messageId: ObjectId,
  createdAt: Date,
  note: String
}
```

### creditPackages

Extra purchasable credits.

```javascript
{
  _id: ObjectId,
  name: String,
  type: String, // expert_sessions | ai_chat_messages
  quantity: Number,
  price: Number,
  currency: String,
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### payments

Payment history only. Do not store card data.

```javascript
{
  _id: ObjectId,
  studentId: ObjectId,
  organizationId: ObjectId,
  subscriptionId: ObjectId,
  creditPackageId: ObjectId,
  provider: String, // stripe | momo | vnpay | paypal | other
  providerPaymentId: String,
  amount: Number,
  currency: String,
  status: String, // pending | succeeded | failed | refunded
  paidAt: Date,
  createdAt: Date
}
```

### trialClaims

Prevents trial abuse across many accounts.

```javascript
{
  _id: ObjectId,
  claimKey: String, // unique identifier (hashed fingerprint)
  keyType: String, // payment_method | phone | device | ip_risk
  claimedByUserId: ObjectId,
  createdAt: Date,
  expiresAt: Date
}
```

Use hashed fingerprints only. Never store real card numbers or raw device identifiers.

### otps

Stores OTP (One-Time Password) codes used for password recovery/reset password flows.

```javascript
{
  _id: ObjectId,
  email: String, // index: email: 1
  otp: String,
  expiresAt: Date // TTL index: expiresAt: 1, expireAfterSeconds: 0
}
```

### expertAvailability

Expert weekly schedule settings.

```javascript
{
  _id: ObjectId,
  expertId: ObjectId,
  weeklySchedule: Object,
  blockedDates: [Date],
  slotDurationMinutes: Number,
  bufferMinutes: Number,
  maxSessionsPerDay: Number,
  autoGenerateSlots: Boolean,
  generatedUntil: Date,
  updatedAt: Date
}
```

### expertSlots

Concrete bookable slots generated from availability.

```javascript
{
  _id: ObjectId,
  expertId: ObjectId,
  startAt: Date,
  endAt: Date,
  status: String, // available | locked | booked | cancelled | expired
  appointmentId: ObjectId,
  lockedByStudentId: ObjectId,
  lockedUntil: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### appointments

Consultation booking.

```javascript
{
  _id: ObjectId,
  studentId: ObjectId,
  expertId: ObjectId,
  slotId: ObjectId,
  subscriptionId: ObjectId,
  status: String, // confirmed | in_progress | completed | cancelled | no_show | rescheduled
  creditSource: String,
  creditType: String,
  creditStatus: String,
  scheduledStartAt: Date,
  scheduledEndAt: Date,
  expertJoinedAt: Date,
  studentJoinedAt: Date,
  actualStartAt: Date,
  actualEndAt: Date,
  expertSessionRate: Number,
  platformFeeRate: Number,
  platformFeeAmount: Number,
  expertPayoutAmount: Number,
  payoutStatus: String,
  studentNote: String,
  expertNote: String,
  cancellation: {
    cancelledBy: ObjectId,
    cancelledByRole: String,
    reason: String,
    cancelledAt: Date,
    creditRefunded: Boolean
  },
  rescheduleOfAppointmentId: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

### chatRooms

Supports direct and group chat rooms.

```javascript
{
  _id: ObjectId,
  type: String, // direct | group
  appointmentId: ObjectId, // optional; used by direct rooms
  createdBy: ObjectId,
  participants: [
    {
      userId: ObjectId,
      role: String,
      status: String, // active | removed
      joinedAt: Date
    }
  ],
  status: String, // active | closed | archived
  lastMessage: { // optional
    text: String,
    senderId: ObjectId,
    sentAt: Date
  },
  createdAt: Date,
  updatedAt: Date
}
```

### chatMessages

Real-time chat messages. Backend writes only.

```javascript
{
  _id: ObjectId,
  chatRoomId: ObjectId,
  senderId: ObjectId,
  senderRole: String,
  messageType: String, // text | image | file | system
  text: String,
  fileId: ObjectId,
  status: String, // active | hidden | deleted
  readBy: [ObjectId],
  createdAt: Date,
  updatedAt: Date
}
```

### chatInvitations

Chat invitation request.

```javascript
{
  _id: ObjectId,
  chatRoomId: ObjectId,
  invitedUserId: ObjectId,
  invitedRole: String,
  invitedBy: ObjectId,
  invitedByRole: String,
  status: String, // pending | accepted | rejected | cancelled
  reason: String,
  createdAt: Date,
  updatedAt: Date,
  respondedAt: Date
}
```

Invitation rules:

- Invitations are only used for `group` chat rooms.
- Any active room member can invite a user who is not already an active participant.
- Invited users must accept or reject.

### supportRequests

Crisis or urgent support queue.

```javascript
{
  _id: ObjectId,
  studentId: ObjectId,
  type: String, // crisis | normal_support | technical
  severity: String, // low | medium | high | emergency
  source: String, // self_report | ai_detected | expert_flagged | admin_flagged
  riskSignals: [String],
  previewText: String,
  status: String, // open | assigned | in_progress | resolved | escalated
  assignedExpertId: ObjectId,
  assignedAdminId: ObjectId,
  emergencyMessageShown: Boolean,
  emergencyMessageShownAt: Date,
  createdAt: Date,
  assignedAt: Date,
  resolvedAt: Date
}
```

### expertOnCallStatus

On-call status for immediate/crisis support.

```javascript
{
  _id: ObjectId,
  expertId: ObjectId,
  status: String, // available | busy | offline
  acceptsCrisisRequests: Boolean,
  maxActiveCrisisChats: Number,
  activeCrisisChatCount: Number,
  updatedAt: Date
}
```

### forums

Forum categories created by admins.

```javascript
{
  _id: ObjectId,
  title: String,
  description: String,
  category: String,
  createdByAdminId: ObjectId,
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### forumPosts

Community forum post.

```javascript
{
  _id: ObjectId,
  forumId: ObjectId,
  authorId: ObjectId,
  authorDisplayMode: String, // real_name | anonymous
  publicAuthorName: String,
  title: String,
  content: String,
  tags: [String],
  status: String, // active | hidden | deleted | under_review
  likeCount: Number,
  commentCount: Number,
  createdAt: Date,
  updatedAt: Date
}
```

### forumComments

Community forum comment.

```javascript
{
  _id: ObjectId,
  postId: ObjectId,
  authorId: ObjectId,
  authorDisplayMode: String,
  publicAuthorName: String,
  content: String,
  status: String, // active | hidden | deleted | under_review
  likeCount: Number,
  createdAt: Date,
  updatedAt: Date
}
```

### reports

Reports from students, experts, managers, or admins.

```javascript
{
  _id: ObjectId,
  reporterId: ObjectId,
  reporterRole: String,
  targetType: String, // user | expert | student | forum_post | forum_comment | appointment | chat_message | technical_bug
  targetId: ObjectId,
  studentId: ObjectId,
  expertId: ObjectId,
  appointmentId: ObjectId,
  reasonCategory: String,
  severity: String,
  description: String,
  status: String, // open | reviewing | resolved | dismissed
  priority: String,
  assignedAdminId: ObjectId,
  resolution: String,
  affectsExpertPerformance: Boolean,
  createdAt: Date,
  resolvedAt: Date,
  resolutionNote: String
}
```

Reports affect expert performance only after admin review.

### ratings

Student rating after a completed appointment.

```javascript
{
  _id: ObjectId,
  appointmentId: ObjectId,
  studentId: ObjectId,
  expertId: ObjectId,
  score: Number, // 1-5
  tags: [String],
  comment: String,
  isAnonymousToExpert: Boolean,
  status: String, // active | hidden | disputed
  createdAt: Date,
  updatedAt: Date
}
```

### organizations

Organization container.

```javascript
{
  _id: ObjectId,
  name: String,
  type: String, // school | university | company | nonprofit | other
  status: String, // active | suspended
  ownerUserId: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

### organizationMembers

Links users to organizations.

```javascript
{
  _id: ObjectId,
  orgId: ObjectId,
  userId: ObjectId,
  email: String,
  role: String, // owner | manager | student
  status: String, // invited | active | removed
  permissions: Object,
  joinedBy: String, // invitation | join_code | admin
  joinCodeId: ObjectId,
  assignedByAdminId: ObjectId,
  createdAt: Date,
  joinedAt: Date
}
```

Manager permissions live here, not globally in `users`.

### organizationSubscriptions

Organization subscription and pooled credits.

```javascript
{
  _id: ObjectId,
  orgId: ObjectId,
  planId: ObjectId,
  status: String, // active | expired | cancelled
  totalStudentSeats: Number,
  usedStudentSeats: Number,
  expertSessionCreditPool: Number,
  aiChatCreditPool: Number,
  currentPeriodStartAt: Date,
  currentPeriodEndAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### organizationCreditAllocations

Credits assigned from organization to a student.

```javascript
{
  _id: ObjectId,
  orgId: ObjectId,
  orgSubscriptionId: ObjectId,
  studentId: ObjectId,
  allocatedByManagerId: ObjectId,
  expertSessionCredits: Number,
  aiChatMessageCredits: Number,
  usedExpertSessionCredits: Number,
  usedAiChatMessageCredits: Number,
  createdAt: Date,
  updatedAt: Date
}
```

### organizationInvitations

Email-based invite before account creation.

```javascript
{
  _id: ObjectId,
  orgId: ObjectId,
  orgSubscriptionId: ObjectId,
  email: String,
  invitedByManagerId: ObjectId,
  role: String, // student | manager
  status: String, // pending | accepted | expired | cancelled
  expiresAt: Date,
  createdAt: Date,
  acceptedByUserId: ObjectId
}
```

### organizationJoinCodes

Self-join code / organization promo access.

```javascript
{
  _id: ObjectId,
  orgId: ObjectId,
  orgSubscriptionId: ObjectId,
  codeHash: String,
  label: String,
  status: String, // active | disabled | expired
  security: {
    requireEmailDomain: Boolean,
    allowedEmailDomains: [String],
    requireManagerApproval: Boolean,
    maxRedemptions: Number,
    oneUsePerUser: Boolean,
    expiresAt: Date
  },
  defaultBenefits: {
    expertSessionCredits: Number,
    aiChatMessageCredits: Number
  },
  redemptionCount: Number,
  defaultRole: String,
  createdByManagerId: ObjectId,
  createdAt: Date
}
```

### organizationJoinCodeRedemptions

Tracks join code usage.

```javascript
{
  _id: ObjectId,
  orgId: ObjectId,
  orgSubscriptionId: ObjectId,
  joinCodeId: ObjectId,
  studentId: ObjectId,
  email: String,
  status: String, // pending_approval | approved | rejected | joined
  reviewedByManagerId: ObjectId,
  reviewedAt: Date,
  createdAt: Date
}
```

### expertOrganizationSharing

Expert permission to share de-identified performance data with an organization.

```javascript
{
  _id: ObjectId,
  expertId: ObjectId,
  orgId: ObjectId,
  status: String, // active | revoked
  sharedMetrics: [String],
  includeAnonymousFeedback: Boolean,
  createdAt: Date,
  revokedAt: Date
}
```

### expertOrgReports

Aggregated/de-identified expert report for organizations.

```javascript
{
  _id: ObjectId,
  orgId: ObjectId,
  expertId: ObjectId,
  periodStartAt: Date,
  periodEndAt: Date,
  completedSessionCount: Number,
  averageRating: Number,
  lateComplaintCount: Number,
  noShowCount: Number,
  validComplaintCount: Number,
  anonymousFeedbackSummary: String,
  generatedAt: Date
}
```

Never include student names, chat messages, appointment notes, or crisis details.

### notifications

User notifications.

```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  type: String, // appointment | chat | report | subscription | organization | system
  title: String,
  body: String,
  targetType: String,
  targetId: ObjectId,
  status: String, // unread | read | archived
  createdAt: Date,
  readAt: Date
}
```

### files

Metadata for uploaded files (stored in GridFS or external storage).

```javascript
{
  _id: ObjectId,
  ownerId: ObjectId,
  ownerRole: String,
  storageType: String, // gridfs | s3 | local
  storagePath: String,
  gridfsFileId: ObjectId, // if using GridFS
  variants: {
    thumbnail: {
      storagePath: String,
      width: Number,
      height: Number,
      sizeBytes: Number
    },
    medium: {
      storagePath: String,
      width: Number,
      height: Number,
      sizeBytes: Number
    }
  },
  purpose: String, // avatar | license | certification | chat_attachment | report_evidence | forum_image
  visibility: String, // private | participant_only | public
  relatedType: String,
  relatedId: ObjectId,
  processingStatus: String, // pending | completed | failed
  uploadedAt: Date
}
```

Sensitive files are served by backend-generated signed URLs or through authenticated API endpoints.

### logs

Track important system changes.

```javascript
{
  _id: ObjectId,
  logType: String, // credit | payment | appointment | admin_action | auth | report | organization | settings
  actorId: ObjectId,
  actorRole: String,
  action: String,
  targetType: String,
  targetId: ObjectId,
  before: Object,
  after: Object,
  createdAt: Date,
  metadata: Object
}
```

### platformSettings

Admin-configurable platform settings (single document).

```javascript
{
  _id: ObjectId,
  settingKey: String, // 'current'
  commissionRate: Number,
  cancellationRefundHours: Number,
  slotLockMinutes: Number,
  trial: {
    enabled: Boolean,
    trialDays: Number,
    requirePaymentMethod: Boolean,
    includedExpertSessions: Number,
    aiChatLimit: Number
  },
  aiUsage: {
    chargingMode: String,
    refundOnFailure: Boolean
  },
  crisis: {
    hotlineText: String,
    highRiskKeywords: [String],
    emergencyMessage: String,
    notifyAdminImmediately: Boolean
  },
  updatedByAdminId: ObjectId,
  updatedAt: Date
}
```

### policyVersions

Policy/disclaimer versions.

```javascript
{
  _id: ObjectId,
  type: String, // privacy_policy | terms | ai_disclaimer | crisis_disclaimer
  version: String,
  contentUrl: String,
  activeFrom: Date,
  isActive: Boolean,
  createdAt: Date
}
```

### userConsents

Tracks user consent acceptance.

```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  consentType: String,
  version: String,
  policyId: ObjectId,
  acceptedAt: Date,
  ipHash: String,
  userAgentHash: String
}
```

### analyticsDaily

System summary generated by backend jobs.

```javascript
{
  _id: ObjectId,
  date: Date,
  newUsers: Number,
  activeStudents: Number,
  completedAppointments: Number,
  revenue: Number,
  expertPayouts: Number,
  reportCount: Number,
  crisisRequestCount: Number
}
```

### expertAnalyticsDaily

Expert daily summary generated by backend jobs.

```javascript
{
  _id: ObjectId,
  expertId: ObjectId,
  date: Date,
  completedSessions: Number,
  cancelledSessions: Number,
  validComplaints: Number,
  averageRating: Number,
  lateComplaintCount: Number
}
```

### organizationAnalyticsDaily

Organization daily summary generated by backend jobs.

```javascript
{
  _id: ObjectId,
  orgId: ObjectId,
  date: Date,
  activeStudents: Number,
  expertSessionCreditsUsed: Number,
  aiChatCreditsUsed: Number,
  newMembers: Number
}
```

## Backend-Only Operations

These must be changed only by backend API with proper authorization:

- Roles and permissions.
- Expert approval.
- Subscriptions and payments.
- Credits and credit transactions.
- Appointment booking, slot locking, cancellation, completion.
- Organization membership, join codes, and credit allocation.
- Performance stats and analytics summaries.
- Platform settings.
- Logs.
- File processing metadata.

## API Authorization Patterns

All API endpoints must implement proper authorization middleware:

### Public Read Access
- Approved expert profiles (filtered through API)
- Active forum posts and comments (filtered through API)
- Public forum group content (read-only for guests)

### Authenticated User Access
- Own user profile (read/write allowed fields only)
- Own notifications (read only)
- Own subscriptions and credit wallet (read only)
- Participating chat room messages (read/write with validation)

### Role-Based Access
- **Students**: Create forum posts, join group discussions, report content
- **Experts**: Update own profile, participate in discussions, view own appointments
- **Admins**: Approve experts, moderate content, handle reports, manage users
- **System Managers**: Manage admins, platform settings, high-level controls

### Forbidden Operations
- Direct database writes from client
- Reading private expert credentials (admin-only)
- Accessing other users' private data
- Modifying roles without admin authorization

## MongoDB Indexes

### Essential Indexes

```javascript
// Users
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ role: 1, status: 1 });

// Expert profiles
db.users.createIndex({ "expert.approval.status": 1 });
db.users.createIndex({ "expert.specialties": 1 });

// Forum posts
db.forumPosts.createIndex({ forumId: 1, status: 1, createdAt: -1 });
db.forumPosts.createIndex({ authorId: 1 });
db.forumPosts.createIndex({ tags: 1 });
db.forumPosts.createIndex({ title: "text", content: "text" }); // Full-text search

// Appointments
db.appointments.createIndex({ studentId: 1, status: 1 });
db.appointments.createIndex({ expertId: 1, status: 1 });
db.appointments.createIndex({ slotId: 1 });

// Expert slots
db.expertSlots.createIndex({ expertId: 1, startAt: 1 });
db.expertSlots.createIndex({ status: 1, startAt: 1 });

// Chat
db.chatMessages.createIndex({ chatRoomId: 1, createdAt: -1 });
db.chatRooms.createIndex({ 'participants.userId': 1, status: 1 });
db.chatRooms.createIndex({ type: 1, appointmentId: 1 });
db.chatInvitations.createIndex({ chatRoomId: 1, invitedUserId: 1 });
db.chatInvitations.createIndex({ invitedUserId: 1, status: 1 });

// Notifications
db.notifications.createIndex({ userId: 1, status: 1, createdAt: -1 });

// Reports
db.reports.createIndex({ status: 1, priority: 1 });
db.reports.createIndex({ targetType: 1, targetId: 1 });
```

## MVP Build Order

1. MongoDB setup, Mongoose ODM, connection pooling
2. JWT authentication with Passport.js
3. User roles and basic profile management
4. Expert onboarding and admin approval workflow
5. Forum categories, posts, comments
6. Forum group discussions with real-time Socket.io + Change Streams
7. Reports and admin moderation
8. Notifications system
9. File upload with GridFS or S3 integration
10. Expert search with MongoDB aggregation pipelines
11. Subscription plans, student subscriptions, wallets, credit transactions
12. Expert availability, slots, and appointments
13. Chat rooms and messages
14. Organizations, managers, join codes, and credit allocation
15. Analytics summaries and logs

## Migration Notes

When migrating from Firestore:

1. **Collections**: Convert Firestore collections to MongoDB collections
2. **Subcollections**: Convert to separate collections with parent reference fields
3. **Document IDs**: Convert Firestore auto-ids to MongoDB ObjectIds
4. **Timestamps**: Convert Firestore Timestamps to JavaScript Date objects
5. **Security Rules**: Replace with API authorization middleware
6. **Real-time Listeners**: Replace with Socket.io + MongoDB Change Streams
7. **Queries**: Adapt Firestore queries to MongoDB aggregation pipelines
8. **Transactions**: Use MongoDB multi-document ACID transactions where needed

Expert weekly schedule settings.

```javascript
{
  _id: ObjectId,
  expertId: ObjectId,
  weeklySchedule: Object, // configuration for weekly recurring slots
  blockedDates: [Date],
  slotDurationMinutes: Number,
  bufferMinutes: Number,
  maxSessionsPerDay: Number,
  autoGenerateSlots: Boolean,
  generatedUntil: Date,
  updatedAt: Date
}
```

### expertSlots

Concrete bookable slots generated from availability.

```javascript
{
  _id: ObjectId,
  expertId: ObjectId,
  startAt: Date,
  endAt: Date,
  status: String, // available | locked | booked | cancelled | expired
  appointmentId: ObjectId,
  lockedByStudentId: ObjectId,
  lockedUntil: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### appointments

Consultation booking.

```javascript
{
  _id: ObjectId,
  studentId: ObjectId,
  expertId: ObjectId,
  slotId: ObjectId,
  subscriptionId: ObjectId,
  status: String, // confirmed | in_progress | completed | cancelled | no_show | rescheduled
  creditSource: String, // subscription | purchased_package | volunteer_free | organization
  creditType: String, // expert_session | free_expert_session
  creditStatus: String, // locked | used | released
  scheduledStartAt: Date,
  scheduledEndAt: Date,
  expertJoinedAt: Date,
  studentJoinedAt: Date,
  actualStartAt: Date,
  actualEndAt: Date,
  expertSessionRate: Number,
  platformFeeRate: Number,
  platformFeeAmount: Number,
  expertPayoutAmount: Number,
  payoutStatus: String, // pending | payable | paid | withheld
  studentNote: String,
  expertNote: String,
  cancellation: {
    cancelledBy: ObjectId,
    cancelledByRole: String,
    reason: String,
    cancelledAt: Date,
    creditRefunded: Boolean
  },
  rescheduleOfAppointmentId: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```
