# Task 2-b — AIStore backend API (full-stack-developer / backend)

Date: 2026-10-10

## Files created
- `src/lib/aitools/server.ts` — shared server helpers: `ApiTool` type, `DbTool` type, `serializeTool()`, `slugify()`, `matchingCategoryIds()`, `isCategoryId()`, `PLATFORM_VALUES`, zod `submissionSchema` + `voteSchema`
- `src/app/api/tools/route.ts` — GET (list/search/filter/sort/paginate) + POST (community submission)
- `src/app/api/tools/[id]/route.ts` — GET single tool (async `params` per Next.js 16)
- `src/app/api/tools/[id]/vote/route.ts` — POST toggle anonymous upvote (transaction)

## Key implementation notes for the next agent
- **IMPORTANT: `Tool` table has NO `votes` column.** Vote count is DERIVED from the `Vote` table (`_count.toolVotes`). Every read includes `_count: { select: { toolVotes: true } }` and `serializeTool(row, row._count.toolVotes)` fills the contract's `votes: number`. `sort=votes` uses `orderBy: { toolVotes: { _count: "desc" } }`. Vote toggle = create/delete `Vote` row in a `db.$transaction`, then `tx.vote.count()` returns the new count (floor at 0 is inherent). Responses match the fixed contract exactly.
- CATEGORIES/Platform constants are imported from `src/lib/aitools/data.ts` (single source of truth; that file is pure data, safe server-side).
- GET filters: `q` → OR contains over name/repo/desc/replaces + category LABEL match (ids resolved in JS from CATEGORIES); `cat`, `platform` (validated against the 6 values, invalid → ignored), `selfHosted=1`, `sourceAvailable=1`, `trending=1` → `weeklyGain: { not: null }`; `sort` whitelist default newest (momentum = weeklyGain desc, stars desc); `page` 1-based, `limit` default 24 cap 999.
- POST submission: zod (name 2–60, repo regex `^[\w.-]+\/[\w.-]+$`, desc 10–200, replaces 2–80, cat valid id, platforms subset default `["web"]`, submitter ≤120, `homepage` accepted but not persisted — no column). Unknown fields stripped. 400 = `{ error: "Validation failed", issues }`; duplicate repo (case-insensitive/trim, checked via LIKE + exact JS compare) → 409 `"This repository is already listed."`; id = `slugify(name)`, collisions → `-2`, `-3`…; created row: status community, stars 0, emoji 🧩, glyph null, submitter stored.
- All handlers: `runtime = "nodejs"`, try/catch → 500 `{ error: "Internal server error" }`; list route has `dynamic = "force-dynamic"`.
- Frontend wiring: `fetch("/api/tools?...")`, `fetch("/api/tools/${id}")`, `fetch("/api/tools/${id}/vote", { method: "POST", body: JSON.stringify({ voter }) })` — voter is an anonymous token ≥8 chars (e.g. localStorage uuid).

## Verification
- All 8 contract curl tests passed (list total=64, search/sort, trending/momentum, 201 submit with slug id `night-scribe`, 409 dup incl. case-insensitive, 400 with issues, vote toggle 1→0, GET created tool + 404s).
- Extras verified: sort=votes via _count, label search `q=Voice`, platform/selfHosted/sourceAvailable filters, pagination page=2, slug collision → `night-scribe-2`, trim behavior via zod.
- `bun run lint` clean; dev.log shows only healthy 2xx/4xx, no compile or runtime errors.
- DB restored to clean state after tests: 64 curated tools, 0 community, 0 Vote rows, all votes 0 (temp cleanup script deleted after use).
