# Task 6 — Tool detail view (OpenStore-style)

## What was built
- `src/components/aitools/views/tool.tsx` (NEW): full single-tool detail view matching the OpenStore reference 1:1 in structure, rendered entirely from `useTools()` (no new API calls, no new deps).
  1. Breadcrumb `Discover > {Category} > {Tool}` (buttons → navigate("discover") / openCategory).
  2. Header: 64px local `ToolIcon` (glyph/emoji tile mirroring AppIcon styling), mono eyebrow = category short, h1, desc, meta line ("Open source" + Self-hosting available + Source available + Trending this week), right-aligned `Get {name}` (bg-solid, repo URL), `GitHub` (bordered), icon-only bookmark (fill-current + accent when saved).
  3. Stats bar (border-y, grid-cols-2 → md:3 → lg:5, per-cell responsive border-r/border-t so wrapped rows render clean, first cell lg:pl-0): GITHUB STARS (Star + fmtK + toLocaleString caption), COMMUNITY VOTES (whole cell = button → toggleVote, TrendingUp + count, voted = text-accent + "You upvoted this", aria-pressed, hover:bg-elev), LICENSE "OSS", PLATFORMS (first 3 labels " · ", caption "Also X, Y" or "Full list in Details"), CREATED (UTC-safe "Apr 2022" / "Apr 29, 2022" formatters).
  4. Screenshots showcase: chrome bar (3 dots + centered repo mono), dotgrid body min-h clamp(300px,55vh,520px), scaled FeaturedArt (featuredArt ?? category→art map; scale 1.1/1.35/1.6 responsive, origin-center, overflow-hidden), caption strip "{name} · {label} workspace".
  5. Best-for/User-feedback split panel (md:grid-cols-2 divide): CATEGORY_BEST_FOR map (12 curated copy lines) + rating block (★ amber, reviews · source, highlight) or "No aggregate rating verified.", discussions/issues links, stars-vs-satisfaction footnote.
  6. About + Details: derived honest paragraph (desc + "Built as an open-source project for {category}, it replaces {first replace} for teams that want self-hosting control / an open workflow"), truth-derived checklist (≤4 with green Check), "Alternative to" chips (replaces split ","), sidebar dl (Category / Available on / License / Self-hosted / Repository mono link / Created) + doc & issues links + "GitHub stats captured Oct 5, 2026."
  7. More in {Category}: header + "See category ›", up to 2 same-category siblings (exclude self, stars desc), ToolRow-style buttons → onOpenTool.
  8. "‹ Back to Discover" → onNavigate("discover").
  - Bad-id → centered "Tool not found." + back button. Bookmarks: module-level localStorage external store (key `aistore-bookmarks`) read via useSyncExternalStore (empty server snapshot; same pattern as myVotes in tools-provider; write-through toggle; no setState-in-effect).

## Wiring (home.tsx)
- New state `activeToolId`; navigate() resets it; `openTool(t)` = setActiveToolId + setView("tool") + scroll top (same `(t: Tool) => void` signature — every ToolCard/ToolRow/trending row/search result now opens the detail automatically).
- Removed `browseWith` (no remaining callers) and the stale `onBrowseCategory` prop on `<Discover>` (pre-existing TS error — Discover no longer accepts it); search-modal wrapper now `openTool(getTool(t.id) ?? t)`; `byId` import dropped. Animate-rise key gained `tool:${activeToolId}`.

## Deviations (flagged)
- `src/lib/aitools/data.ts`: added `| "tool"` to the ViewId union (one additive token). The task's file list excluded data.ts, but `view === "tool"` / `setView("tool")` in home.tsx cannot typecheck without it, and the mission explicitly calls for the new ViewId "tool". No existing member/behavior changed; Nav simply highlights nothing on detail pages (matches reference).
- AppIcon has no 64px size, so the header icon is a local `ToolIcon` with identical visual language; "More in" rows use AppIcon default size (h-9) for visual balance with text-[15px] names.

## Verification
- `bun run lint` clean; `tsc --noEmit` clean (no output).
- agent-browser E2E (1440×900 + 390×844): browse→first card→OpenClaw detail (all 8 sections + zero errors); breadcrumb category→category view, Discover→discover; votes cell 0→1 accent "You upvoted this", reload persists (API votes:1), toggle-off → API votes:0; bookmark fills accent + localStorage, reload persists, off → `[]`; "More in Agents" row → AutoGPT detail; "See category" → category; "Back to Discover" → discover; search modal "voice" → first result → OpenWhispr detail.
- Mobile 390: scrollW 390 == clientW (no overflow), stats 2-col, about/details stacked, header CTAs wrap to one row below header text, mockup 275px inside 348px body (no chrome-bar overlap). Desktop 1440: stats 5 cols, about grid `704px 360px`.
- Final DB state: 64 curated public + 2 pending (nightowl, promptdeck), 0 community, sum(votes) = 0; dev.log healthy.
