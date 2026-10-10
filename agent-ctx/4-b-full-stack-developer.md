# Task 4-b — Full-stack developer (frontend): Category detail + Moderation queue + vote sort

## What shipped

1. **Category detail view** (`view id "category"`, new `src/components/aitools/views/category.tsx`)
   - Props: `<CategoryView catId onNavigate onOpenTool onOpenCategory />` (onOpenCategory added so the
     shared FilterBar's category chips can switch category pages; "All apps" chip → browse).
   - Header: back link "← All categories" (→ categories), mono eyebrow = category `short`,
     h1 = category `label`, sub = blurb + live count via `countByCat(catId, useTools().tools)`.
   - Reuses FilterBar / CountRow / ToolCard exactly like browse.tsx (q debounced 250ms,
     platform/self-hosted/source-available filters, sort dropdown, Show-more pagination PAGE_SIZE 24,
     hidden when everything shown, CountRow shows filtered server `total`).
   - Sort options: Momentum (default), Most upvoted (`votes`), Most stars, Newest.
   - `useQuery(["tools","category",catId,filters])` → `fetchTools({cat, q, platform, selfHosted,
     sourceAvailable, sort, limit:999})` with keepPreviousData; API-failure fallback = client-side
     filter of live list (same pattern as browse, includes votes sort).
   - FilterBar wrapped in `[&>div>div:first-child>div:last-child]:flex-wrap` so the shared bar's
     dropdown cluster wraps on narrow screens (see defect note below).

2. **Moderation queue** (`view id "admin"`, new `src/components/aitools/views/admin.tsx`)
   - `<AdminQueue onNavigate />`; `useQuery(["tools","pending"])` → `fetchTools({status:"pending",
     limit:999, sort:"newest"})`, refetchInterval 20s.
   - Rows: AppIcon, name, mono repo, desc, category chip (CategoryIcon + label), PlatformRow,
     "Submitted by X · Oct 10, 2026" (UTC-safe formatter matching the app's "Oct 5, 2026" style).
   - Approve (solid bg-solid/Check) and Remove (border-line/Trash2) with aria-labels, in-flight
     spinner via local `pendingAction` state, stopPropagation-safe action cluster, optimistic row
     removal via `setQueryData(["tools","pending"])`, then `invalidateQueries(["tools","all"])`
     (approved tool appears in public lists instantly).
   - Empty state: dashed card "Queue is clear." / "Community submissions appear here for editorial
     review." + "Browse all apps" (uses onNavigate). Query-error state: friendly copy + Retry.
     Moderate-failure: amber alert banner (role=alert), row stays.

3. **"Most upvoted" sort + submit copy**
   - browse.tsx: sort options now Newest, Most upvoted, Most stars, Momentum (+ votes in fallback sort).
   - trending.tsx: Momentum, Most upvoted, Most stars, Newest (+ votes in fallback sort).
   - submit.tsx success panel: title unchanged, body now `“{name}” was sent to the editors.` +
     second line "It will appear in the directory once approved." All other flow/visuals untouched.

## Wiring

- data.ts: `ViewId` union extended with `"category" | "admin"` (VIEW_PAGES untouched — palette unchanged).
- api.ts: `ToolsQueryParams.status?` + built into query string; `moderateTool(id, "approve"|"reject")`
  → POST `/api/tools/[id]/moderate` typed `ModerateResult {action, tool?, deleted?}`.
- home.tsx: `activeCategory` state; `navigate()` resets it; `openCategory(catId)` sets it + view
  "category" + scroll top; keyed remount `category:${activeCategory}` for the rise animation;
  renders CategoryView + AdminQueue; search-modal flow (`browseWith`/openTool) untouched.
- footer.tsx: "Review queue" button added to CONTRIBUTE column → navigate("admin").
- discover.tsx: hero cat chips + Categories section cards → `onOpenCategory`; "More..." → categories;
  "All apps" chip → browse; `onBrowseCategory` prop removed (unused).
- categories.tsx: 12 category cards → `onOpenCategory`; "Good places to start" action stays
  "All apps" → browse (not a category target).

## Defect found + fixed (pre-existing, mobile)

The shared FilterBar's dropdown cluster (`flex items-center gap-2`) cannot wrap; with a long sort
label ("Momentum"/"Most upvoted") it pushed document scrollWidth past the viewport at 390px
(trending: 412px pre-existing with default Momentum; browse: 428px after selecting Most upvoted).
Fixed at all three call sites (category/trending/browse — all in my file scope) with a wrapper
applying `flex-wrap` to just that cluster via an arbitrary-variant selector; desktop layout
verified unchanged (all dropdown buttons still single-line h-10).

## Verification (agent-browser + curl)

- Hero chip "Chat" → Category view (server data, "9 apps", count row "9 APPS TO EXPLORE"); sort →
  "Most upvoted" no crash; "← All categories" works; Categories card (Voice) → same view; chip
  switch inside category view (Voice→Coding) remounts correctly; tool card click → Browse
  pre-filtered (existing flow intact).
- Footer "Review queue" → 2 seeded pending rows (PromptDeck, NightOwl) with correct meta/dates.
- Approve PromptDeck via UI → row gone; API shows status "community"; Browse lists it (65 apps).
- Remove NightOwl via UI → queue "Queue is clear."; tool absent from pending AND public API.
- Re-ran `bun prisma/seed-pending.ts` → queue auto-refetched to 2 rows.
- Submit flow → success panel shows "sent to the editors" + "once approved"; Lumifield absent from
  public list but present in queue; removed via queue → gone everywhere.
- Overflow: 1440 clean on discover/category/admin; 390 clean on discover/category/trending/browse
  (incl. Most upvoted selected)/admin. Footer sticky/push intact. Zero console errors/warnings.
- Final DB state: 64 curated + 2 pending (nightowl, promptdeck), 0 votes, lumifield 404.
- `bun run lint` clean; dev.log shows only healthy compiles/requests.

## Notes for other agents

- The moderate endpoint went live mid-session (initial 404s were the backend still compiling).
- Seed script `prisma/seed-pending.ts` upserts BOTH demo rows back to `status: "pending"` — running
  it after an approval flips that tool back to pending (expected demo-state restore behavior).
- If you touch browse-parts.tsx later, consider folding the flex-wrap fix into the FilterBar's
  dropdown cluster itself and removing the three call-site wrappers.
