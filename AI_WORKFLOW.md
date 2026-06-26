# AI Workflow Note — Ajaia Docs

**Candidate:** Rowell Camero  
**Assignment:** Ajaia LLC AI-Native Full Stack Developer

## Tools Used

- **Cursor** (AI-assisted IDE) with Claude — primary coding assistant for scaffolding, implementation, and documentation
- Standard dev tooling: npm, Vitest, Docker, Render docs

## Where AI Materially Sped Up Work

1. **Project scaffolding** — Generated the monorepo structure, Express route boilerplate, React page components, and TipTap integration in one session instead of manual file-by-file setup (~1–2 hours saved).

2. **SQLite schema + access control** — AI drafted the `users`, `documents`, and `document_shares` tables and the `canAccessDocument()` helper. I reviewed foreign keys, unique constraints, and index choices.

3. **TipTap toolbar + extensions** — Faster than reading ProseMirror docs from scratch; AI produced a working toolbar wired to StarterKit, Underline, and Heading extensions.

4. **Documentation** — README, architecture note, and submission checklist drafted quickly, then edited for accuracy against the actual codebase.

5. **Docker + Render config** — Multi-stage Dockerfile and `render.yaml` blueprint generated from requirements; verified paths match the build output.

## What I Changed or Rejected

| AI suggestion | Decision |
|---------------|----------|
| Next.js full-stack with Prisma | **Rejected** — SQLite on Vercel serverless is awkward; kept Express + Vite for simpler Docker deploy |
| Supabase auth | **Rejected** — Seeded JWT auth is faster to demo sharing without external signup |
| .docx support via mammoth | **Deferred** — Scope cut; stated clearly in UI/README |
| ProseMirror JSON storage | **Changed to HTML** — Simpler persistence, adequate for assignment |
| Real-time WebSockets | **Deferred** — Listed as stretch; prioritized sharing + editing depth |
| Generic error middleware | **Kept but narrowed** — Only handle multer/file errors explicitly |

## How I Verified Correctness

1. **Automated tests** — `npm test` runs sharing integration tests (create, share, list, edit, delete guard).

2. **Manual flows** — Tested locally:
   - Login with all three seeded users
   - Create/rename/edit with auto-save and page refresh
   - Upload `.txt` and `.md` files
   - Alice → share with Bob → Bob sees in "Shared with me" → Bob edits → Alice sees changes
   - Delete restricted to owner

3. **API validation** — Confirmed 400/401/404 responses for missing fields, bad auth, and unauthorized access.

4. **Production build** — `npm run build` + `NODE_ENV=production npm start` serves SPA and API from one port.

5. **UX review** — Checked save status indicators, empty states, file type hints, and owned vs shared badges.

## Judgment Over Volume

AI generated a large initial codebase; I focused review time on **access control**, **data persistence**, and **sharing UX** — the areas most likely to fail reviewer scrutiny. I did not add features (comments, version history, real-time) that would dilute quality within the 4–6 hour window.

## Walkthrough Video

Record a 3–5 minute Loom covering: login → create doc → format text → upload file → share with second user → show persistence after refresh. Link goes in `VIDEO_URL.txt`.
