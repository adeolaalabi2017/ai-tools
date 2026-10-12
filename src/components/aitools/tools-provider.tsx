"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import { TOOLS, type Tool } from "@/lib/aitools/data";
import {
  fetchTools,
  voteTool,
  type ApiTool,
  type ToolsPage,
} from "@/lib/aitools/api";

/* ------------------------------------------------------------------ */
/*  myVotes — localStorage-backed external store                        */
/*  Read through useSyncExternalStore so the server snapshot (empty)    */
/*  is used during SSR/hydration and no mismatch ever occurs.           */
/* ------------------------------------------------------------------ */

const VOTER_KEY = "aistore-voter";
const MYVOTES_KEY = "aistore-myvotes";

const EMPTY_VOTES: ReadonlySet<string> = new Set<string>();
const listeners = new Set<() => void>();
let myVotesCache: ReadonlySet<string> | null = null;

function readMyVotes(): ReadonlySet<string> {
  try {
    const raw = window.localStorage.getItem(MYVOTES_KEY);
    if (!raw) return EMPTY_VOTES;
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((x): x is string => typeof x === "string"));
    }
  } catch {
    /* corrupted storage — start clean */
  }
  return EMPTY_VOTES;
}

function getMyVotesSnapshot(): ReadonlySet<string> {
  if (myVotesCache === null) myVotesCache = readMyVotes();
  return myVotesCache;
}

function getMyVotesServerSnapshot(): ReadonlySet<string> {
  return EMPTY_VOTES;
}

function subscribeMyVotes(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

function writeMyVotes(next: ReadonlySet<string>): void {
  myVotesCache = next;
  try {
    window.localStorage.setItem(MYVOTES_KEY, JSON.stringify([...next]));
  } catch {
    /* storage unavailable — keep in-memory only */
  }
  listeners.forEach((l) => l());
}

/** Lazily create/read the anonymous voter token (client-side only). */
export function ensureVoterToken(): string | null {
  try {
    let token = window.localStorage.getItem(VOTER_KEY);
    if (!token) {
      token =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `voter-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      window.localStorage.setItem(VOTER_KEY, token);
    }
    return token;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Static fallback — the seeded catalog mapped to ApiTool shape.       */
/*  Used as query initialData so the first paint is pixel-identical     */
/*  to the pre-API UI and the site works even if the backend is down.   */
/* ------------------------------------------------------------------ */

export function staticToolToApi(t: Tool): ApiTool {
  return {
    id: t.id,
    name: t.name,
    repo: t.repo,
    desc: t.desc,
    replaces: t.replaces,
    cat: t.cat,
    stars: t.stars,
    platforms: t.platforms as string[],
    selfHosted: Boolean(t.selfHosted),
    sourceAvailable: Boolean(t.sourceAvailable),
    weeklyGain: typeof t.weeklyGain === "number" ? t.weeklyGain : null,
    createdAt: t.createdAt,
    emoji: t.emoji,
    glyph: t.glyph ?? null,
    votes: t.votes ?? 0,
    status: t.status ?? "curated",
    submitter: t.submitter ?? null,
    featured: Boolean(t.featured),
    logoUrl: t.logoUrl ?? null,
    screenshotUrl: t.screenshotUrl ?? null,
    headerUrl: t.headerUrl ?? null,
  };
}

const STATIC_ALL: ApiTool[] = TOOLS.map(staticToolToApi);
const STATIC_PAGE: ToolsPage = { tools: STATIC_ALL, total: STATIC_ALL.length, page: 1, limit: 999 };

/**
 * Map an ApiTool onto the render-side Tool shape. When a static/editorial
 * entry exists it is used as the base so extras like `rating` and
 * `featuredArt` survive; DB content wins for the shared fields.
 */
export function apiToolToTool(api: ApiTool, base?: Tool): Tool {
  return {
    ...(base ?? {}),
    id: api.id,
    name: api.name,
    repo: api.repo,
    desc: api.desc,
    replaces: api.replaces,
    cat: api.cat,
    stars: api.stars,
    platforms: api.platforms as Tool["platforms"],
    /* ?? not ||: an explicit false from the DB must beat the static entry,
       or admin un-flags (self-hosted, source-available) never take effect */
    selfHosted: api.selfHosted ?? base?.selfHosted,
    sourceAvailable: api.sourceAvailable ?? base?.sourceAvailable,
    weeklyGain: api.weeklyGain ?? base?.weeklyGain,
    createdAt: api.createdAt,
    emoji: api.emoji,
    glyph: api.glyph ?? base?.glyph,
    votes: api.votes,
    status: api.status,
    submitter: api.submitter,
    featured: api.featured,
    rating: base?.rating,
    featuredArt: base?.featuredArt,
    logoUrl: api.logoUrl,
    screenshotUrl: api.screenshotUrl,
    headerUrl: api.headerUrl,
  };
}

function mergeTools(dbTools: ApiTool[]): Tool[] {
  const staticById = new Map(TOOLS.map((t) => [t.id, t]));
  return dbTools.map((api) => apiToolToTool(api, staticById.get(api.id)));
}

/* ------------------------------------------------------------------ */
/*  Context                                                             */
/* ------------------------------------------------------------------ */

interface ToolsContextValue {
  /** Merged tool list: static editorial entry + DB row overrides + community tools. */
  tools: Tool[];
  getTool: (id: string) => Tool | undefined;
  /** Live vote counts keyed by tool id (includes optimistic updates). */
  votes: Record<string, number>;
  /** Tool ids the current visitor has voted for. */
  myVotes: ReadonlySet<string>;
  toggleVote: (id: string) => void;
}

const ToolsContext = createContext<ToolsContextValue | null>(null);

export function useTools(): ToolsContextValue {
  const ctx = useContext(ToolsContext);
  if (!ctx) throw new Error("useTools must be used inside <ToolsProvider>");
  return ctx;
}

function ToolsProviderInner({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const allQuery = useQuery<ToolsPage>({
    queryKey: ["tools", "all"],
    queryFn: () => fetchTools({ limit: 999, sort: "newest" }),
    initialData: STATIC_PAGE,
    /* initialData is only a first-paint fallback — refetch the live DB immediately */
    initialDataUpdatedAt: 0,
    refetchInterval: 60_000,
  });

  const dbTools = allQuery.data?.tools ?? STATIC_ALL;

  const tools = useMemo(() => mergeTools(dbTools), [dbTools]);

  const toolsById = useMemo(() => new Map(tools.map((t) => [t.id, t])), [tools]);
  const getTool = useCallback((id: string) => toolsById.get(id), [toolsById]);

  const votes = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of dbTools) map[t.id] = t.votes;
    return map;
  }, [dbTools]);

  const myVotes = useSyncExternalStore(subscribeMyVotes, getMyVotesSnapshot, getMyVotesServerSnapshot);

  const toggleVote = useCallback(
    (id: string) => {
      const voter = ensureVoterToken();
      if (!voter) return; // no storage available — votes are anonymous anyway

      const wasVoted = getMyVotesSnapshot().has(id);
      const prevPage = queryClient.getQueryData<ToolsPage>(["tools", "all"]);
      const prevCount =
        prevPage?.tools.find((t) => t.id === id)?.votes ?? votes[id] ?? 0;
      const nextCount = Math.max(0, prevCount + (wasVoted ? -1 : 1));

      const withVote = (set: ReadonlySet<string>) => {
        const next = new Set(set);
        next.add(id);
        return next;
      };
      const withoutVote = (set: ReadonlySet<string>) => {
        const next = new Set(set);
        next.delete(id);
        return next;
      };
      const patchCache = (votesForId: number) => {
        queryClient.setQueryData<ToolsPage>(["tools", "all"], (old) =>
          old ? { ...old, tools: old.tools.map((t) => (t.id === id ? { ...t, votes: votesForId } : t)) } : old,
        );
      };

      /* optimistic update */
      writeMyVotes(wasVoted ? withoutVote(getMyVotesSnapshot()) : withVote(getMyVotesSnapshot()));
      patchCache(nextCount);

      voteTool(id, voter)
        .then((res) => {
          /* reconcile with server truth */
          writeMyVotes(res.voted ? withVote(getMyVotesSnapshot()) : withoutVote(getMyVotesSnapshot()));
          patchCache(res.votes);
        })
        .catch((err: unknown) => {
          console.warn("[aistore] vote failed — rolling back", err);
          writeMyVotes(wasVoted ? withVote(getMyVotesSnapshot()) : withoutVote(getMyVotesSnapshot()));
          patchCache(prevCount);
        });
    },
    [queryClient, votes],
  );

  const value = useMemo<ToolsContextValue>(
    () => ({ tools, getTool, votes, myVotes, toggleVote }),
    [tools, getTool, votes, myVotes, toggleVote],
  );

  return <ToolsContext.Provider value={value}>{children}</ToolsContext.Provider>;
}

export function ToolsProvider({ children }: { children: ReactNode }) {
  /* created in a useState initializer so it survives re-renders / HMR safely */
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ToolsProviderInner>{children}</ToolsProviderInner>
    </QueryClientProvider>
  );
}
