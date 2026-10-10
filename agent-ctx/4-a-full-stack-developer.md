# Task 4-a — Backend: pending submissions + moderation + status filter

## Files touched
- `src/app/api/tools/route.ts` (modified)
- `src/app/api/tools/[id]/moderate/route.ts` (new)
- `src/lib/aitools/server.ts` (modified — added `moderateSchema`)
- `prisma/seed-pending.ts` (new)

## Contract changes (for the frontend agent)
1. **POST /api/tools** now creates rows with `status: "pending"` (was `"community"`). Everything else identical: same zod validation (400 `{error:"Validation failed",issues}`), same case-insensitive duplicate-repo 409 (matches rows in ANY status, incl. pending), same slug generation, 201 `{tool}` with the created tool (status "pending").
2. **GET /api/tools** accepts optional `status` query param:
   - `status=pending` → moderation queue (only pending rows)
   - `status=community` / `status=curated` → exact filter
   - absent or invalid value → public listing: `status: { not: "pending" }` (pending rows are now HIDDEN from the default list — after approve, a tool appears in the default list)
   - Response shape unchanged `{tools,total,page,limit}`; all other filters/sorts unchanged.
3. **GET /api/tools?sort=votes** is now deterministic: `orderBy: [{toolVotes:{_count:"desc"}},{stars:"desc"}]`.
4. **NEW POST /api/tools/[id]/moderate** — body `{action:"approve"|"reject"}` (zod, 400 `{error:"Validation failed",issues}` on bad body):
   - `approve`: pending→community; community/curated = idempotent no-op. 200 `{action:"approve", tool:<ApiTool>}`.
   - `reject`: allowed only for pending|community → DELETEs the row (Vote cascade). Curated → 400 `{error:"Curated tools cannot be removed."}`. 200 `{action:"reject", deleted:true}`.
   - Unknown id → 404 `{error:"Tool not found"}`. Errors wrapped → 500.
5. **prisma/seed-pending.ts** (`bun prisma/seed-pending.ts`, idempotent): upserts 2 demo pending submissions `nightowl` (NightOwl, nightscout/nightowl, writing, web+mac) and `promptdeck` (PromptDeck, labs/promptdeck, devtools, web), both submitter "QA Bot", emoji 🧩, stars 0; re-run forces status back to "pending".
6. `moderateSchema` exported from `src/lib/aitools/server.ts` if the frontend needs to reuse it.

## Test results (curl, all green)
- Baseline: total 64 all curated; `status=pending` → 0; `status=bogus` → treated as absent.
- Submission → 201 status "pending", invisible in default GET (total 64), visible in `status=pending` (total 1); duplicate repo 409 still enforced against pending rows.
- Approve → 200 status "community", default GET total 65; repeat approve idempotent.
- Reject → 200 `{action:"reject",deleted:true}`; GET single 404; default total back to 64.
- Reject curated (opencode) → 400 "Curated tools cannot be removed."; approve opencode → 200 no-op, status stays "curated".
- Bad action body / missing body → 400 with issues; unknown id → 404.
- `sort=votes` ×3 requests → identical order (tiebreak by stars visible: 391400→211900→174000→154000→151000).
- Lint clean, project tsc clean (only pre-existing examples/ + skills/ noise), dev.log healthy (2xx/4xx only).

## Final DB state
- 64 curated, 0 community, 2 pending (`nightowl`, `promptdeck`), 0 Vote rows — verified via `GET /api/tools?status=pending` (total 2) and default GET (total 64).
- NOTE: frontend can now surface a moderation queue via `GET /api/tools?status=pending` and mutate via the moderate endpoint; pending tools do NOT appear in default/browse/search listings.
