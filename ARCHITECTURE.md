# Architecture Note — Ajaia Docs

## Overview

Ajaia Docs is a monorepo with a **React (Vite) frontend** and **Express (TypeScript) backend**, backed by **SQLite**. In production, a single Node process serves the API and static frontend build.

```
┌─────────────┐     /api/*      ┌──────────────────┐     SQL      ┌─────────┐
│  React SPA  │ ──────────────► │  Express API     │ ───────────► │ SQLite  │
│  TipTap     │   JWT auth      │  auth, docs,     │              │  file   │
│  editor     │                 │  sharing, upload │              └─────────┘
└─────────────┘                 └──────────────────┘
```

## Prioritization Decisions

### 1. Rich-text editing depth over feature breadth

I chose **TipTap** (ProseMirror-based) because it delivers a credible editing experience quickly: toolbar formatting, headings, lists, and HTML persistence without building a custom contenteditable layer.

**Tradeoff:** Content is stored as HTML, not ProseMirror JSON. HTML is simpler to query/debug and sufficient for this scope, but a production system might prefer a structured format for migrations and export.

### 2. Simplicity of auth and sharing

Rather than OAuth or email magic links, I implemented **seeded users + JWT login**. This keeps the sharing demo reproducible for reviewers (Alice shares with Bob in two clicks) without external services.

**Sharing model:**
- `documents.owner_id` — single owner
- `document_shares` — many-to-many grant table
- Shared users get **edit access** (not view-only) to keep the demo flow short
- Dashboard splits **Owned** vs **Shared with me** lists

### 3. SQLite for zero-ops persistence

SQLite via `better-sqlite3` avoids a hosted Postgres dependency (free-tier limits, connection pooling on serverless). For a single-instance Docker deploy on Render with a persistent disk, SQLite is appropriate.

**Tradeoff:** No horizontal scaling or multi-writer concurrency. Acceptable for this assignment; would move to Postgres + connection pool for production.

### 4. File upload scope

Supported **`.txt` and `.md` only** — no `.docx` parser to avoid dependency risk and time sink. Two product-relevant flows:

1. **Upload on dashboard** → creates a new document
2. **Import in editor** → replaces current draft content

Plain text is converted to simple HTML paragraphs server-side.

### 5. Auto-save over manual save button

The editor debounces saves (800ms) and shows status (Saved / Saving / Unsaved). This matches user expectations for a docs-like product and reduces "did I save?" friction.

## API Design

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/auth/login` | Login, returns JWT |
| GET | `/api/auth/me` | Current user |
| GET | `/api/documents` | Owned + shared lists |
| POST | `/api/documents` | Create document |
| POST | `/api/documents/upload` | File → new document |
| GET | `/api/documents/:id` | Get document + share metadata |
| PATCH | `/api/documents/:id` | Update title/content |
| POST | `/api/documents/:id/import` | File → existing document |
| POST | `/api/documents/:id/share` | Grant access by email |
| DELETE | `/api/documents/:id/share/:shareId` | Revoke access |
| DELETE | `/api/documents/:id` | Owner-only delete |

Access control is enforced in route handlers via `canAccessDocument()` — owner or share row required.

## Testing Strategy

One **integration test suite** (`documents.test.ts`) covers the sharing lifecycle end-to-end: create → share → recipient list → edit → delete denied for non-owner. This tests the highest-risk business logic (access control) rather than UI snapshots.

## Deployment

Docker multi-stage build: compile client + server, run production Node image. Render blueprint includes persistent disk for SQLite survival across deploys.

## What I Would Build Next

1. **Real-time collaboration** — Yjs + TipTap Collaboration extension
2. **Version history** — snapshot table on each save
3. **Read-only shares** — `permission` column on `document_shares`
4. **.docx import** — mammoth.js for HTML conversion
