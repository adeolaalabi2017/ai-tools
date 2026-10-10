# Worklog

---
Task ID: 1
Agent: Z.ai Code (main agent)
Task: Build the OpenStore-style frontend from the provided screenshots, re-themed as an AI tools directory ("Find the best AI tools")

Work Log:
- Analyzed the 6 uploaded screenshots: dark directory site with green accent, 5 views (Discover home, Categories, Trending, New/Browse, Submit) plus a ⌘K search palette
- Kept the single-route constraint: implemented client-side view switching inside `src/app/page.tsx` (no extra routes)
- Set up design tokens in `src/app/globals.css` (dark default + light theme via `data-theme`, `bg-base/card/elev/line/ink/mute/faint/accent` utilities, dot-grid, thin scrollbars, rise/pop/bar animations)
- Updated `src/app/layout.tsx`: metadata for "AIStore — Find the best AI tools", no-flash theme init script, Geist fonts
- Built data layer `src/lib/aitools/data.ts`: 64 curated real open-source AI tools (Open WebUI, Ollama, ComfyUI, OpenCode, OpenHands, n8n, etc.) across 12 categories, with stars, platforms, self-hosted/source-available flags, weekly GitHub gains, creation dates, ratings for well-reviewed section
- Built shared primitives `src/components/aitools/ui.tsx`: AppIcon (emoji/letter tiles), category icon map, PlatformRow, Kbd, SectionHeader, ToolRow, custom Dropdown, TrendBar, WeeklyGain, SourceBadge
- Built CSS mockup artwork `src/components/aitools/mockups.tsx` (terminal, chat, node graph, waveform, flow editor) — no external images needed
- Built shell: sticky nav with active pill + mobile nav row + theme toggle, footer (sticky-bottom via flex column), ⌘K search palette with pages/apps groups, keyboard navigation, seeded queries
- Built Discover view: hero with green underline, hero chips, popular seeds, Editor's picks (3 cards with mockups), The Open family (6 rows), Trending this week table with animated green bars, Categories grid, Popular cards, Well reviewed (ratings + feedback notes), Community CTA, "An open AI stack" collection card
- Built Categories view (12 category cards with counts + Good places to start with Source-available badge), Trending view (filter bar: search/platform/filters/sort + chips + self-hosted pill + cards with weekly gains), Browse/New view (64 apps, category/platform/sort/filters, Show more pagination 24→48→…), Submit view (3-step layout, GitHub Fetch autofill simulation, char counter, platform toggles, collapsible details, validation gating, success panel)
- Fixed lint errors (react-hooks/set-state-in-effect, useMemo inline function) by restructuring: keyed Palette mount, adjust-during-render patterns, CSS-driven theme icons
- Fixed navigation bug where navigate() wiped browse filters set by tool-open flow
- Fixed hero line break ("Find the best" / "AI tools.") and editor's-pick text squeeze
- Added theme-aware solid button vars so primary buttons stay visible in light mode
- Verified with agent-browser: all 5 views render, ⌘K open/search/arrow/enter flows, chip filtering (Agents→8, Coding→6), Show more (24→48), full submit flow with Fetch autofill ("Night Scribe") and success panel, dark/light theme toggle, mobile 390px layout, sticky footer, zero console errors, ESLint clean

Stage Summary:
- Production-ready single-route AI tools directory "AIStore" matching the reference design 1:1 in structure, adapted to AI tools content
- Key artifacts: `src/lib/aitools/data.ts`, `src/components/aitools/{home,nav,footer,search-modal,ui,mockups,browse-parts}.tsx`, `src/components/aitools/views/{discover,categories,trending,browse,submit}.tsx`, `src/app/page.tsx`
- Decisions: client-side view switching instead of routes (sandbox constraint), CSS mockups instead of generated images (crisper + no assets), CSS-variable theming instead of next-themes (no hydration flash)
- Verified end-to-end in browser at desktop + mobile widths; lint passes; dev.log shows clean 200s

---
Task ID: 2-b
Agent: full-stack-developer (backend)
Task: AIStore API routes + server helpers

Work Log:
- Read worklog (Task 1), prisma/schema.prisma (Tool + Vote models), src/lib/db.ts, and src/lib/aitools/data.ts (frontend Tool type, CATEGORIES, Platform constants) to lock the API contract
- Probed zod v4 semantics with bun before coding (trim-then-min/max ordering, z.enum with const arrays, .default, .refine string messages, error.issues shape) — all confirmed
- Created `src/lib/aitools/server.ts`: shared `ApiTool` wire type, `DbTool` row type, `serializeTool()` (platforms CSV→array, createdAt→ISO), `slugify()` (lowercase, a-z0-9, non-alphanumeric runs → single dash, trimmed), `matchingCategoryIds()` for label search, `PLATFORM_VALUES`, zod `submissionSchema` (name 2–60, repo regex owner/repo, desc 10–200, replaces 2–80, cat validated against CATEGORIES ids, platforms subset-of-6 default ["web"], submitter ≤120, homepage accepted-but-not-stored) and `voteSchema` (voter 8–64 chars, trimmed)
- Created `src/app/api/tools/route.ts`: GET with q/cat/platform/selfHosted/sourceAvailable/trending/sort/page/limit — q does OR contains across name/repo/desc/replaces PLUS category-label match (ids resolved in JS from CATEGORIES); sort whitelist newest|stars|momentum(weeklyGain desc, stars desc)|votes|name default newest; page 1-based, limit default 24 cap 999; `runtime="nodejs"` + `dynamic="force-dynamic"`; POST submission with zod 400 shape `{error:"Validation failed",issues}`, case-insensitive trimmed duplicate-repo check → 409, slug id from name with -2/-3 collision suffixes, community row (stars 0, emoji 🧩, glyph null, submitter stored), 201 `{tool}`
- Created `src/app/api/tools/[id]/route.ts`: GET single, async `params` (Next 16), 200 `{tool}` / 404 `{error}`
- Created `src/app/api/tools/[id]/vote/route.ts`: POST toggle in `db.$transaction` — Vote row exists → delete + recount, else create + recount; 200 `{votes, voted}`, 404 if tool missing, 400 for bad voter token
- Fixed first failing test run: discovered the pushed schema has NO `votes` column on Tool (client validation error "Unknown argument votes") — instead of touching schema.prisma (outside my allowed files), votes are now DERIVED from the Vote table via `_count.toolVotes` on every read and `orderBy: { toolVotes: { _count: "desc" } }` for sort=votes; contract response shape unchanged; noted prominently in agent-ctx for the frontend agent
- Tested all 8 contract curl scenarios + extras (sort=votes ordering, label search "Voice", platform=android, selfHosted+sourceAvailable combo, page=2 pagination, slug collision → night-scribe-2, case-insensitive duplicate repo "TESTS/Night-Scribe" → 409, short voter token → 400)
- Cleaned up test data with a temporary bun script (deleted 2 community tools + 1 vote row), then removed the script; verified total=64, opencode votes=0, night-scribe → 404
- Ran `bun run lint` (clean) and reviewed tail of dev.log (only healthy 2xx/4xx for my routes, no compile/runtime errors)

Stage Summary:
- Backend API for AIStore complete and contract-faithful: GET/POST /api/tools, GET /api/tools/[id], POST /api/tools/[id]/vote + shared helpers in src/lib/aitools/server.ts (serializer, slugify, zod schemas)
- Response shapes exactly per fixed contract: list `{tools, total, page, limit}`; tool object with platforms array, ISO createdAt, weeklyGain null, votes, status, submitter; vote `{votes, voted}`; errors 400 (issues), 404, 409, 500
- KEY deviation note for Task 3 (frontend wiring): Tool table has no votes column — votes always come from Vote-row count; voter tokens must be ≥8 chars (anonymous localStorage token); `homepage` field accepted but not persisted
- All curl tests green, lint clean, dev.log clean; DB restored to the clean seeded state (64 curated tools, no community rows, no votes)

---
Task ID: 2-c
Agent: full-stack-developer (frontend)
Task: Wire AIStore frontend to the API

Work Log:
- Created `src/lib/aitools/api.ts`: typed fetchers (ApiTool/ToolsPage/ToolSubmitPayload/VoteResult), ApiError carrying status + issues, fetchTools/getTool/submitTool/voteTool, relative URLs only; error body reader accepts string issues and Zod-issue objects ({message}) since 2-b returns `parsed.error.issues` raw
- Created `src/components/aitools/tools-provider.tsx`: QueryClientProvider (staleTime 15s, refetchOnWindowFocus false, retry 1, created in useState initializer) + ToolsProviderInner running `["tools","all"]` useQuery with initialData = static TOOLS mapped to ApiTool (votes 0, status "curated", submitter null, weeklyGain null when absent) and initialDataUpdatedAt 0 so the live fetch fires immediately while static data paints first; 60s refetchInterval keeps votes live
- Merge rule implemented: static entry is the base (preserves editorial `rating` + `featuredArt`), DB row overrides shared fields, community-only tools included as-is; exposed via useTools() → tools: Tool[], getTool(id), votes: Record<string,number>, myVotes, toggleVote(id)
- Votes: optimistic updates applied to myVotes and the ["tools","all"] query cache (single source of truth for all chips), then POST vote with localStorage `aistore-voter` token (crypto.randomUUID, lazy client-side), reconcile with server truth, rollback + console.warn on failure; myVotes persisted to `aistore-myvotes` (JSON array) via a localStorage-backed external store read with useSyncExternalStore (empty server snapshot → zero hydration mismatch, no setState-in-effect)
- Created `src/components/aitools/use-debounced.ts` (first value applies immediately; setState only inside setTimeout so react-hooks/set-state-in-effect stays happy)
- data.ts: Tool gains votes?/status?/submitter?; countByCat, trendingTools, byId, EDITORS_PICKS, OPEN_FAMILY, GOOD_STARTS, POPULAR_CARDS, WELL_REVIEWED, STACK_LIST now accept `list: Tool[] = TOOLS` (defaults keep every existing call site valid)
- browse.tsx + trending.tsx: server-driven useQuery keyed on all filters (q debounced 250ms, cat/platform/selfHosted/sourceAvailable/trending/sort, limit 999, placeholderData keepPreviousData → no spinner while switching), CountRow + "Showing X of Y" from `total`, client-side Show more slicing kept verbatim, mono "Loading apps…" block only before first data
- search-modal.tsx: `["tools","search",debouncedQ]` limit 12 debounce 150ms keepPreviousData; empty query shows the exact previous static top-8-by-stars list and seeded pages group; keyboard nav + highlight clamp when async results arrive
- submit.tsx: POSTs the form (repo normalized to owner/repo, homepage passed), invalidates ["tools","all"], 201 → success panel with the created tool's name + "is live in the directory", 409 → inline "This repository is already listed." under the repo field, 400 → first issue message in a banner, network failure → friendly retry message, button shows "Submitting…"
- discover.tsx + categories.tsx: all pick helpers/counters now read useTools().tools so live votes, counts, and community submissions appear (hero/category footnotes use live length)
- Vote chip: added `VoteChip` to ui.tsx (`▲ N` font-mono text-xs chip, border-line → hover border-line2, voted = text-accent + border-accent/40 + bg-accent-soft, renders ▲ 0 too, stopPropagation, aria-pressed) into ToolCard meta row (button) and ToolRow meta row (span role=button since ToolRow is itself a <button> — DOM-valid, Enter/Space handled); browse-parts.tsx imports it for cards
- home.tsx: AIToolStore now wraps AIToolStoreApp in <ToolsProvider>; search-modal tool-open resolves against the live merged list (getTool ?? byId ?? arg)

Stage Summary:
- Entire AIStore UI is now API-driven through TanStack Query v5 with zero visual change when the DB matches the seed: browse/trending/search/list views come from GET /api/tools, submits create real community tools, votes are optimistic + persistent per anonymous localStorage voter
- Files created: src/lib/aitools/api.ts, src/components/aitools/tools-provider.tsx, src/components/aitools/use-debounced.ts, agent-ctx/2-c-frontend.md; edited: data.ts, home.tsx, ui.tsx, browse-parts.tsx, search-modal.tsx, views/{browse,trending,submit,discover,categories}.tsx
- Fallback behavior: static TOOLS mapped to ApiTool as query initialData (first paint pixel-identical); if the API is down, browse/trending fall back to client-side filtering of the merged list, search falls back to static matchTool, discover/categories keep serving the static merged list — fetch failures never crash, only console.warn
- Vote UX: subtle ▲ chip on every card/row, optimistic +60ms-feel updates, persisted across reloads via aistore-voter + aistore-myvotes, rolled back on request failure
- Verified: bun run lint clean (0 problems), tsc --noEmit clean for src/ (only pre-existing examples/ + skills/ noise), dev.log shows GET / 200 and GET /api/tools 200 with no compile errors; vote endpoint smoke-tested via curl (toggle on → {votes:1,voted:true}, toggle off → {votes:0,voted:false}) leaving clean state

---
Task ID: 3
Agent: Z.ai Code (main agent)
Task: Integration verification of the fullstack phase (API + frontend wiring) and mobile defect fix

Work Log:
- Verified both agent deliverables via worklog + live API smoke tests (GET /api/tools returns correct Tool shape, filtered search, 64 total)
- Browser-verified (agent-browser) the golden paths: upvote chip click -> optimistic UI (▲ 1) + server persistence (votes: 1) + toggle-off back to 0; search palette opens via nav button, server-backed search "voice" returns 6 voice tools, empty query keeps static behavior, Enter opens tool in Browse pre-filtered; Browse shows live total ("65 apps to explore" after submission)
- Full submit flow: filled form (note: repo field requires "github.com/owner/repo" without protocol per GITHUB_RE), picked category via custom dropdown, selected Web platform -> 201 -> success panel "NightOwl is live in the directory"; tool persisted (status community) and immediately listed in Browse; duplicate repo resubmission -> inline "already listed" 409 error
- Mobile 390px: found horizontal overflow bug (scrollW 481) — Well-reviewed grid track blew out to 460px because implicit `auto` track + flex min-content (nowrap truncate desc). Fixed by adding `grid-cols-1` (minmax(0,1fr)) base to all 12 responsive grids across discover/categories/browse/trending/submit + `flex-1 overflow-hidden` on the well-reviewed card header. Re-verified: scrollW 390, canScrollX false
- Verified footer sticks/pushes naturally, zero console errors, desktop 1440px screenshots + mobile screenshots render pixel-clean, hero shows live "64 reviewed" count
- Cleaned up test data (deleted NightOwl community tool + vote rows) -> DB restored to seeded 64-tool state; final `bun run lint` clean

Stage Summary:
- Fullstack phase complete: AIStore now DB-backed end-to-end — Prisma SQLite (Tool/Vote models), REST API (GET/POST /api/tools, GET /api/tools/[id], POST /api/tools/[id]/vote) with server-side search/filter/sort/pagination, TanStack Query frontend with static initialData fallback, persistent community submissions, anonymous-token upvotes with optimistic UI
- Fixed pre-existing mobile horizontal overflow (grid auto-track blowout) discovered during verification
- Votes derived from Vote-table counts (no denormalized column) — response shape unchanged
- All checks green: lint clean, dev.log healthy, browser-verified desktop + mobile

---
Task ID: 4-a
Agent: full-stack-developer (backend)
Task: Pending submission status + moderation endpoint + status filter

Work Log:
- Read worklog (Tasks 1–3, 2-b/2-c contracts), prisma/schema.prisma (Tool has no votes column — votes derived via _count.toolVotes), existing API routes, and src/lib/aitools/server.ts before making changes
- POST /api/tools: community submissions now created with status "pending" (was "community") — validation, case-insensitive duplicate-repo 409 (matches rows in ANY status incl. pending), slug generation, and 201 {tool} shape all unchanged
- GET /api/tools: added optional `status` query param whitelisted to pending|community|curated (invalid/absent treated as absent); absent → public listing with `status: { not: "pending" }`; exact filter otherwise; response shape unchanged
- sort=votes made deterministic: orderBy [{toolVotes:{_count:"desc"}},{stars:"desc"}]
- Created POST /api/tools/[id]/moderate (Next 16 async params, runtime nodejs): zod {action: approve|reject} → 400 {error:"Validation failed",issues}; approve: pending→community, community/curated idempotent no-op, 200 {action:"approve",tool}; reject: pending|community → delete row (Vote cascade), curated → 400 "Curated tools cannot be removed.", 200 {action:"reject",deleted:true}; unknown id → 404; try/catch → 500
- Added moderateSchema to src/lib/aitools/server.ts (alongside submissionSchema/voteSchema) and imported it in the moderate route
- Created prisma/seed-pending.ts (idempotent bun upsert of 2 demo pending submissions: nightowl — NightOwl/nightscout/nightowl/writing/web,mac — and promptdeck — PromptDeck/labs/promptdeck/devtools/web; both "QA Bot", 🧩, stars 0; re-run forces status back to pending)
- Curl-tested all 8 scenarios + extras against the running dev server: baseline 64 curated / 0 pending / invalid status=bogus→absent; POST submission → 201 "pending", hidden from default GET (total 64) but in status=pending (total 1), duplicate repo 409 enforced against pending row; approve → 200 status community (default total 65), repeat approve idempotent; reject → 200 deleted:true, GET single 404, default total 64; reject curated opencode → 400 "Curated tools cannot be removed."; approve opencode → 200 no-op stays curated; bad action / missing body → 400 with zod issues; unknown id → 404; sort=votes ×3 → identical deterministic order (stars tiebreak visible)
- Re-ran seed-pending twice to confirm idempotency; final DB state 64 curated + 2 pending, 0 community, 0 votes (verified via API: status=pending total 2, default total 64, status=curated 64, status=community 0, Vote count 0)
- bun run lint clean; project tsc clean for src/ (only pre-existing examples/ + skills/ noise); tail of dev.log shows only healthy 2xx/4xx for the new/changed routes, no compile or runtime errors

Stage Summary:
- Submissions are now "pending" until moderated: POST /api/tools creates pending rows that are hidden from the default public listing, GET /api/tools?status=pending exposes the moderation queue (community/curated exact filters also added), and sort=votes gained a stars tiebreak for deterministic order
- New moderation endpoint POST /api/tools/[id]/moderate: approve (pending→community, idempotent, returns serialized ApiTool) / reject (deletes pending|community rows only, curated protected with 400) — enables a frontend review queue
- Contract notes for frontend (also in agent-ctx/4-a-full-stack-developer.md): new submissions no longer appear in browse/search until approved; moderateSchema exported from server.ts; seed demo queue via `bun prisma/seed-pending.ts`
- Final DB state: 64 curated + 2 pending (nightowl, promptdeck), 0 community, 0 Vote rows; all curl tests green, lint clean, dev.log clean

---
Task ID: 4-b
Agent: full-stack-developer (frontend)
Task: Category detail view + moderation queue + vote sort

Work Log:
- Read worklog (Tasks 1–3) + studied home.tsx, data.ts, api.ts, browse-parts.tsx, tools-provider.tsx, browse/trending/categories/discover/submit, ui.tsx, nav.tsx, footer.tsx to lock patterns before coding
- data.ts: extended ViewId union with "category" and "admin" (VIEW_PAGES untouched so the search palette stays as-is)
- api.ts: added optional `status` to ToolsQueryParams (built into the query string) and `moderateTool(id, "approve"|"reject")` → POST /api/tools/[id]/moderate typed as ModerateResult {action, tool?, deleted?}; coded exactly against the fixed 4-a contract
- Created views/category.tsx: back link "← All categories", mono eyebrow = category short, h1 = label, sub = blurb + live count (countByCat on the live merged list); reused FilterBar (q debounced 250ms, platform/filters/sort), CountRow, ToolCard grid, Show-more pagination (PAGE_SIZE 24, hidden when everything shown) exactly like browse.tsx; server query ["tools","category",catId,filters] with keepPreviousData + client-side fallback filter (incl. votes sort); sort options Momentum (default) / Most upvoted (votes) / Most stars / Newest; FilterBar chips re-wired: specific cat → openCategory (header stays in sync), "All apps" → browse
- Created views/admin.tsx: header "MODERATION / Review queue" + live count, useQuery ["tools","pending"] → fetchTools({status:"pending",limit:999,sort:"newest"}) with refetchInterval 20s; rows show AppIcon, name, mono repo, desc, category chip, platforms, "Submitted by X · Oct 10, 2026" (UTC-safe formatter matching the app's existing "Oct 5, 2026" style); Approve (bg-solid + Check) / Remove (border-line + Trash2) with aria-labels, stopPropagation-safe cluster, spinner + disabled via local pendingAction state, optimistic row removal via setQueryData(["tools","pending"]) + invalidate ["tools","all"]; dashed empty state "Queue is clear." (+ Browse all apps via onNavigate), friendly query-error state with Retry, amber role=alert banner if a moderate call fails
- home.tsx: added activeCategory state + openCategory() (sets cat + view "category" + scroll top); navigate() resets activeCategory; render CategoryView (keyed `category:${catId}` for remount animation) and AdminQueue; search-modal flow (browseWith/openTool) untouched
- footer.tsx: added "Review queue" to the CONTRIBUTE column → navigate("admin")
- discover.tsx: hero category chips and Categories section cards now call onOpenCategory ("More..." → categories, "All apps" chip → browse); dropped the now-unused onBrowseCategory prop
- categories.tsx: 12 category cards → onOpenCategory ("Good places to start" action stays "All apps" → browse since it doesn't target a category)
- browse.tsx + trending.tsx: added { value: "votes", label: "Most upvoted" } to sortOptions (browse: Newest first; trending: Momentum first) + votes case in the API-failure fallback sorts
- submit.tsx: success panel copy changed to "“{name}” was sent to the editors." + "It will appear in the directory once approved." (everything else identical)
- Fixed a discovered pre-existing mobile defect: the shared FilterBar dropdown cluster (flex, non-wrapping) pushed scrollWidth to 412px at 390px on Trending (default "Momentum") and 428px on Browse after picking "Most upvoted"; wrapped FilterBar at all three call sites (category/trending/browse — all in my file scope) with `[&>div>div:first-child>div:last-child]:flex-wrap`; desktop layout verified unchanged
- Browser-verified with agent-browser: hero chip "Chat" → Category view with server data + "9 apps"; sort → Most upvoted no crash; back link, Categories card, and in-page chip switch all reach the right category; tool card → Browse pre-filtered; footer "Review queue" showed the 2 seeded pending rows; Approve PromptDeck → gone from queue, status "community" via API, listed in Browse (65 apps); Remove NightOwl → "Queue is clear." and tool absent from pending + public API; re-ran bun prisma/seed-pending.ts → queue auto-refetched to 2; full submit flow → "sent to the editors" + "once approved" copy, Lumifield hidden from public list but present in queue, then removed via queue; moderate endpoint initially 404 (backend still compiling) and was retried until live
- Responsive + hygiene: 1440 clean on discover/category/browse/admin; 390 clean on all filter-bar views (incl. Most upvoted selected) and admin; footer sticky/push intact; zero console errors/warnings; bun run lint clean; dev.log healthy

Stage Summary:
- Shipped three features on the AIStore single-route app: (1) Category detail view ("category") with server-driven filtering, 4-way sort incl. Most upvoted, show-more pagination and live counts, reachable from hero chips, the Categories grid cards, and in-page chips; (2) Moderation queue ("admin") at footer "Review queue" with 20s auto-refresh, optimistic approve/remove wired to POST /api/tools/[id]/moderate, friendly empty/error states; (3) "Most upvoted" sort option in Browse + Trending and editorial-review submit copy
- Files created: src/components/aitools/views/category.tsx, src/components/aitools/views/admin.tsx, agent-ctx/4-b-full-stack-developer.md; modified: src/lib/aitools/data.ts, src/lib/aitools/api.ts, src/components/aitools/home.tsx, footer.tsx, views/{discover,categories,browse,trending,submit}.tsx
- Fixed a pre-existing mobile horizontal overflow in the shared FilterBar (call-site wrapper fix, documented in agent-ctx for a future fold-in)
- Verification: all agent-browser scenarios green (category nav matrix, moderation approve/remove round-trip, submit→queue→reject flow, seed restore), zero console errors, no horizontal overflow at 1440/390, lint clean
- Final DB state: 64 curated tools + 2 pending demo rows (nightowl, promptdeck), 0 votes, test submissions deleted (lumifield → 404)

---
Task ID: 5
Agent: Z.ai Code (main agent)
Task: Integration verification of phase 3 (category views, vote sorting, moderation queue)

Work Log:
- Confirmed both agent worklogs + API state (64 curated public, 2 pending demo rows: NightOwl + PromptDeck)
- Browser E2E: hero chip "Chat" -> Category view ("AI Assistants", 9 apps, server-driven); sort dropdown -> "Most upvoted" works; footer "Review queue" -> shows both pending submissions with metadata (repo, category chip, submitter, date); Approve NightOwl -> optimistic removal + API status "community" + appears in Browse ("65 apps to explore"); restored demo state via reject + seed-pending (2 pending rows back)
- Mobile 390 + desktop 1440: zero horizontal overflow on all views, footer intact, 0 console errors/warnings, lint clean
- Final DB state: 64 curated + 2 pending demo submissions, 0 votes

Stage Summary:
- Phase 3 shipped and verified end-to-end: editorial submission flow (submit -> pending -> admin approve/reject), per-category detail views with server filtering + Most upvoted sort, moderation queue UI in the footer's CONTRIBUTE column
- Demo-ready state: 2 pending submissions in the Review queue for immediate exploration
