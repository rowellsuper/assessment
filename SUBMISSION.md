# Submission — Ajaia Docs

**Candidate:** Rowell Camero (`rowellcamero08@gmail.com`)  
**Assignment:** Ajaia LLC — AI-Native Full Stack Developer  
**Project:** Lightweight Collaborative Document Editor  
**Repository:** This monorepo (`client/` + `server/`)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Live Demo & Materials](#live-demo--materials)
3. [Tech Stack](#tech-stack)
4. [Features Delivered](#features-delivered)
5. [Reviewer Quick Start](#reviewer-quick-start)
6. [Demo Walkthrough](#demo-walkthrough)
7. [Architecture](#architecture)
8. [Database Schema](#database-schema)
9. [API Reference](#api-reference)
10. [Real-Time Collaboration](#real-time-collaboration)
11. [Access Control & Permissions](#access-control--permissions)
12. [Frontend Structure](#frontend-structure)
13. [Testing](#testing)
14. [Deployment](#deployment)
15. [AI Workflow](#ai-workflow)
16. [Tradeoffs & Limitations](#tradeoffs--limitations)
17. [What I Would Build Next](#what-i-would-build-next)

---

## Executive Summary

**Ajaia Docs** is a Google Docs–inspired lightweight document editor built in a 4–6 hour scope window, extended with stretch goals. Users can create and edit rich-text documents, upload/import files, share with role-based permissions, collaborate in near–real-time over WebSockets, leave comments and suggestions, browse version history, and export to Markdown or PDF.

The product is designed to be **reviewer-friendly**: three seeded accounts, reproducible sharing flows, Docker deployment, and automated API tests covering permissions and sharing.

**Design priorities:**

1. **Correct access control** — owners, editors, commenters, and viewers are enforced server-side.
2. **Credible editing UX** — TipTap rich text, auto-save, toolbar, file import.
3. **Collaboration signals** — live document sync, presence, remote cursors, live comment refresh.
4. **Simple ops** — SQLite, single Node process in production, Render/Docker ready.

---

## Live Demo & Materials

| Item | Location |
|------|----------|
| Source code | This repository |
| README (setup) | `README.md` |
| Architecture note | `ARCHITECTURE.md` |
| AI workflow note | `AI_WORKFLOW.md` |
| This submission | `SUBMISSION.md` |
| Walkthrough video | `VIDEO_URL.txt` *(add Loom/YouTube link before submit)* |
| Live deployment URL | `DEPLOY_URL.txt` *(add after Render deploy)* |

### Test Credentials

All accounts use password: **`password123`**

| Email | Suggested role in demo |
|-------|------------------------|
| `alice@ajaia.test` | Owner — create documents, share, accept suggestions |
| `bob@ajaia.test` | Editor — edit shared docs, comment, live co-editing |
| `carol@ajaia.test` | Viewer/commenter — test permission boundaries |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Vite 6, React Router 7 |
| Styling | Tailwind CSS 3, Lucide icons |
| Editor | TipTap 2 (ProseMirror) — StarterKit, Heading, Underline, Placeholder |
| HTTP client | Axios (interceptors for JWT + error handling) |
| Backend | Node.js 20, Express 4, TypeScript |
| Database | SQLite via `better-sqlite3` (WAL mode, foreign keys) |
| Auth | JWT (`jsonwebtoken`) + bcrypt password hashes |
| File upload | Multer (memory storage, 5 MB limit) |
| File conversion | mammoth.js (`.docx` → HTML), plain-text paragraph conversion |
| Real-time | `ws` WebSocket server on `/ws` |
| Export | turndown (HTML → Markdown), browser print (PDF) |
| Tests | Vitest + Supertest |
| Deploy | Docker multi-stage build, `docker-compose.yml`, `render.yaml` |

---

## Features Delivered

### Core requirements

| Feature | Status | Notes |
|---------|--------|-------|
| Create, rename, edit, save, reopen documents | ✅ | Auto-save (800 ms debounce), status indicator |
| Rich text formatting | ✅ | Bold, italic, underline, H1–H3, bullet/numbered lists |
| Upload `.txt` / `.md` as new document | ✅ | Dashboard upload button |
| Import into existing document | ✅ | Editor import replaces content (with confirm modal pattern on doc delete) |
| Share with another user | ✅ | Share by email (seeded users) |
| Owned vs shared lists | ✅ | Dashboard tabs |
| Persistence across refresh | ✅ | SQLite, HTML content storage |
| Auth | ✅ | Login page, JWT, protected routes |

### Stretch goals

| Feature | Status | Notes |
|---------|--------|-------|
| `.docx` upload/import | ✅ | mammoth.js server-side conversion |
| Role-based sharing | ✅ | `view`, `comment`, `edit` permissions |
| Real-time document sync | ✅ | WebSocket `document:update` broadcast |
| Presence ("who is viewing/typing") | ✅ | WebSocket presence + PresenceBar UI |
| Live remote cursors | ✅ | Colored carets with name labels; position synced after content update |
| Comments | ✅ | Sidebar panel, quoted text, color-coded by author |
| Suggestions | ✅ | Accept/reject applies text replacement in document |
| Edit/delete own comments | ✅ | Author-only; confirm modal for delete |
| Version history | ✅ | Auto-snapshot on save (max 30 versions), restore |
| Export Markdown / PDF | ✅ | Export menu in editor header |
| API integration tests | ✅ | 9 tests — sharing, permissions, comments, versions |
| Docker + Render config | ✅ | Persistent disk for SQLite |

---

## Reviewer Quick Start

### Prerequisites

- Node.js 20+
- npm

### Install & run (development)

```bash
# From project root
npm run install:all
npm run dev
```

- **Frontend:** http://localhost:5173  
- **API:** http://localhost:3001  
- Vite proxies `/api` and `/ws` to the backend.

> If the page looks unstyled, stop all dev servers and restart `npm run dev`. Use port **5173** (not 3001) in development.

### Run tests

```bash
npm test
```

Expected: **9 passing** integration tests in `server/src/documents.test.ts`.

### Production build (local)

```bash
npm run build
# Windows PowerShell:
$env:NODE_ENV="production"; npm start
# macOS/Linux:
NODE_ENV=production npm start
```

Open http://localhost:3001 — single process serves API + built React app.

### Docker

```bash
docker compose up --build
```

App at http://localhost:3001 with persistent SQLite volume.

---

## Demo Walkthrough

Recommended 5-minute reviewer flow:

### 1. Login & create

1. Open http://localhost:5173
2. Sign in as **Alice** (`alice@ajaia.test` / `password123`)
3. Click **New document** → enter a title
4. Type content; apply **bold**, **H1**, and a bullet list from the toolbar
5. Note the save status (Saved / Saving / Unsaved)

### 2. Upload & import

1. Return to dashboard → **Upload** a `.txt` or `.docx` file → new document created
2. Open a document → **Import** to replace content from file

### 3. Share with permissions

1. As Alice, open a document → **Share** panel
2. Share with `bob@ajaia.test` → permission **Edit**
3. Share with `carol@ajaia.test` → permission **Comment** or **View**
4. Sign in as Bob → document appears under **Shared with me**

### 4. Real-time collaboration

1. Open the same document in **two browser windows** (Alice + Bob)
2. Bob types → Alice sees content update live
3. Observe **presence avatars** and "is typing…" in the header bar
4. See **colored remote cursor** with collaborator name in the editor

### 5. Comments & suggestions

1. Select text in the editor → add a **comment** in the sidebar
2. Toggle **suggestion mode** → post a suggested replacement
3. As Alice (editor), **Accept** or **Reject** the suggestion
4. Edit or delete **your own** comments (pencil / trash icons; delete uses confirmation modal)
5. Your comments appear in **sky blue**; others use distinct per-user colors

### 6. Version history & export

1. Open **History** tab → see auto-saved snapshots
2. **Restore** a previous version
3. Use **Export** → Markdown download or PDF (print dialog)

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                         Browser (React SPA)                          │
│  Dashboard │ EditorPage │ TipTap │ Comments │ Share │ Version │ WS   │
└────────────┬───────────────────────────────┬─────────────────────────┘
             │ axios /api/*                  │ WebSocket /ws
             ▼                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    Express (TypeScript) — port 3001                   │
│  auth.ts │ documents routes │ permissions │ fileConvert │ ws.ts      │
└────────────┬─────────────────────────────────────────────────────────┘
             │ better-sqlite3
             ▼
┌──────────────────────────────────────────────────────────────────────┐
│                         SQLite (ajaia.db)                            │
│  users │ documents │ document_shares │ document_versions │ comments│
└──────────────────────────────────────────────────────────────────────┘
```

### Monorepo layout

```
AJAIA_assessment/
├── client/                 React + Vite frontend
│   └── src/
│       ├── api.ts          Axios API client
│       ├── pages/            Login, Dashboard, Editor
│       ├── components/       Editor, Comments, Share, Presence, Modals
│       ├── hooks/            useDocumentSocket (WS + presence + cursors)
│       └── utils/            export, userColors
├── server/                 Express API
│   └── src/
│       ├── index.ts          HTTP + static + WS upgrade
│       ├── routes/documents.ts
│       ├── permissions.ts
│       ├── ws.ts             WebSocket rooms
│       ├── db.ts             Schema, migrations, seed
│       └── documents.test.ts
├── Dockerfile
├── docker-compose.yml
├── render.yaml
├── README.md
├── ARCHITECTURE.md
├── AI_WORKFLOW.md
└── SUBMISSION.md
```

### Key design decisions

1. **HTML storage** — Document content stored as HTML (from TipTap). Simple to persist and export; tradeoff vs structured ProseMirror JSON.
2. **SQLite** — Zero external DB dependency; works with Docker + Render persistent disk. Not suitable for multi-instance horizontal scale without migration.
3. **Seeded JWT auth** — Reproducible demo without OAuth/email infrastructure.
4. **Debounced auto-save** — 800 ms client debounce; server creates version snapshot on each persisted save.
5. **Last-write-wins sync** — WebSocket broadcasts full document HTML on edit; no OT/CRDT. Adequate for demo; cursors bundled with document updates to avoid position drift.

---

## Database Schema

### `users`

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | UUID |
| email | TEXT UNIQUE | Login identifier |
| name | TEXT | Display name |
| password_hash | TEXT | bcrypt |
| created_at | TEXT | ISO datetime |

### `documents`

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | UUID |
| title | TEXT | Editable |
| content | TEXT | HTML body |
| owner_id | TEXT FK → users | Single owner |
| created_at, updated_at | TEXT | |

### `document_shares`

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| document_id | TEXT FK | |
| user_id | TEXT FK | Recipient |
| shared_by | TEXT FK | Grantor |
| permission | TEXT | `view` \| `comment` \| `edit` |
| created_at | TEXT | |
| UNIQUE(document_id, user_id) | | |

### `document_versions`

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| document_id | TEXT FK | |
| title, content | TEXT | Snapshot |
| created_by | TEXT FK | |
| created_at | TEXT | Max 30 per document (pruned on save) |

### `document_comments`

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| document_id | TEXT FK | |
| user_id | TEXT FK | Author |
| body | TEXT | Comment text |
| quoted_text | TEXT NULL | Selection quote |
| suggestion | TEXT NULL | Replacement text |
| is_suggestion | INTEGER | 0 or 1 |
| status | TEXT | `open` \| `resolved` \| `accepted` \| `rejected` |
| created_at | TEXT | |

---

## API Reference

Base URL: `/api` — all document routes require `Authorization: Bearer <token>`.

### Auth

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/login` | `{ email, password }` → `{ token, user }` |
| GET | `/auth/me` | Current user |

### Documents

| Method | Path | Description |
|--------|------|-------------|
| GET | `/documents` | `{ owned[], shared[] }` |
| POST | `/documents` | Create `{ title? }` |
| POST | `/documents/upload` | Multipart file → new document |
| GET | `/documents/:id` | Document + owner + permission + shares |
| PATCH | `/documents/:id` | Update `{ title?, content? }` (edit only) |
| POST | `/documents/:id/import` | Multipart file → replace content |
| DELETE | `/documents/:id` | Owner only |

### Sharing

| Method | Path | Description |
|--------|------|-------------|
| POST | `/documents/:id/share` | `{ email, permission }` |
| PATCH | `/documents/:id/share/:shareId` | Update permission |
| DELETE | `/documents/:id/share/:shareId` | Revoke access |

### Versions

| Method | Path | Description |
|--------|------|-------------|
| GET | `/documents/:id/versions` | List snapshots |
| POST | `/documents/:id/versions/:versionId/restore` | Restore (edit only) |

### Comments

| Method | Path | Description |
|--------|------|-------------|
| GET | `/documents/:id/comments` | List comments |
| POST | `/documents/:id/comments` | Add comment/suggestion |
| PATCH | `/documents/:id/comments/:commentId` | `{ status }` resolve/accept/reject **or** `{ body, suggestion? }` edit own |
| DELETE | `/documents/:id/comments/:commentId` | Delete own comment only |

### Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | `{ status: "ok" }` |

---

## Real-Time Collaboration

WebSocket endpoint: `/ws?token=<jwt>&documentId=<id>`

### Message types (client ↔ server)

| Type | Direction | Purpose |
|------|-----------|---------|
| `presence` | server → clients | List of users in room + `isEditing` flag |
| `editing` | client → server | Broadcast typing/focus state |
| `document:update` | client → server → others | `{ title, content, head?, from?, to? }` live content sync |
| `cursor:update` | client → server → others | Remote caret position |
| `cursor:leave` | client → server → others | Remove remote caret |
| `comments:notify` | client → server | Author posts comment |
| `comments:changed` | server → clients | Trigger comment panel refresh |

### Cursor sync strategy

Remote cursors use ProseMirror document offsets. To prevent the caret from jumping through text before content arrives:

1. Cursor position is **bundled** with `document:update` messages.
2. While a remote user's content is syncing, their cursor stays **frozen** at the last screen position.
3. After `setContent` completes, the cursor **moves once** to the confirmed position.
4. Standalone `cursor:update` messages are delayed slightly so document updates can arrive first.

### Presence UI

- **PresenceBar** — avatar stack with per-user colors, "is typing…" labels.
- **RemoteCursorsOverlay** — colored caret + name label in the editor canvas.

---

## Access Control & Permissions

Implemented in `server/src/permissions.ts` and enforced on every route.

| Permission | View doc | Comment | Edit content | Share manage | Delete doc |
|------------|----------|---------|--------------|--------------|------------|
| Owner | ✅ | ✅ | ✅ | ✅ | ✅ |
| `edit` share | ✅ | ✅ | ✅ | ❌ | ❌ |
| `comment` share | ✅ | ✅ | ❌ | ❌ | ❌ |
| `view` share | ✅ | ❌ | ❌ | ❌ | ❌ |

Non-owners receive **404** (not 403) for unauthorized document access to avoid leaking document existence.

Comment edit/delete: **author only**, open comments only.

Suggestion accept: requires **edit** permission on the document.

---

## Frontend Structure

### Pages

| Page | Route | Purpose |
|------|-------|---------|
| `LoginPage` | `/login` | Email/password auth |
| `DashboardPage` | `/` | Owned + shared document lists, upload, create |
| `EditorPage` | `/doc/:id` | Main editor shell |

### Notable components

| Component | Role |
|-----------|------|
| `RichTextEditor` | TipTap wrapper, toolbar, remote cursor overlay |
| `CommentsPanel` | Live comments, suggestions, edit/delete own |
| `ConfirmModal` | Destructive action confirmation (delete comment) |
| `SharePanel` | Email share + permission selector |
| `VersionHistoryPanel` | Snapshot list + restore |
| `PresenceBar` | Who is viewing / typing |
| `ExportMenu` | Markdown + PDF export |
| `useDocumentSocket` | WebSocket hook: sync, presence, cursors |

### API client (`client/src/api.ts`)

- Axios instance with `baseURL: '/api'`
- Request interceptor attaches JWT from `localStorage`
- Centralized error mapping (network unreachable, 500, API `error` field)
- Typed methods for all REST endpoints

---

## Testing

```bash
npm test
```

**Suite:** `server/src/documents.test.ts` (Vitest + Supertest)

| Test | Validates |
|------|-----------|
| Create document as owner | POST `/documents` |
| Share with edit permission | POST share |
| Shared doc in recipient list | GET `/documents` |
| Shared editor can read/edit | GET + PATCH |
| Version history on content change | GET versions |
| View-only user denied edit | PATCH → 403 |
| Comment-only user can comment, not edit | POST comment + PATCH → 403 |
| Author can edit/delete own comment; others denied | PATCH/DELETE → 403 |
| Non-owner cannot delete document | DELETE → 404 |

Tests use an isolated SQLite file (`server/data/test.db`) destroyed after the run.

---

## Deployment

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | HTTP port |
| `JWT_SECRET` | dev default | **Set in production** |
| `DATABASE_PATH` | `server/data/ajaia.db` | SQLite path |
| `NODE_ENV` | — | `production` for prod |

### Render (recommended)

1. Push repo to GitHub
2. Create **Web Service** on Render → Docker runtime
3. Mount persistent disk at `/app/server/data`
4. Set `JWT_SECRET`
5. Health check: `GET /api/health`
6. Or use included `render.yaml` blueprint

### Docker

Multi-stage build compiles client + server; production image runs `node server/dist/index.js` and serves `client/dist` statically.

---

## AI Workflow

**Tool:** Cursor IDE with Claude (AI-assisted coding)

### Where AI helped most

1. **Initial scaffolding** — monorepo, Express routes, React pages, TipTap setup
2. **WebSocket layer** — room management, presence, document/cursor relay
3. **Stretch features** — comments, version history, export, permission model
4. **Bug fixes** — Tailwind/PostCSS config, real-time sync, cursor drift, comment colors
5. **Documentation** — README, architecture notes, this submission

### What I reviewed, changed, or rejected

| AI suggestion | Decision |
|---------------|----------|
| Next.js + Prisma + Postgres | **Rejected** — simpler Docker deploy with Express + SQLite |
| Supabase / OAuth auth | **Rejected** — seeded JWT for reproducible demo |
| Full OT/CRDT (Yjs) | **Deferred** — last-write-wins WS sync within time budget |
| `fetch` for API | **Changed to axios** — interceptors, cleaner error handling |
| Hide remote cursors during sync | **Changed** — freeze position, move after content confirmed |
| Browser `confirm()` for delete | **Changed** — custom `ConfirmModal` component |

### Verification approach

1. `npm test` after permission/API changes
2. `npm run build` for TypeScript + Vite production compile
3. Manual two-browser testing for real-time sync, cursors, comments
4. Permission matrix testing (Alice/Bob/Carol accounts)

See `AI_WORKFLOW.md` for the full narrative.

---

## Tradeoffs & Limitations

### What works well

- End-to-end document lifecycle with persistence
- Role-based sharing enforced server-side
- Near–real-time multi-user editing feel (content + presence + cursors)
- Comments with suggestions and author self-service edit/delete
- Version snapshots and export
- Single-command local dev and Docker deploy

### Known limitations

| Limitation | Detail |
|------------|--------|
| No true CRDT/OT | Concurrent edits are last-write-wins; possible overwrite if two users edit same paragraph simultaneously |
| HTML storage | Harder to diff/merge than structured editor state |
| No inline comment anchors | Comments live in sidebar, not anchored highlights in text |
| `.md` upload | Treated as plain text paragraphs, not rendered Markdown |
| Seeded users only | Share by email works only for pre-seeded accounts |
| No email notifications | Share/comment alerts not implemented |
| SQLite scaling | Single-writer; not for multi-region production |
| Remote cursor accuracy | Depends on document sync timing; frozen-then-move strategy mitigates drift |

### Intentionally out of scope

- OAuth / user registration
- Full Google Docs parity (tables, images, collaborative undo)
- Mobile-optimized editor
- Full-text search

---

## What I Would Build Next

**Next 2–4 hours (highest impact):**

1. **Yjs + TipTap Collaboration** — true concurrent editing without overwrites
2. **Inline comment anchors** — highlight quoted ranges in the document body
3. **Operational transform or diff-based sync** — smaller payloads than full HTML broadcast

**Next sprint:**

4. User registration + email share invites  
5. Postgres migration for production scale  
6. Comment email notifications  
7. Image upload in editor  
8. E2E tests (Playwright) for editor + real-time flows  

---

## Submission Checklist

- [x] Source code in repository
- [x] README with setup instructions
- [x] Architecture note (`ARCHITECTURE.md`)
- [x] AI workflow note (`AI_WORKFLOW.md`)
- [x] This submission document (`SUBMISSION.md`)
- [x] API tests (`npm test` — 9 passing)
- [x] Docker + Render deployment config
- [ ] Walkthrough video URL in `VIDEO_URL.txt`
- [ ] Live deployment URL in `DEPLOY_URL.txt`
- [ ] Google Drive folder with repo + video link (per assignment instructions)

---

## Contact

**Rowell Camero**  
Email: rowellcamero08@gmail.com

Thank you for reviewing Ajaia Docs.
