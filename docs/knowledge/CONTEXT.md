# Context: ReMind Platform

## Glossary

### Actor Roles
- **Guest**: An unauthenticated visitor. Limited to browsing and searching public data.
- **Student**: An authenticated user receiving support. Can participate in forums and join group discussions.
- **Expert**: An authenticated psychological expert. Must pass admin approval before appearing publicly.
- **Admin**: Platform operator. Approves experts, moderates content, and handles reports.

### Forum Domain
- **Forum**: A category or room for discussions (e.g., "General Support", "Managing Anxiety").
- **Forum Post**: The start of a discussion topic/question within a Forum. (Note: The platform uses "post" instead of "topic" to refer to the parent entity).
- **Forum Comment**: A reply to a Forum Post.
- **Forum Group Discussion**: A real-time chat space scoped within the forum model. Not a standalone chat feature.

### System & Content Rules
- **Anonymous Display Mode**: Allows students to participate in forums using a generic display name, preventing their private identity from being exposed in public reads.
- **Status (Moderation)**: Content uses explicit statuses (`active`, `hidden`, `deleted`, `under_review`). Guests only ever see `active` content.

### Authentication & Security
- **JWT & Refresh Tokens**: The platform uses short-lived access tokens and long-lived refresh tokens stored in MongoDB. See [ADR 0002: Auth, Refresh Tokens, and Expert States](docs/adr/0002-auth-refresh-tokens-and-expert-states.md).
- **Expert States**: Experts default to `pending` upon registration and require admin approval to become `active`. Pending experts can log in to complete their profile but cannot access paid features.
