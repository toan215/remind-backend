# ReMind Technical Stack & Design Decisions

**Last Updated:** 2026-06-01  
**Status:** Approved for MVP Implementation

## Overview

This document captures all technical decisions made through the design interview process for ReMind - a mental health support platform connecting students with psychological experts through expert discovery and forum community features.

## Core Architecture

```
┌─────────────┐
│   Frontend  │ (React/Vue/etc - not specified)
└──────┬──────┘
       │ HTTP/REST
       │ WebSocket (Socket.io)
       ↓
┌─────────────────────────────────────┐
│     Express.js REST API Server      │
│  - JWT Authentication (Passport.js) │
│  - Input Validation                 │
│  - Rate Limiting                    │
│  - CORS (Origin Whitelist)          │
└──────┬──────────────────────────────┘
       │
       ↓
┌─────────────────────────────────────┐
│          MongoDB Database           │
│  - Mongoose ODM                     │
│  - GridFS (File Storage)            │
│  - Text Indexes (Search)            │
│  - Change Streams (Real-time)       │
└─────────────────────────────────────┘
```

## Authentication & Security

### JWT Authentication Strategy

**Decision:** Short-lived access tokens + Refresh tokens

**Implementation:**
- Access token expires in 15-30 minutes
- Refresh token expires in 7-30 days
- Refresh token stored in MongoDB `refreshTokens` collection
- Token rotation on each refresh (old refresh token invalidated)

**Access Token Payload:**
```javascript
{
  userId: ObjectId,
  email: String,
  role: String, // student | expert | admin | system_manager
  iat: Number,  // issued at
  exp: Number   // expiration
}
```

### Token Storage

**Decision:** httpOnly cookies for refresh token, in-memory for access token

**Client-side Implementation:**
- Refresh token: Stored in httpOnly, secure, SameSite cookie
- Access token: Stored in JavaScript memory (React state/Vue reactive)
- CSRF protection required for cookie-based refresh endpoint

**Cookie Configuration:**
```javascript
{
  httpOnly: true,
  secure: true, // HTTPS only
  sameSite: 'strict',
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  path: '/api/auth/refresh'
}
```

### Session Invalidation

**Decision:** Refresh token blacklist in MongoDB

**Implementation:**
- Store refresh tokens in `refreshTokens` collection
- On invalidation event (ban, password change, security breach):
  - Delete refresh token from database
  - Access tokens remain valid until expiry (15-30 min window accepted)
- On token refresh:
  - Validate refresh token exists in database
  - Delete old refresh token
  - Generate new access + refresh tokens

**Refresh Token Schema:**
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  tokenHash: String, // Hashed refresh token
  userAgent: String,
  ipAddress: String,
  createdAt: Date,
  expiresAt: Date
}
```

### Password Security

**Decision:** bcrypt with work factor 12

**Implementation:**
```javascript
const bcrypt = require('bcrypt');
const saltRounds = 12;

// Hash password
const hash = await bcrypt.hash(password, saltRounds);

// Verify password
const isValid = await bcrypt.hash(password, hash);
```

**Requirements:**
- Minimum password length: 8 characters
- No maximum length (bcrypt handles truncation)
- Store only the hash, never log or expose

### Google OAuth Integration

**Decision:** google-auth-library + Passport Google Strategy

**Implementation:**
- Use `passport-google-oauth20` strategy
- Verify Google ID token with `google-auth-library`
- On successful OAuth:
  - Check if user exists by email
  - Create new user if doesn't exist
  - Generate JWT tokens
  - Set refresh token cookie

**Required Google Cloud Setup:**
- Create OAuth 2.0 credentials
- Configure authorized redirect URIs
- Store Client ID and Client Secret in environment variables

## Database & Storage

### MongoDB Configuration

**Decision:** MongoDB with Mongoose ODM

**Connection Setup:**
```javascript
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI, {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
});
```

**Connection String Format:**
```
mongodb://[username:password@]host1[:port1][,...hostN[:portN]][/[database][?options]]
```

### Mongoose Schema Design

**Key Patterns:**
- Use `ObjectId` for all references
- Add `createdAt` and `updatedAt` timestamps automatically
- Use embedded documents for closely related data
- Use separate collections for independent entities
- Add compound indexes for common queries

**Example Schema:**
```javascript
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  role: { type: String, enum: ['student', 'expert', 'admin', 'system_manager'] },
  status: { type: String, enum: ['active', 'pending', 'rejected', 'banned'], default: 'pending' }
}, { timestamps: true });

userSchema.index({ role: 1, status: 1 });
```

### GridFS File Storage

**Decision:** Use GridFS for storing expert credentials, avatars, and attachments

**When to Use:**
- Files larger than 16MB (BSON document limit)
- Expert license/certification PDFs
- User avatar images
- Chat attachments

**When NOT to Use:**
- Small files < 16MB can be stored directly in documents as Buffer
- Very high-volume file serving (use S3 instead)

**Implementation Pattern:**
```javascript
const { GridFSBucket } = require('mongodb');
const bucket = new GridFSBucket(db, { bucketName: 'files' });

// Upload file
const uploadStream = bucket.openUploadStream(filename, {
  metadata: { ownerId, purpose: 'license', private: true }
});

// Download file (with access control)
app.get('/api/files/:fileId', authenticate, async (req, res) => {
  const file = await bucket.find({ _id: ObjectId(req.params.fileId) }).next();
  
  // Check authorization
  if (file.metadata.private && !isAdmin(req.user)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  bucket.openDownloadStream(ObjectId(req.params.fileId)).pipe(res);
});
```

### Database Backups

**Decision:** MongoDB Atlas automated backups (if using Atlas)

**For Atlas:**
- Enable continuous cloud backups
- Set retention period: 7 days for MVP
- Point-in-time recovery enabled
- Daily snapshot schedule

**For Self-hosted MongoDB:**
- Use `mongodump` cron job
- Store backups in cloud storage (S3/GCS)
- Implement backup rotation (keep last 7 daily, 4 weekly, 12 monthly)

## API Architecture

### Express.js Server Setup

**Decision:** REST API with Express.js (Located in `apps/api/`)

**Core Directory Structure:**
- `src/routes`: API route definitions.
- `src/controllers`: Request handling and business logic.
- `src/middlewares`: Authentication and role checks (e.g., `requireAuth`, `requireRole('admin')`).
- `src/config/db.ts`: MongoDB connection setup.

**Core Middleware Stack:**
```javascript
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const app = express();

// Security headers
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS.split(','),
  credentials: true // Allow cookies
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use(morgan('combined', { stream: winstonStream }));

// Rate limiting
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
}));
```

### Input Validation

**Decision:** express-validator

**Pattern:**
```javascript
const { body, validationResult } = require('express-validator');

// Validation middleware
const validateRegistration = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('fullName').trim().escape(),
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];

app.post('/api/auth/register', validateRegistration, registerHandler);
```

### CORS Configuration

**Decision:** Whitelist specific origins

**Environment Configuration:**
```env
ALLOWED_ORIGINS=https://remind.com,https://app.remind.com,http://localhost:3000
```

**Implementation:**
```javascript
const allowedOrigins = process.env.ALLOWED_ORIGINS.split(',');

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
```

### Rate Limiting

**Decision:** In-memory rate limiter for MVP

**Implementation:**
```javascript
const rateLimit = require('express-rate-limit');

// Global limiter
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per IP per window
  message: 'Too many requests, please try again later'
});

// Auth-specific limiter (stricter)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 login attempts per IP per 15 minutes
  message: 'Too many login attempts, please try again later'
});

app.use(globalLimiter);
app.use('/api/auth/login', authLimiter);
```

**Migration Path to Redis:**
```javascript
// Later when scaling to multiple servers
const RedisStore = require('rate-limit-redis');
const redis = require('redis');

const limiter = rateLimit({
  store: new RedisStore({
    client: redis.createClient(),
    prefix: 'rl:'
  })
});
```

### API Route Structure

**Suggested Structure:**
```
/api
  /auth
    POST   /register
    POST   /login
    POST   /logout
    POST   /refresh
    GET    /google
    GET    /google/callback
  /users
    GET    /me
    PATCH  /me
    GET    /:id (public profile)
  /experts
    GET    / (search with filters)
    GET    /:id (public profile)
    POST   /onboarding
    GET    /me/onboarding/status
  /admin
    GET    /experts/pending
    POST   /experts/:id/approve
    POST   /experts/:id/reject
    # Admin MVP routes exist for expert approval/rejection (/api/admin/experts/*) and moderation (/api/admin/reports/*)
  /forums
    GET    / (list forums)
    GET    /posts?forumId=... (cursor paginated)
    POST   /posts (forumId optional in body)
    GET    /posts/:postId
    POST   /posts/:postId/comments
  /groups
    GET    /:groupId/messages
    POST   /:groupId/messages
    POST   /:groupId/join
  /reports
    POST   / (create report)
    GET    / (admin: list reports)
    PATCH  /:id (admin: resolve)
```

## Real-time Communication

### Socket.io + MongoDB Change Streams

**Decision:** Database-first with Socket.io broadcast

**Architecture:**
```
Client sends message
  → API validates & saves to MongoDB
    → MongoDB Change Stream detects insert
      → Socket.io emits to connected clients
```

**Implementation:**
```javascript
const http = require('http');
const socketIo = require('socket.io');
const { MongoClient } = require('mongodb');

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS.split(','),
    credentials: true
  }
});

// Authentication middleware for Socket.io
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  try {
    const user = verifyAccessToken(token);
    socket.userId = user.userId;
    socket.userRole = user.role;
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

// Join group room
io.on('connection', (socket) => {
  socket.on('joinGroup', async ({ groupId }) => {
    // Verify user is member of group
    const membership = await db.collection('forumGroupMembers').findOne({
      groupId: ObjectId(groupId),
      userId: ObjectId(socket.userId)
    });
    
    if (membership) {
      socket.join(`group:${groupId}`);
    }
  });
  
  socket.on('leaveGroup', ({ groupId }) => {
    socket.leave(`group:${groupId}`);
  });
});

// Watch MongoDB for new messages
const changeStream = db.collection('forumGroupMessages').watch();
changeStream.on('change', async (change) => {
  if (change.operationType === 'insert') {
    const message = change.fullDocument;
    io.to(`group:${message.groupId}`).emit('newMessage', message);
  }
});
```

**Client Reconnection Logic:**
```javascript
// On reconnect, fetch missed messages
socket.on('connect', async () => {
  const lastMessageTime = getLastMessageTime(); // from localStorage
  const response = await fetch(`/api/groups/${groupId}/messages?since=${lastMessageTime}`);
  const missedMessages = await response.json();
  // Display missed messages
});
```

## Search Implementation

### MongoDB Text Indexes

**Decision:** MongoDB text indexes for MVP

**Setup:**
```javascript
// Create text indexes
db.forumPosts.createIndex(
  { title: 'text', content: 'text', tags: 'text' },
  { 
    weights: {
      title: 3,
      tags: 2,
      content: 1
    },
    name: 'post_text_search'
  }
);

db.users.createIndex(
  { 'expert.profile.bio': 'text', 'expert.specialties': 'text' },
  {
    weights: {
      'expert.profile.bio': 2,
      'expert.specialties': 3
    },
    name: 'expert_text_search'
  }
);
```

**Search Implementation:**
```javascript
// Forum search
app.get('/api/search/posts', async (req, res) => {
  const { q } = req.query;
  
  const posts = await db.collection('forumPosts').find(
    { $text: { $search: q }, status: 'active' },
    { score: { $meta: 'textScore' } }
  ).sort({ score: { $meta: 'textScore' } }).limit(20).toArray();
  
  res.json(posts);
});

// Expert search with filters
app.get('/api/experts', async (req, res) => {
  const { specialty, language, q } = req.query;
  
  let query = { role: 'expert', 'expert.approval.status': 'approved' };
  
  if (specialty) {
    query['expert.specialties'] = specialty;
  }
  
  if (language) {
    query['expert.profile.languages'] = language;
  }
  
  if (q) {
    query.$text = { $search: q };
  }
  
  const experts = await db.collection('users').find(
    query,
    { score: { $meta: 'textScore' } }
  ).sort({ score: { $meta: 'textScore' } }).limit(20).toArray();
  
  // Filter out sensitive fields
  const publicExperts = experts.map(expert => ({
    _id: expert._id,
    displayName: expert.fullName,
    bio: expert.expert.profile.bio,
    specialties: expert.expert.specialties,
    languages: expert.expert.profile.languages
  }));
  
  res.json(publicExperts);
});
```

**Migration to Atlas Search/Elasticsearch:**
- When text indexes become limiting (complex queries, poor performance)
- When you need fuzzy matching, autocomplete, geospatial search
- When you need faceted search (filter by multiple attributes)

## Logging & Monitoring

### Morgan + Winston

**Decision:** Morgan for HTTP logging, Winston for application logs

**Setup:**
```javascript
const morgan = require('morgan');
const winston = require('winston');

// Winston configuration
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

// Console logging in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// Morgan streaming to Winston
const morganStream = {
  write: (message) => logger.info(message.trim())
};

app.use(morgan('combined', { stream: morganStream }));
```

**Log Files:**
- `logs/combined.log` - All HTTP requests and app logs
- `logs/error.log` - Errors only
- Rotate logs with `winston-daily-rotate-file` when files become large

**Log Structure:**
```javascript
// Structured logging examples
logger.info('User registered', { 
  userId: user._id, 
  email: user.email,
  registrationMethod: 'google' 
});

logger.error('Payment failed', {
  userId: user._id,
  paymentId: payment._id,
  error: error.message,
  stack: error.stack
});
```

## Configuration Management

### Environment Variables with dotenv

**Decision:** .env files with dotenv

**File Structure:**
```
.env                # Local development (not in git)
.env.example        # Template file (committed to git)
.env.production     # Production config (not in git)
```

**.env.example:**
```env
# Server
NODE_ENV=development
PORT=3000

# MongoDB
MONGODB_URI=mongodb://localhost:27017/remind

# JWT
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# Logging
LOG_LEVEL=info
```

**Loading Configuration:**
```javascript
require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  mongodb: {
    uri: process.env.MONGODB_URI,
    options: {
      maxPoolSize: parseInt(process.env.MONGODB_POOL_SIZE || '10', 10)
    }
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d'
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackUrl: process.env.GOOGLE_CALLBACK_URL
  }
};

// Validate required variables
const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET', 'GOOGLE_CLIENT_ID'];
requiredEnvVars.forEach((varName) => {
  if (!process.env[varName]) {
    throw new Error(`Missing required environment variable: ${varName}`);
  }
});
```

## Deployment

### Cloud Platform Deployment

**Decision:** Deploy to Railway, Render, or Vercel for MVP

**Railway Deployment:**
1. Connect GitHub repository
2. Set environment variables in Railway dashboard
3. Deploy on git push to main branch
4. Railway provides:
   - Automatic HTTPS
   - MongoDB Atlas integration
   - Environment variable management
   - Logs and monitoring
   - Auto-scaling

**Render Deployment:**
1. Create new Web Service
2. Connect GitHub repository
3. Set build command: `npm install`
4. Set start command: `npm start`
5. Add environment variables
6. Deploy

**Environment Variables in Production:**
- Set all required variables in platform dashboard
- Never commit .env files to git
- Use platform's secret management for sensitive values

**Health Check Endpoint:**
```javascript
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});
```

## API Documentation

### Markdown Documentation

**Decision:** Document API endpoints in Markdown files

**Documentation Structure:**
```
/docs
  /api
    README.md              # API overview
    authentication.md      # Auth endpoints
    users.md               # User endpoints
    experts.md             # Expert endpoints
    forums.md              # Forum endpoints
    real-time.md           # WebSocket events
```

**Template for Each Endpoint:**
```markdown
## POST /api/auth/register

Register a new user account.

### Request Body

\`\`\`json
{
  "email": "user@example.com",
  "password": "securepassword",
  "fullName": "John Doe"
}
\`\`\`

### Response

**201 Created**
\`\`\`json
{
  "user": {
    "_id": "...",
    "email": "user@example.com",
    "fullName": "John Doe",
    "role": "student"
  },
  "accessToken": "..."
}
\`\`\`

**400 Bad Request**
\`\`\`json
{
  "errors": [
    {
      "msg": "Invalid email",
      "param": "email",
      "location": "body"
    }
  ]
}
\`\`\`

### Example

\`\`\`bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"securepassword","fullName":"John Doe"}'
\`\`\`
```

## Testing Strategy

### Test Types (Future Implementation)

1. **Unit Tests** - Test individual functions and services
2. **Integration Tests** - Test API endpoints with test database
3. **E2E Tests** - Test complete user flows

**Testing Tools:**
- Jest - Test runner
- Supertest - API testing
- MongoDB Memory Server - In-memory test database

## Security Checklist

- [x] JWT tokens with short expiry
- [x] httpOnly cookies for refresh tokens
- [x] bcrypt password hashing
- [x] Input validation with express-validator
- [x] CORS whitelist
- [x] Rate limiting
- [x] Helmet security headers
- [x] NoSQL injection prevention (Mongoose sanitization)
- [x] XSS prevention (input sanitization)
- [x] CSRF protection for cookie endpoints
- [x] Environment variables for secrets
- [x] File upload validation (GridFS access control)

## Performance Optimization

### MongoDB Indexes

All critical indexes defined in `ReMind-mongodb-database-design.md`

### Connection Pooling

```javascript
mongoose.connect(uri, {
  maxPoolSize: 10,
  minPoolSize: 2,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 45000
});
```

### Query Optimization

- Use projection to select only needed fields
- Use lean() for read-only queries
- Implement pagination for large datasets
- Cache frequently accessed data (future: Redis)

## Monitoring & Alerting (Future)

When scaling beyond MVP:
- Add APM (Application Performance Monitoring) with New Relic or DataDog
- Set up error tracking with Sentry
- Implement health dashboards
- Configure alerts for error rates and response times

## Migration Path to Advanced Infrastructure

**When to scale:**
- User base > 10,000 active users
- API requests > 100,000 per day
- Real-time connections > 1,000 concurrent

**What to upgrade:**
1. Move file storage from GridFS to S3
2. Add Redis for rate limiting and caching
3. Implement Elasticsearch for advanced search
4. Deploy to Kubernetes for auto-scaling
5. Add CDN for static assets
6. Implement background job processing with Bull/Redis

---

## Next Steps

1. Set up project structure
2. Install dependencies
3. Implement authentication system
4. Create MongoDB models with Mongoose
5. Build core API endpoints
6. Implement real-time features
7. Add file upload with GridFS
8. Set up logging
9. Write API documentation
10. Deploy to cloud platform

**Ready for implementation!**
