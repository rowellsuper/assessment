# Ajaia Docs

A lightweight collaborative document editor built for the Ajaia LLC full-stack developer assignment. Create, edit, share, and import documents with rich-text formatting.

## Live Demo

> **Deploy before submission:** See [Deployment](#deployment) below. Update this URL after deploying to Render.

`https://YOUR-RENDER-URL.onrender.com`

## Features

- **Document editing** — Create, rename, edit, save, and reopen documents with auto-save
- **Rich text** — Bold, italic, underline, headings (H1–H3), bullet and numbered lists (TipTap)
- **File upload** — Import `.txt`, `.md`, and `.docx` files as new documents or into an existing draft
- **Sharing** — Owners can share with **view**, **comment**, or **edit** permissions
- **Real-time sync** — WebSocket live updates for document content and comments across all viewers
- **Comments & suggestions** — Threaded comments with accept/reject suggestions
- **Version history** — Auto-snapshots on save, restore previous versions
- **Export** — Download as Markdown or PDF (print)
- **Persistence** — SQLite database; formatting preserved as HTML

## Demo Accounts

| Email | Password | Name |
|-------|----------|------|
| `alice@ajaia.test` | `password123` | Alice Chen |
| `bob@ajaia.test` | `password123` | Bob Martinez |
| `carol@ajaia.test` | `password123` | Carol Williams |

**Sharing demo flow:**
1. Sign in as Alice → create a document → Share → pick permission → enter `bob@ajaia.test`
2. Sign in as Bob (edit) or Carol (view/comment) → document appears under "Shared with me"
3. Open two browser tabs as different users to see **live presence** indicators
4. Bob adds a **comment** or **suggestion** → Alice accepts it from the sidebar
5. Check **Version history** tab → restore a previous snapshot
6. Use **Export** → Markdown or PDF

## Local Setup

### Prerequisites

- Node.js 20+
- npm

### Install & Run

```bash
# From project root
npm run install:all
npm run dev
```

- Frontend: http://localhost:5173
- API: http://localhost:3001

The Vite dev server proxies `/api` requests to the backend.

> **If styles look broken (plain/unstyled page):** An old Vite process may still be running without PostCSS. Stop all terminals (`Ctrl+C`), then run `npm run dev` again. Open **http://localhost:5173** only — not port 3001 (API only in dev).

### Production Build (local)

```bash
npm run build
NODE_ENV=production npm start
```

Open http://localhost:3001 — the server serves the built React app and API.

### Docker

```bash
docker compose up --build
```

App runs at http://localhost:3001 with persistent SQLite volume.

### Tests

```bash
npm test
```

Runs API integration tests for document creation and sharing (Vitest + Supertest).

## Supported File Types

- `.txt` — plain text, converted to paragraphs
- `.md` / `.markdown` — treated as plain text (no Markdown rendering)
- `.docx` — Word documents, converted to HTML via mammoth.js

Max file size: 5MB.

## Project Structure

```
├── client/          React + Vite + TipTap frontend
├── server/          Express API + SQLite
├── Dockerfile       Production container
├── docker-compose.yml
├── render.yaml      Render deployment blueprint
├── ARCHITECTURE.md
├── AI_WORKFLOW.md
└── SUBMISSION.md
```

## Deployment

### Render (recommended)

1. Push this repo to GitHub
2. Create a new **Web Service** on [Render](https://render.com) → connect repo
3. Set **Runtime** to Docker
4. Add a persistent disk mounted at `/app/server/data`
5. Set `JWT_SECRET` (or let Render generate one)
6. Deploy — health check: `/api/health`

Or use the included `render.yaml` blueprint for one-click deploy.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server port |
| `JWT_SECRET` | dev default | JWT signing secret (set in production) |
| `DATABASE_PATH` | `server/data/ajaia.db` | SQLite file path |
| `NODE_ENV` | — | Set to `production` for prod |

## What's Working / Incomplete

**Working:** Auth, CRUD, rich-text editing, auto-save, file upload/import, role-based sharing, presence, comments/suggestions, version history, export, persistence, tests.

**Not included:** True real-time co-editing (OT/CRDT), inline comment anchors in text, email notifications.

**Next steps:** Yjs collaborative editing, inline comment highlights, email share invites.

## Walkthrough Video

See `VIDEO_URL.txt` — add your Loom/YouTube link before submission.
