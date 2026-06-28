# ReMind Docs Index

Single entry point to navigate all documentation. For each doc: what it is, who it's for, what it references, and when to update it.

## Directory Map

| Path | Purpose |
|------|---------|
| `docs/knowledge/` | Core reference — domain model, tech stack, product reqs, DB schema, legacy architecture |
| `docs/adr/` | Architecture Decision Records — rationale for past decisions |
| `docs/agents/` | AI agent guidance — JSON shapes, testing, issue tracker conventions |
| `docs/api/` | API route overviews — light, references `agents/` for details |

## File Catalog

### knowledge/ — Core Reference

| File | Purpose | Audience | Cross-refs | Update when |
|------|---------|----------|------------|-------------|
| `knowledge/CONTEXT.md` | Domain glossary: actor roles, forum terms, security posture | All | refs `adr/0002` | Adding domain terms, changing vocab, adding actors |
| `knowledge/TECHNICAL_STACK.md` | Full stack decisions: Express.js, MongoDB, JWT, Socket.io, deployment | All | refs DB schema | Changing middleware, auth strategy, deploy target, adding new libs |
| `knowledge/ReMind-platformsupport.md` | Vietnamese product requirements (source of truth for features) | Product | feeds into DB schema | Adding/removing features or actors |
| `knowledge/ReMind-mongodb-database-design.md` | All MongoDB collections, schemas, indexes, MVP build order | Backend | refs platform-support, TECHNICAL_STACK | Adding/removing collections, fields, indexes |
| `knowledge/ARCHITECTURE.md` | Legacy Firebase-first arch (marked LEGACY) | Maintenance | — | Only when Firebase code is touched |

### adr/ — Architecture Decisions

| File | Purpose | Audience | Cross-refs | Update when |
|------|---------|----------|------------|-------------|
| `adr/0001-forum-mvp-data-model-simplification.md` | Why no separate Topic collection, aggregated post detail, strict backend filtering | All | refs api/forum.md, agents/forum-api-knowledge.md | Revisiting forum data model |
| `adr/0002-auth-refresh-tokens-and-expert-states.md` | JWT + refresh token rotation, expert registration states, middleware split | All | refs knowledge/CONTEXT.md | Changing auth strategy or expert lifecycle |

### agents/ — AI Agent Guidance

| File | Purpose | Audience | Cross-refs | Update when |
|------|---------|----------|------------|-------------|
| `agents/README.md` | Integration rules: auth, security, soft-deletes, testing standards | Agents | refs agents/forum-api-knowledge.md, knowledge/CONTEXT.md | Changing testing workflow, auth middleware patterns |
| `agents/domain.md` | How to consume CONTEXT.md, ADRs, and glossary | Agents | refs knowledge/CONTEXT.md, adr/ | Rarely — only when doc structure changes |
| `agents/forum-api-knowledge.md` | Exact JSON request/response shapes per endpoint, auth rules | Agents, UI Gen | refs api/forum.md | Adding/modifying forum endpoints |
| `agents/issue-tracker.md` | Issue file conventions under `.scratch/` | Agents | refs agents/triage-labels.md | Changing issue file format |
| `agents/triage-labels.md` | Label mapping table | Agents | refs agents/issue-tracker.md | Adding/changing triage labels |

### api/ — API Overview

| File | Purpose | Audience | Cross-refs | Update when |
|------|---------|----------|------------|-------------|
| `api/forum.md` | Route listing grouped by access level | Humans, Agents | refs agents/forum-api-knowledge.md for full payloads | Adding/modifying forum routes |

## Update Rules

| When this happens | Update these |
|---|---|
| New endpoint added | `api/<domain>.md` + `agents/<domain>-api-knowledge.md` |
| New collection or field | `knowledge/ReMind-mongodb-database-design.md` |
| New middleware / auth change | `knowledge/TECHNICAL_STACK.md` + `adr/0002` if auth |
| Architecture decision made | `adr/<NNN>-<slug>.md` + this INDEX |
| Domain term / role changes | `knowledge/CONTEXT.md` |
| Product feature changes | `knowledge/ReMind-platformsupport.md` |
| Feature deprecation (Firebase) | `knowledge/ARCHITECTURE.md` |
| Agent integration rules change | `agents/README.md` |

## Known Gaps

- No `api/auth.md` — auth endpoint shapes only documented in `TECHNICAL_STACK.md` (code samples), not as structured API docs
- No `api/experts.md` — expert routes only listed in `TECHNICAL_STACK.md` outline
- `CONTEXT.md` referenced by `agents/domain.md` lives at `docs/knowledge/CONTEXT.md`, not root (root `CONTEXT.md` does not exist)
- `.scratch/` directory exists but is empty — no issues/PRDs created yet
