# AIStore — Find the best AI tools

A curated directory of open and open-source AI tools: public directory with community voting, submissions and a "Wanted alternatives" request board — plus a full admin console for moderation, a tool catalog editor, a blog CMS and ad management.

Built with **Next.js 16 (standalone) / React 19 / Tailwind v4 / Prisma + Neon Postgres**, run with **bun**. Single-page app: all public views (Discover → tool detail) and the admin console switch inside one route — `src/components/aitools/home.tsx` owns a `ViewId` state, there are no Next routes beyond the REST API under `src/app/api/`.

## Quickstart

```bash
bun install
cp .env.example .env          # fill in DATABASE_URL + ADMIN_TOKEN
bun run db:generate           # prisma client
bun run db:push               # sync schema to the database in DATABASE_URL
bun prisma/seed.ts            # curated catalog (64 tools)
bun prisma/seed-wants.ts      # request board demo state
bun prisma/seed-posts.ts      # blog demo posts
bun prisma/seed-ads.ts        # ads + synthetic analytics
bun run dev                   # http://localhost:3000
```

All seeds are idempotent upserts. `prisma/seed-pending.ts` can add two demo submissions for the review queue; `prisma/featured-seed.ts` re-flags the editors' picks trio.

### Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | Neon **direct** endpoint (`postgresql://…?sslmode=require`) — not the `-pooler` URL: the app uses Prisma interactive transactions |
| `ADMIN_TOKEN` | yes* | Shared moderator secret for the admin console + every admin API. Generate: `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"` |
| `UPLOAD_DIR` | no | Upload storage dir (default `public/uploads`; served statically at `/uploads/<name>`) |

\* without `ADMIN_TOKEN` every admin endpoint fails closed (503) — the console cannot be opened.

### Scripts

| Command | Purpose |
| --- | --- |
| `bun run dev` | Dev server on :3000 (logs to `dev.log`) |
| `bun run build` / `bun run start` | Standalone production build / server (`server.log`) |
| `bun run test` / `test:watch` | Vitest suite (**166 tests / 15 files**) |
| `bun run lint` | ESLint |
| `bun run db:push / db:generate / db:migrate / db:reset` | Prisma |

**Test philosophy:** API + client-logic tests run the real route handlers against an in-memory fake (`tests/api/fake-db.ts`) that *throws on any query shape the routes don't already use* — new DB calls fail the suite loudly. Ordering in the fake mirrors the live backend (Postgres: ASC → NULLS LAST, DESC → NULLS FIRST; explicit `nulls` honored). React rendering itself is untested (deliberate — the UI was verified in real browsers).

## Notes on how things work

- **Data model** (`prisma/schema.prisma`): `Tool` (id = slug, platforms CSV, `status` curated/community/pending, editorial `featured`), `Vote` (unique toolId+voter — vote counts are always derived, never stored on Tool), `Want`/`WantVote` (dedupe-by-target: duplicate requests become votes), `Post` (slug + `previousSlugs` CSV), `Ad`, `PageView` (cookie-less analytics), `RateEvent` (rate-limit counters).
- **Auth** is a single shared secret: requests send `Authorization: Bearer <ADMIN_TOKEN>`. Anonymous feature flows (vote, submit, want-request, upload) are rate-limited per IP from `X-Forwarded-For` (the Caddy proxy overwrites it — safe behind it). Server files: `src/lib/aitools/{server,rate-limit,admin-session,image-validate}.ts`.
- **Brand logos** are resolved at render time from the repo owner (see `brandLogoUrl()` in `src/lib/aitools/data.ts`) so every tool shows its authentic mark; `logoUrl` is an explicit override.
- **Community submissions** land as `status: "pending"` — hidden from public reads until approved in the review queue.

## Deployment (`.zscripts`)

`build.sh` → `database-runtime-build.sh` → `start.sh`. The scripts expect `DATABASE_URL` (+ `ADMIN_TOKEN`) **injected by the deployment environment** and refuse `file:` URLs (the backend is Postgres). Runtime image uploads under `public/uploads/` are **ephemeral across redeploys** — move the adapter in `src/app/api/upload/route.ts` to object storage when durability matters.

## Conventions

- `worklog.md` is the development journal — one dated block per task with work log + stage summary; read it before changing anything non-obvious.
- Commits are thematic (`feat(scope): …`); tests and fixes may arrive in the same theme but keep each commit working.
- Markdown is hand-rolled (`src/components/aitools/md.tsx`, no `dangerouslySetInnerHTML`); image upload validation is dependency-free (`src/lib/aitools/image-validate.ts`).
- See `.env.example` for the full variable list and `tests/` for the suite.
