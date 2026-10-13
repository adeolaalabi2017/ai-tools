# EmDash as a replacement for AIStore's CMS — migration assessment

*Research doc, Oct 13 2026. Sources: the EmDash README (github.com/emdash-cms/emdash) and
docs.emdashcms.com pages cited inline. AIStore facts come from this repo's state at
`aded706` + the docs commit. Anything I did not verify hands-on is flagged.*

## TL;DR

**Keep AIStore as the product of record.** Do not re-platform to EmDash today. Run the
repo's own hardening track forward instead, and steal EmDash's data-level patterns where
they close our accepted gaps — the durable object-storage adapter being the clear first one.
Full migration is a real, credible path **if** AIStore ever becomes a content-first
publication (blogs/editorials > catalog-first), and this doc keeps the go/no-go facts
(+ a migration checklist) frozen so the decision can be re-made with less research.

The reasons are structural, not quality-based: EmDash is excellent — but it is an
**Astro-application framework**, not a library, while AIStore is a single Next.js
application with a bespoke in-app CMS. Its public delivery model floors *through Astro*
(Architecture doc: "EmDash runs inside an Astro application… parts of one deployed
application"), and its REST API is **not** an anonymous-public content API (only public
comments GET/POST are; docs.emdashcms.com/reference/rest-api), so there is no supported
"Next.js frontend reads EmDash headless" mode to bolt onto.

## What EmDash is (verified)

| Fact | Status | Source |
| --- | --- | --- |
| Full-stack TS CMS on Astro ("spiritual successor to WordPress"); 13.6k★, MIT, production-stable; core packages semver, first-party plugins still 0.x | README | github.com/emdash-cms/emdash |
| Runs on Cloudflare (D1+R2+Workers) or **any Node.js server with SQLite**; "portable abstractions at every layer" (Kysely for SQL, S3 API for storage) | README | — |
| **One deployed application** — public pages + admin + CMS runtime are one app; needs `output: "server"` + React admin hydration | Architecture doc | docs.emdashcms.com/concepts/architecture/ |
| Node.js deployment shape: `@astrojs/node` standalone — same *shape* as our bun-run standalone server | Architecture doc | — |
| **PostgreSQL on Node is first-class** (pg.Pool adapter, pool tuning, role-ownership runbook, mixed-owner repair); Hyperdrive variant for Postgres behind Workers; libSQL too | Database doc | docs.emdashcms.com/deployment/database/ |
| **Sandboxed plugins are D1-only.** On a Node/Postgres deployment, standard plugins run with host-app access (no capability sandbox) | Database + hyperdrive section | — |
| Auth: passkey-first + GitHub/Google/Microsoft/Atmosphere providers, magic links (needs email provider), invites, 5-role RBAC; Cloudflare Access becomes the *exclusive* production method on CF deploys | Auth doc | docs.emdashcms.com/guides/authentication/ |
| REST API under `/_emdash/api/` (OpenAPI 3.1, success/error envelope, revision tokens, edit locks, i18n). **Only public comments GET/POST are anonymous**; content REST needs session/Bearer | REST doc | docs.emdashcms.com/reference/rest-api/ |
| Feature inventory we lack: scheduled publishing, revisions + compare/publish-draft, trash/restore, duplicate, edit locks, redirects + 404 log, FTS5 search w/ tokenizers, media library w/ usage tracking, signed direct-by-S3 uploads, site export/import packages, taxonomies/menus/widgets/sections, comments w/ moderation queue | REST doc + README | — |
| Auth endpoints ship per-IP rate limits; a reverse proxy must configure `trustedProxyHeaders` | Auth doc | — |

## Where AIStore stands (the comparison base)

Everything below is in-repo at `aded706` and verified by the 166-test suite:

- One Next.js SPA: directory surface (Discover→tool detail), submit flow, wanted board,
  blog index/reader; admin console with review queue, catalog editor, wants/blog/ads
  managers, analytics. One deployable (bun standalone + Neon Postgres).
- In-app CMS built by hand this session: posts (markdown via own renderer, covers, slug
  policy w/ `previousSlugs`), media uploads (magic-byte sniffing, 2 MB/25 MP, per-IP
  throttle admin-bypassed), moderation queue, featured flags, wants board, ads + pageview
  analytics, admin auth by shared `ADMIN_TOKEN`, rate limiting in Postgres (`RateEvent`).
- 166-test suite; Caddy-proxied deploy via `.zscripts` with Postgres-aware scripts.

AIStore-vs-EmDash missing pieces (confirmed against the inventory above): RBAC
(one shared token vs 5 roles/passkeys/OAuth), revisions & scheduled publishing, full-text
search (we only do `contains`), redirects/404 tooling, media library (folders, usage
tracking, signed S3/R2 uploads — ours is a fixed local dir), plugin sandbox (n/a), site
export/import (worklog + git are our backup story), comments (we have a wants board
instead), i18n.

What EmDash has **no answer for** (would be lost or rebuilt): GitHub-catalog semantics —
stars are curation-pinned snapshots with weekly-gain deltas; the brand-logo resolution
chain (`brandLogoUrl`, pinned avatars/icons); the 60/30/10 design system as built;
anonymous vote throttling graph (`RateEvent` — EmDash's analog is a comments-style
moderation flow, not token-throttled voting); `agent-ctx`/worklog dev journaling culture;
the fact that a directory id is a repo slug and curation is editorial.

## Scenarios

### A. Status quo + pattern-steal (recommended now)

EmDash stays a reference; we implement the highest-value patterns natively.

1. **Durable uploads** — ✅ **implemented (Task 17, worklog)**: `UPLOAD_STORAGE=s3` stores
   objects in any S3-compatible bucket (dependency-free SigV4 in `src/lib/aitools/s3-sign.ts`,
   adapter in `src/lib/aitools/upload-storage.ts`), with the local disk adapter kept as the
   zero-config default. Validation chain and rate limiting unchanged.
2. **Scheduled publishing** on posts (`PublishAt` already half-exists via `publishedAt`).
3. Then, if wanted: revisions, redirects + 404 log, FTS.

Effort: 1–3 days per item, incremental, zero risk to the existing surface. This also
cleanly exposes the "RE-PLATFORM" seam early if we ever want it.

### B. Hybrid — keep Next directory, move publication to EmDash

A separate Astro+EmDash app for `/blog/*` (with the wanted board?) while the Next app
keeps the catalog + admin. Problems, verified:
- Two deployables, two admin UXs, auth splits between `ADMIN_TOKEN` and passkey/OAuth.
- No shared single-origin API for the Next app to consume anonymous content (see REST
  boundary above) — the Next blog views would need to become cross-origin consumers of
  `/_emdash/api` with public permissions that EmDash does not currently expose for
  content GET (flagged *unverified*: it may be configurable, but that is off-contract).
- Cross-linking UX (blog → tool detail) requires the author tooling to know both stacks.
Effort: 2–4 days to stand up plus ongoing two-stack tax. **Not recommended** unless the
blog is about to become genuinely heavy long-form publishing and no pattern-steal is
acceptable.

### C. Full re-platform (EmDash for everything, Astro rewrite)

The honest upside: the whole "WordPress-shaped" feature list lands for free and stays
maintained (security posture: sandboxed plugin model — though D1-only on Cloudflare; a
Postgres Node deploy degrades that specific guarantee).

What the rewrite means, verified against the docs:
- Astro rewrite of every public view (the tailwind/layout system ports; the Next app
  logic does not — 166 vitest tests do not either; EmDash ships Playwright E2E instead).
- Content: a `tools` collection built in EmDash's admin/seed file maps well (typed
  fields per column we have). Scheduled `"Stars snapshot"` needs either a scheduled
  collection edit or a tiny custom plugin; **weekly gain** must stay derived at
  curation time (no GitHub-crawler concept in EmDash).
- Motion flows beyond comments need plugin API routes: votes (anonymous, per-voter
  unique), wanted board + dedupe-as-vote + want-votes, pageview beacon, request-board
  throttling (our `RateEvent` equivalent is missing; EmDash has per-endpoint auth rates
  only), submit flow with branding (media fields map well!). Each is a native plugin
  with full host access on Node — no sandbox on this deployment.
- Auth: passkeys/OAuth replace our shared secret (an upgrade); but no shared-token
  admin API — automation would go through the CLI/MCP with personal tokens.
- Data migration: our stores are small and clean (65 tools, votes, wants+wants-votes,
  3 posts, ads, 1.5k pageviews) — a straightforward one-script import via EmDash's
  content REST/CLI; ads/managers/analytics move from features to plugins.

Effort: realistically a **4–8+ week program** for parity with what we have today,
before earning EmDash's feature list. Every day AIStore evolves (features like last
week's uploads, or any new module) increases the delta. Trigger condition to revisit:
when **publication/content density** (posts, guides, editorial pages) becomes the
product's center of gravity rather than the catalog — that is where EmDash's admin,
revisions, scheduling, search, and media library pay rent.

### D. Wait / monitor

Viable: EmDash is 1.x-stable and moving fast (2,374 commits); plugins ecosystem is 0.x.
Revisit if (a) a Next.js runtime/adapter appears (would change option B/C materially),
or (b) anonymous content-REST reads are added (makes B credible), or (c) the product
pivots content-first (makes C obviously right).

## If we ever do C — migration checklist (kept frozen here)

1. Model `tools` as a collection (id=slug, name, repo, desc, replaces, cat/taxonomy,
   stars, platforms, selfHosted, sourceAvailable, weeklyGain, createdAt = repo-created
   keep semantics, emoji, glyph, status, submitter, featured, logo/screenshot/header as
   media fields).
2. Port `RateEvent`/wants/votes as plugin API routes + storage (Node: full-access native
   plugin, not sandboxed — acceptable one-app risk, note it).
3. Import: Admin token one-night script (tools, votes, wants, posts+previousSlugs→
   redirects, ads, pageviews) via REST with Bearer; or CLI.
4. Auth decision: passkeys + GitHub oauth; decide the Cloudflare Access question by
   deployment target.
5. Rebuild vitest tier as EmDash plugin/Playwright tests; accept coverage reset or
   re-map API-level suites onto the OpenAPI contract.
6. Kill list: keep worklog.md, agent-ctx conventions, and curation rules regardless of
   stack.

## Decision record

- **Chosen (Oct 13 2026): Option A** — implement pattern-steals natively; reassess only
  on the triggers above.
- This document should be re-read (and re-verified — the flagged unverified items, and
  EmDash changelog) before any re-platform conversation. EmDash moves fast; facts may
  have shifted (e.g. a headless mode or Next interop would rewrite option B).
