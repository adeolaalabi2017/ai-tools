"use client";

/* ------------------------------------------------------------------ */
/*  Wanted alternatives — the community request board.                 */
/*  "What should open source replace next?"                            */
/*  Visitors request alternatives, vote on existing needs, and         */
/*  duplicate requests become votes so the strongest needs rise.       */
/* ------------------------------------------------------------------ */

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronUp,
  CircleDashed,
  CircleDot,
  Github,
  Info,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tool, ViewId } from "@/lib/aitools/data";
import { createWant, fetchWants, voteWant, type ApiWant, type WantsPage } from "@/lib/aitools/api";
import { ensureVoterToken, useTools } from "../tools-provider";
import { Dropdown } from "../ui";

/* --------------------------- my want votes --------------------------- */
/*  localStorage-backed external store — same pattern as myVotes in the */
/*  tools provider: the server snapshot is empty so SSR/hydration never */
/*  mismatches, and there is no setState-in-effect anywhere.            */

const MY_WANT_VOTES_KEY = "aistore-mywantvotes";
const EMPTY_WANT_VOTES: ReadonlySet<string> = new Set<string>();
const wantVoteListeners = new Set<() => void>();
let wantVotesCache: ReadonlySet<string> | null = null;

function readMyWantVotes(): ReadonlySet<string> {
  try {
    const raw = window.localStorage.getItem(MY_WANT_VOTES_KEY);
    if (!raw) return EMPTY_WANT_VOTES;
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((x): x is string => typeof x === "string"));
    }
  } catch {
    /* corrupted storage — start clean */
  }
  return EMPTY_WANT_VOTES;
}

function getWantVotesSnapshot(): ReadonlySet<string> {
  if (wantVotesCache === null) wantVotesCache = readMyWantVotes();
  return wantVotesCache;
}

function getWantVotesServerSnapshot(): ReadonlySet<string> {
  return EMPTY_WANT_VOTES;
}

function subscribeWantVotes(onChange: () => void): () => void {
  wantVoteListeners.add(onChange);
  return () => {
    wantVoteListeners.delete(onChange);
  };
}

function writeMyWantVotes(next: ReadonlySet<string>): void {
  wantVotesCache = next;
  try {
    window.localStorage.setItem(MY_WANT_VOTES_KEY, JSON.stringify([...next]));
  } catch {
    /* storage unavailable — keep in-memory only */
  }
  wantVoteListeners.forEach((l) => l());
}

function useMyWantVotes() {
  const saved = useSyncExternalStore(
    subscribeWantVotes,
    getWantVotesSnapshot,
    getWantVotesServerSnapshot,
  );
  return saved;
}

/* ------------------------------- helpers ------------------------------ */

/** Relative time, rendered only after the client-side fetch resolves. */
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const secs = Math.max(1, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

const STATUS_META: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  open: {
    label: "Open",
    className: "border-line text-mute",
    icon: <CircleDot className="h-3 w-3" aria-hidden />,
  },
  progress: {
    label: "In progress",
    className: "border-amber-500/40 bg-amber-500/10 text-amber-500",
    icon: <CircleDashed className="h-3 w-3" aria-hidden />,
  },
  fulfilled: {
    label: "Fulfilled",
    className: "border-accent/40 bg-accent-soft text-accent",
    icon: <Check className="h-3 w-3" aria-hidden />,
  },
};

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? STATUS_META.open;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
        meta.className,
      )}
    >
      {meta.icon}
      {meta.label}
    </span>
  );
}

type StatusFilter = "all" | "open" | "progress" | "fulfilled";
const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "progress", label: "In progress" },
  { id: "fulfilled", label: "Fulfilled" },
];

/* ------------------------------ components ---------------------------- */

function WantRow({
  want,
  onOpenTool,
}: {
  want: ApiWant;
  onOpenTool: (t: Tool) => void;
}) {
  const queryClient = useQueryClient();
  const myWantVotes = useMyWantVotes();

  const voted = myWantVotes.has(want.id);

  const toggle = useCallback(() => {
    const voter = ensureVoterToken();
    if (!voter) return;

    const wasVoted = getWantVotesSnapshot().has(want.id);
    const prevVotes = want.votes;
    const nextVotes = Math.max(0, prevVotes + (wasVoted ? -1 : 1));

    const withVote = (set: ReadonlySet<string>) => {
      const next = new Set(set);
      next.add(want.id);
      return next;
    };
    const withoutVote = (set: ReadonlySet<string>) => {
      const next = new Set(set);
      next.delete(want.id);
      return next;
    };
    const patchCaches = (votesForId: number) => {
      queryClient.setQueriesData<WantsPage>({ queryKey: ["wants"] }, (old) =>
        old
          ? {
              ...old,
              wants: old.wants.map((w) => (w.id === want.id ? { ...w, votes: votesForId } : w)),
            }
          : old,
      );
    };

    /* optimistic update */
    writeMyWantVotes(wasVoted ? withoutVote(getWantVotesSnapshot()) : withVote(getWantVotesSnapshot()));
    patchCaches(nextVotes);

    voteWant(want.id, voter)
      .then((res) => {
        /* reconcile with server truth */
        writeMyWantVotes(res.voted ? withVote(getWantVotesSnapshot()) : withoutVote(getWantVotesSnapshot()));
        patchCaches(res.votes);
      })
      .catch((err: unknown) => {
        console.warn("[aistore] want vote failed — rolling back", err);
        writeMyWantVotes(wasVoted ? withVote(getWantVotesSnapshot()) : withoutVote(getWantVotesSnapshot()));
        patchCaches(prevVotes);
      });
  }, [queryClient, want.id, want.votes]);

  const { getTool } = useTools();
  const connectedTools = want.connected
    .map((id) => getTool(id))
    .filter((t): t is Tool => Boolean(t));

  const dupeLabel =
    want.dupes === 1 ? "1 duplicate became a vote" : `${want.dupes} duplicates became votes`;

  return (
    <li className="flex gap-3 p-5 sm:gap-4 sm:p-6">
      {/* vote pill */}
      <button
        type="button"
        onClick={toggle}
        aria-pressed={voted}
        aria-label={voted ? `Remove your vote from the ${want.target} request` : `Upvote the ${want.target} request`}
        className={cn(
          "flex h-fit w-12 shrink-0 select-none flex-col items-center gap-0.5 rounded-lg border py-2 transition-colors sm:w-14 sm:py-2.5",
          voted
            ? "border-accent/40 bg-accent-soft text-accent"
            : "border-line text-mute hover:border-line2 hover:text-ink",
        )}
      >
        <ChevronUp className="h-4 w-4" aria-hidden />
        <span className="font-mono text-sm font-semibold leading-none">{want.votes}</span>
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <h3 className="text-[15px] font-semibold leading-snug text-ink">
            An open-source alternative to {want.target}
          </h3>
          <StatusBadge status={want.status} />
        </div>

        {want.note && <p className="mt-1.5 text-sm leading-relaxed text-mute">{want.note}</p>}

        <p className="mt-2 text-xs text-faint">
          requested by {want.requester ?? "a visitor"}
          <span aria-hidden> · </span>
          {timeAgo(want.createdAt)}
          {want.dupes > 0 && (
            <>
              <span aria-hidden> · </span>
              {dupeLabel}
            </>
          )}
        </p>

        {connectedTools.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-faint">Connected projects:</span>
            {connectedTools.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onOpenTool(t)}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-elev px-2.5 py-1 text-xs text-ink2 transition-colors hover:border-line2 hover:text-ink"
                aria-label={`Open ${t.name} in the directory`}
              >
                <span aria-hidden>{t.emoji}</span>
                {t.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ */

export function Wanted({
  onNavigate,
  onOpenTool,
}: {
  onNavigate: (v: ViewId) => void;
  onOpenTool: (t: Tool) => void;
}) {
  const queryClient = useQueryClient();

  const [sort, setSort] = useState<"votes" | "newest">("votes");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [target, setTarget] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "ok" | "deduped" | "error"; text: string } | null>(
    null,
  );
  const [signinNote, setSigninNote] = useState(false);

  const boardQuery = useQuery<WantsPage>({
    queryKey: ["wants", sort],
    queryFn: () => fetchWants(sort),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });

  /* auto-dismiss submit feedback */
  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 8000);
    return () => clearTimeout(t);
  }, [feedback]);

  const wants = boardQuery.data?.wants ?? [];
  const filtered = statusFilter === "all" ? wants : wants.filter((w) => w.status === statusFilter);

  const counts = { all: wants.length, open: 0, progress: 0, fulfilled: 0 } as Record<StatusFilter, number>;
  for (const w of wants) {
    if (w.status === "open" || w.status === "progress" || w.status === "fulfilled") counts[w.status]++;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = target.trim();
    if (trimmed.length < 2 || submitting) return;

    const voter = ensureVoterToken();
    if (!voter) {
      setFeedback({ kind: "error", text: "Your browser blocks local storage, so requests can't be submitted." });
      return;
    }

    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await createWant({ target: trimmed, note: note.trim() || undefined, voter });

      /* both paths (new request and duplicate-as-vote) cast this browser's vote */
      const withVote = (set: ReadonlySet<string>) => {
        const next = new Set(set);
        next.add(res.want.id);
        return next;
      };
      writeMyWantVotes(withVote(getWantVotesSnapshot()));

      /* instant feedback: insert-or-replace the row in every cached sort */
      queryClient.setQueriesData<WantsPage>({ queryKey: ["wants"] }, (old) => {
        if (!old) return old;
        const rest = old.wants.filter((w) => w.id !== res.want.id);
        return { ...old, wants: [res.want, ...rest], total: old.total + 1 };
      });
      /* then let the server restore the correct ordering */
      void queryClient.invalidateQueries({ queryKey: ["wants"] });

      if (res.deduped) {
        setFeedback({
          kind: "deduped",
          text: `Already requested — your request became a vote for “${res.want.target}”.`,
        });
      } else {
        setFeedback({ kind: "ok", text: `Request posted — rally votes so the editors notice.` });
      }
      setTarget("");
      setNote("");
    } catch (err) {
      const message =
        err instanceof Error && err.message ? err.message : "Couldn't post the request. Please try again.";
      setFeedback({ kind: "error", text: message });
    } finally {
      setSubmitting(false);
    }
  };

  const statusCountLabel = (id: StatusFilter): string => `${counts[id]}`;

  return (
    <div className="mx-auto max-w-6xl px-5 pb-24">
      {/* -------------------------------- hero -------------------------------- */}
      <header className="pt-14">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-faint">Wanted alternatives</p>
        <h1 className="mt-3 max-w-2xl text-4xl font-extrabold tracking-tight text-ink sm:text-[40px] sm:leading-[1.1]">
          What should open source replace next?
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-mute">
          Request an alternative, vote on existing needs, and connect requests with useful projects.
          Duplicate requests become votes so the strongest needs rise.
        </p>
      </header>

      {/* ---------------------------- sign-in banner ---------------------------- */}
      <section aria-label="Sign in" className="mt-8">
        <div className="flex flex-col gap-4 rounded-xl border border-line bg-card p-5 sm:flex-row sm:items-center sm:gap-5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-line bg-elev text-ink2">
            <Github className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold leading-snug text-ink">
              Sign in to request or vote for an alternative.
            </p>
            <p className="mt-0.5 text-[13px] leading-relaxed text-mute">
              Browsing and app submissions are open to everyone. Sign-in keeps votes to one per person.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSigninNote(true)}
            className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-zinc-950 transition-colors hover:bg-accent/90"
          >
            <Github className="h-4 w-4" aria-hidden />
            Sign in with GitHub
          </button>
        </div>
        {signinNote && (
          <p
            role="status"
            className="mt-3 flex items-start gap-2 rounded-lg border border-line bg-elev px-4 py-3 text-[13px] leading-relaxed text-mute"
          >
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
            <span>
              Demo build — GitHub sign-in isn&rsquo;t wired up here. Votes are still limited to one
              per browser, so the board stays honest.
            </span>
          </p>
        )}
      </section>

      {/* -------------------------------- board -------------------------------- */}
      <section aria-label="Request board" className="mt-6">
        <div className="overflow-hidden rounded-2xl border border-line bg-card">
          {boardQuery.isError ? (
            /* error state — matches the reference exactly */
            <div className="grid place-items-center px-6 py-20 text-center">
              <p className="text-lg font-bold text-ink">Wanted alternatives couldn&rsquo;t load.</p>
              <p className="mt-2 text-sm text-mute">The request board is unavailable.</p>
              <button
                type="button"
                onClick={() => void boardQuery.refetch()}
                className="mt-6 rounded-lg border border-line2 bg-elev px-4 py-2 text-sm text-ink transition-colors hover:bg-card"
              >
                Try again
              </button>
            </div>
          ) : (
            <>
              {/* request form */}
              <form onSubmit={(e) => void handleSubmit(e)} className="border-b border-line p-5 sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <label htmlFor="want-target" className="sr-only">
                    Software to replace
                  </label>
                  <input
                    id="want-target"
                    value={target}
                    maxLength={80}
                    onChange={(e) => setTarget(e.target.value)}
                    placeholder="Software you'd like an alternative to — e.g. Notion, Figma…"
                    className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-base px-3.5 text-sm text-ink outline-none transition-colors placeholder:text-faint focus:border-line2"
                  />
                  <button
                    type="submit"
                    disabled={submitting || target.trim().length < 2}
                    className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-accent px-5 text-sm font-medium text-zinc-950 transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                    {submitting ? "Requesting…" : "Request"}
                  </button>
                </div>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <label htmlFor="want-note" className="sr-only">
                    Add context (optional)
                  </label>
                  <input
                    id="want-note"
                    value={note}
                    maxLength={280}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Why do you need it? (optional)"
                    className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-base px-3.5 text-[13px] text-ink outline-none transition-colors placeholder:text-faint focus:border-line2"
                  />
                  <p className="shrink-0 text-xs text-faint sm:text-right">
                    Duplicate requests become votes for the original.
                  </p>
                </div>
                {feedback && (
                  <p
                    role="status"
                    className={cn(
                      "mt-3 rounded-lg border px-3.5 py-2.5 text-[13px] leading-relaxed",
                      feedback.kind === "error"
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-500"
                        : "border-accent/30 bg-accent-soft text-accent",
                    )}
                  >
                    {feedback.text}
                  </p>
                )}
              </form>

              {/* controls */}
              <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1" role="group" aria-label="Filter by status">
                  {STATUS_FILTERS.map((f) => {
                    const active = statusFilter === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setStatusFilter(f.id)}
                        className={cn(
                          "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] transition-colors",
                          active
                            ? "border-line2 bg-elev text-ink"
                            : "border-line text-mute hover:border-line2 hover:text-ink",
                        )}
                      >
                        {f.label}
                        <span className={cn("font-mono text-[11px]", active ? "text-faint" : "text-faint")}>
                          {statusCountLabel(f.id)}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="shrink-0">
                  <Dropdown
                    value={sort}
                    onChange={(v) => setSort(v === "newest" ? "newest" : "votes")}
                    label="Sort"
                    align="right"
                    options={[
                      { value: "votes", label: "Most wanted" },
                      { value: "newest", label: "Newest" },
                    ]}
                  />
                </div>
              </div>

              {/* list */}
              {boardQuery.isPending ? (
                <div className="animate-pulse" aria-hidden>
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="flex gap-4 border-b border-line p-5 last:border-b-0 sm:p-6">
                      <div className="h-[52px] w-12 rounded-lg bg-elev sm:w-14" />
                      <div className="flex-1 space-y-2.5 py-0.5">
                        <div className="h-4 w-2/3 rounded bg-elev" />
                        <div className="h-3 w-full rounded bg-elev" />
                        <div className="h-3 w-1/3 rounded bg-elev" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="grid place-items-center px-6 py-16 text-center">
                  <p className="text-sm font-semibold text-ink">
                    {statusFilter === "all"
                      ? "No requests yet — be the first."
                      : `No ${STATUS_FILTERS.find((f) => f.id === statusFilter)?.label.toLowerCase()} requests right now.`}
                  </p>
                  {statusFilter !== "all" && (
                    <button
                      type="button"
                      onClick={() => setStatusFilter("all")}
                      className="mt-4 rounded-lg border border-line2 bg-elev px-4 py-2 text-sm text-ink transition-colors hover:bg-card"
                    >
                      Show everything
                    </button>
                  )}
                </div>
              ) : (
                <ul className="divide-y divide-line">
                  {filtered.map((w) => (
                    <WantRow key={w.id} want={w} onOpenTool={onOpenTool} />
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        <p className="mt-4 text-xs leading-relaxed text-faint">
          Editors review the board and connect fulfilled requests with projects from the collection.
          Looking to contribute a project instead?{" "}
          <button
            type="button"
            onClick={() => onNavigate("submit")}
            className="text-ink2 underline underline-offset-4 transition-colors hover:text-ink"
          >
            Submit an app
          </button>
          .
        </p>
      </section>
    </div>
  );
}
