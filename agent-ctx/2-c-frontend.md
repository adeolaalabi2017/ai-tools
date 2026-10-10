# Task 2-c — Frontend API wiring (full-stack-developer)

Date: 2026 work session · Project: /home/z/my-project (AIStore)

## Scope executed
Wired the AIStore frontend to the /api/tools backend (built by task 2-b) with TanStack Query v5,
keeping the Task 1 design pixel-identical and adding optimistic voting.

## Files
- CREATED `src/lib/aitools/api.ts` — ApiTool/ToolsPage types, ApiError (status + issues), fetchTools/getTool/submitTool/voteTool, relative URLs only. readErrorBody tolerates string issues AND Zod-issue objects ({message}) because 2-b returns `parsed.error.issues` raw.
- CREATED `src/components/aitools/tools-provider.tsx` — QueryClientProvider (staleTime 15s, refetchOnWindowFocus false, retry 1) + ToolsProviderInner:
  - `["tools","all"]` useQuery, initialData = static TOOLS mapped to ApiTool (votes 0, status curated), `initialDataUpdatedAt: 0` so the live fetch fires immediately on mount, refetchInterval 60s.
  - merge rule: static entry as base (keeps `rating`/`featuredArt`), DB row overrides shared fields; community-only tools pass through. Exposed as `tools: Tool[]` + `getTool(id)` via `useTools()`.
  - `votes: Record<string, number>` derived from the query cache; optimistic updates go through `queryClient.setQueryData(["tools","all"])` so every chip updates from one source.
  - `myVotes` is a localStorage-backed external store (`aistore-myvotes`, JSON array) read via `useSyncExternalStore` — server snapshot is empty so SSR/hydration can never mismatch (avoids the react-hooks/set-state-in-effect trap entirely).
  - voter token: localStorage `aistore-voter`, crypto.randomUUID(), created lazily inside toggleVote (client-only event handler).
  - toggleVote: optimistic myVotes+cache update → POST → reconcile with server truth; on failure rollback both + console.warn.
- CREATED `src/components/aitools/use-debounced.ts` — useDebounced(value, delay); first value applies immediately (seeds/initial filters fire on mount), setState only inside setTimeout callback so the set-state-in-effect lint rule is not triggered.
- EDITED `src/lib/aitools/data.ts` — Tool gains `votes?/status?/submitter?`; countByCat/trendingTools/byId/EDITORS_PICKS/OPEN_FAMILY/GOOD_STARTS/POPULAR_CARDS/WELL_REVIEWED/STACK_LIST now take `list: Tool[] = TOOLS` (all defaults preserve old call sites; only files I own call them with a live list).
- EDITED views: browse + trending are server-driven via useQuery (keepPreviousData, limit 999, q debounced 250ms, CountRow from `total`, client-side Show more slicing kept; "Loading apps…" mono block only before first data; on API error they fall back to client-side filtering of the merged live list). search-modal: `["tools","search",debouncedQ]` limit 12, debounce 150ms, empty-q shows the exact old static top-8-by-stars list, static matchTool fallback on error, idx clamped when async results arrive. submit: POSTs normalized `owner/repo`, invalidates ["tools","all"], 201 → success panel with created name + "is live in the directory", 409 → inline error under repo field, 400 → first issue message in a banner, network error → friendly retry message, button shows "Submitting…". discover + categories read `useTools().tools` (live counts, community tools appear).
- EDITED `ui.tsx` (VoteChip component + chip in ToolRow meta row) and `browse-parts.tsx` (chip in ToolCard meta row): `▲ {count}` font-mono text-xs, border-line → hover border-line2, voted = text-accent + border-accent/40 + bg-accent-soft; renders `▲ 0` too; stopPropagation; in ToolRow rendered as `<span role="button" tabIndex={0}>` because the row itself is a `<button>` (DOM-valid, keyboard Enter/Space handled).
- EDITED `home.tsx` — split into AIToolStore (wraps `<ToolsProvider>`) + AIToolStoreApp; search-modal openTool resolves via live getTool ?? byId.

## Gotchas for later agents
- Backend 400 issues are Zod issue OBJECTS — api.ts extracts `.message`; don't "simplify" that away.
- ToolRow must keep the span-variant VoteChip (nested <button> is invalid DOM).
- myVotes/voter keys: `aistore-myvotes`, `aistore-voter`.
- ESLint react-hooks/refs forbids `ref.current = x` during render — latest values are passed via useCallback deps instead.
- Vote POST verified by curl: `{votes:1,voted:true}` → toggle back `{votes:0,voted:false}` (state clean).

## Status
`bun run lint` clean (0 problems). `tsc --noEmit` clean for src/ (remaining tsc output is pre-existing noise in examples/ + skills/, outside the app). dev.log: `GET / 200`, `GET /api/tools?... 200`, no compile errors.
