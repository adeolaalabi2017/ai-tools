"use client";

/* ------------------------------------------------------------------ */
/*  Tool detail view — OpenStore-style product page for a single tool.  */
/*  Renders entirely from useTools() data; no dedicated API call.       */
/* ------------------------------------------------------------------ */

import { useCallback, useSyncExternalStore } from "react";
import {
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Github,
  Star,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PLATFORM_LABEL, catById, fmtK, type Tool, type ViewId } from "@/lib/aitools/data";
import { useTools } from "../tools-provider";
import { AppIcon, FeaturedBadge } from "../ui";
import { FeaturedArt } from "../mockups";

/* --------------------------- bookmarks store --------------------------- */
/*  localStorage-backed external store (same pattern as myVotes in the    */
/*  tools provider): the server snapshot is empty so SSR/hydration never  */
/*  mismatches, and there is no setState-in-effect anywhere.              */

const BOOKMARKS_KEY = "aistore-bookmarks";
const EMPTY_BOOKMARKS: ReadonlySet<string> = new Set<string>();
const bookmarkListeners = new Set<() => void>();
let bookmarksCache: ReadonlySet<string> | null = null;

function readBookmarks(): ReadonlySet<string> {
  try {
    const raw = window.localStorage.getItem(BOOKMARKS_KEY);
    if (!raw) return EMPTY_BOOKMARKS;
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((x): x is string => typeof x === "string"));
    }
  } catch {
    /* corrupted storage — start clean */
  }
  return EMPTY_BOOKMARKS;
}

function getBookmarksSnapshot(): ReadonlySet<string> {
  if (bookmarksCache === null) bookmarksCache = readBookmarks();
  return bookmarksCache;
}

function getBookmarksServerSnapshot(): ReadonlySet<string> {
  return EMPTY_BOOKMARKS;
}

function subscribeBookmarks(onChange: () => void): () => void {
  bookmarkListeners.add(onChange);
  return () => {
    bookmarkListeners.delete(onChange);
  };
}

function writeBookmarks(next: ReadonlySet<string>): void {
  bookmarksCache = next;
  try {
    window.localStorage.setItem(BOOKMARKS_KEY, JSON.stringify([...next]));
  } catch {
    /* storage unavailable — keep in-memory only */
  }
  bookmarkListeners.forEach((l) => l());
}

function useBookmarks() {
  const saved = useSyncExternalStore(
    subscribeBookmarks,
    getBookmarksSnapshot,
    getBookmarksServerSnapshot,
  );
  const toggle = useCallback((id: string) => {
    const next = new Set(getBookmarksSnapshot());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    writeBookmarks(next);
  }, []);
  return { saved, toggle };
}

/* ------------------------------ local maps ----------------------------- */

const CATEGORY_ART: Record<string, "terminal" | "chat" | "nodes" | "wave" | "flow"> = {
  assistants: "chat",
  coding: "terminal",
  images: "nodes",
  video: "wave",
  voice: "wave",
  agents: "flow",
  research: "chat",
  writing: "chat",
  automation: "flow",
  productivity: "flow",
  privacy: "terminal",
  devtools: "terminal",
};

const CATEGORY_BEST_FOR: Record<string, string> = {
  assistants: "daily AI chat you actually control",
  coding: "developers who want an agent in their own terminal",
  images: "studios and pipelines for generated art",
  video: "editing and motion work with AI inside",
  voice: "speech and voice pipelines on your own hardware",
  agents: "autonomous workflows that do real work",
  research: "answering questions over your own knowledge",
  writing: "long-form thinking with AI assistance",
  automation: "connecting your tools with AI-native workflows",
  productivity: "a workspace that thinks with you",
  privacy: "keeping sensitive data on your own machine",
  devtools: "serving and shipping models in production",
};

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/* UTC-safe formatting so DB timestamps never render as the adjacent day */
function monthYear(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function fullDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

/* --------------------------- small components --------------------------- */

function ToolIcon({ tool }: { tool: Tool }) {
  return (
    <span
      aria-hidden
      className="grid h-16 w-16 shrink-0 select-none place-items-center overflow-hidden rounded-xl border border-line bg-elev"
    >
      {tool.logoUrl ? (
         
        <img src={tool.logoUrl} alt="" className="h-full w-full object-cover" />
      ) : tool.glyph ? (
        <span className="font-mono text-lg font-bold leading-none tracking-tight text-ink">
          {tool.glyph}
        </span>
      ) : (
        <span className="text-3xl leading-none">{tool.emoji}</span>
      )}
    </span>
  );
}

function StatLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">{children}</p>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line py-3">
      <dt className="shrink-0 text-faint">{label}</dt>
      <dd className="min-w-0 flex-1 text-right text-ink2">{children}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function ToolDetail({
  toolId,
  onNavigate,
  onOpenTool,
  onOpenCategory,
}: {
  toolId: string | null;
  onNavigate: (v: ViewId) => void;
  onOpenTool: (t: Tool) => void;
  onOpenCategory: (catId: string) => void;
}) {
  const { tools, getTool, votes, myVotes, toggleVote } = useTools();
  const { saved, toggle: toggleBookmark } = useBookmarks();

  const tool = toolId ? getTool(toolId) : undefined;

  if (!tool) {
    return (
      <div className="mx-auto max-w-6xl px-5 pb-24">
        <div className="mt-16 grid place-items-center rounded-2xl border border-dashed border-line px-6 py-24 text-center">
          <p className="text-sm text-mute">Tool not found.</p>
          <button
            onClick={() => onNavigate("discover")}
            className="mt-4 flex items-center gap-1.5 text-sm text-ink2 transition-colors hover:text-ink"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Discover
          </button>
        </div>
      </div>
    );
  }

  const cat = catById(tool.cat);
  const repoUrl = `https://github.com/${tool.repo}`;
  const issuesUrl = `${repoUrl}/issues`;
  const discussionsUrl = `${repoUrl}/discussions`;

  const voteCount = votes[tool.id] ?? tool.votes ?? 0;
  const voted = myVotes.has(tool.id);
  const isSaved = saved.has(tool.id);

  const platformNames = tool.platforms.map((p) => PLATFORM_LABEL[p] ?? p);
  const extraPlatforms = platformNames.slice(3);
  const replacesList = tool.replaces
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const moreInCat = tools
    .filter((t) => t.cat === tool.cat && t.id !== tool.id)
    .sort((a, b) => b.stars - a.stars)
    .slice(0, 2);

  const checklist = [
    "Open-source codebase",
    tool.selfHosted ? "Self-hosting available" : null,
    tool.sourceAvailable ? "Source-available license" : null,
    tool.platforms.length >= 4 ? `Runs across ${tool.platforms.length} platforms` : null,
    typeof tool.weeklyGain === "number" ? "Trending on GitHub this week" : null,
    voteCount > 0 ? "Upvoted by the community" : null,
  ]
    .filter((x): x is string => Boolean(x))
    .slice(0, 4);

  const metaBits = [
    "Open source",
  ];
  if (tool.selfHosted) metaBits.push("Self-hosting available");
  if (tool.sourceAvailable) metaBits.push("Source available");
  if (typeof tool.weeklyGain === "number") metaBits.push("Trending this week");

  const firstReplace = replacesList[0] ?? "closed alternatives";
  /* keep "AI" capitalized inside the sentence ("for AI assistants") */
  const catForCopy = cat.label.toLowerCase().replace(/^ai /, "AI ");
  const about = `${tool.desc} Built as an open-source project for ${catForCopy}, it replaces ${firstReplace} for teams that want ${tool.selfHosted ? "self-hosting control" : "an open workflow"}.`;

  const art = tool.featuredArt ?? CATEGORY_ART[tool.cat] ?? "chat";

  return (
    <div className="mx-auto max-w-6xl px-5 pb-24">
      {/* ------------------------------ breadcrumb ------------------------------ */}
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 pt-8 text-xs">
        <button
          onClick={() => onNavigate("discover")}
          className="text-mute transition-colors hover:text-ink"
        >
          Discover
        </button>
        <span className="text-faint" aria-hidden>
          &gt;
        </span>
        <button
          onClick={() => onOpenCategory(cat.id)}
          className="text-mute transition-colors hover:text-ink"
        >
          {cat.label}
        </button>
        <span className="text-faint" aria-hidden>
          &gt;
        </span>
        <span className="text-ink" aria-current="page">
          {tool.name}
        </span>
      </nav>

      {/* --------------------------- header image --------------------------- */}
      {tool.headerUrl && (
        <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-card">
          { }
          <img
            src={tool.headerUrl}
            alt={`${tool.name} header image`}
            className="h-40 w-full object-cover sm:h-56"
          />
        </div>
      )}

      {/* -------------------------------- header -------------------------------- */}
      <header className="mt-7 flex flex-wrap items-start gap-5">
        <ToolIcon tool={tool} />
        <div className="min-w-0 min-w-[240px] flex-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-faint">{cat.short}</p>
          <div className="mt-2.5 flex flex-wrap items-center gap-3">
            <h1 className="text-4xl font-extrabold tracking-tight text-ink">{tool.name}</h1>
            {tool.featured && <FeaturedBadge />}
          </div>
          <p className="mt-2.5 max-w-xl text-lg leading-snug text-mute">{tool.desc}</p>
          <p className="mt-3 text-[13px] text-faint">{metaBits.join(" · ")}</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <a
            href={repoUrl}
            target="_blank"
            rel="noreferrer"
            className="flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-zinc-950 transition-colors hover:bg-accent/90"
          >
            Get {tool.name}
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <a
            href={repoUrl}
            target="_blank"
            rel="noreferrer"
            className="flex h-10 items-center gap-2 rounded-lg border border-line bg-card px-4 text-sm text-ink2 transition-colors hover:border-line2 hover:text-ink"
          >
            <Github className="h-4 w-4" />
            GitHub
          </a>
          <button
            type="button"
            onClick={() => toggleBookmark(tool.id)}
            aria-pressed={isSaved}
            aria-label={isSaved ? `Remove ${tool.name} from saved tools` : `Save ${tool.name} for later`}
            className={cn(
              "grid h-10 w-10 place-items-center rounded-lg border bg-card transition-colors",
              isSaved
                ? "border-accent/40 bg-accent-soft text-accent"
                : "border-line text-mute hover:border-line2 hover:text-ink",
            )}
          >
            <Bookmark className={cn("h-4 w-4", isSaved && "fill-current")} />
          </button>
        </div>
      </header>

      {/* ------------------------------- stats bar ------------------------------- */}
      <div className="mt-10 grid grid-cols-2 border-y border-line md:grid-cols-3 lg:grid-cols-5">
        {/* GitHub stars */}
        <div className="border-r border-line px-5 py-6 lg:pl-0">
          <StatLabel>GitHub stars</StatLabel>
          <div className="mt-3 flex items-center gap-2 font-mono text-2xl font-semibold text-ink">
            <Star className="h-5 w-5" />
            {fmtK(tool.stars)}
          </div>
          <p className="mt-1.5 text-xs text-faint">{tool.stars.toLocaleString("en-US")} stars</p>
        </div>

        {/* Community votes — the whole cell toggles the visitor's vote */}
        <button
          type="button"
          onClick={() => toggleVote(tool.id)}
          aria-pressed={voted}
          aria-label={voted ? `Remove your vote from ${tool.name}` : `Upvote ${tool.name}`}
          className={cn(
            "px-5 py-6 text-left transition-colors hover:bg-elev md:border-r md:border-line",
            voted && "text-accent",
          )}
        >
          <StatLabel>Community votes</StatLabel>
          <div
            className={cn(
              "mt-3 flex items-center gap-2 font-mono text-2xl font-semibold",
              voted ? "text-accent" : "text-ink",
            )}
          >
            <TrendingUp className="h-5 w-5" />
            {voteCount}
          </div>
          <p className={cn("mt-1.5 text-xs", voted ? "text-accent/80" : "text-faint")}>
            {voted ? "You upvoted this" : "Tap to upvote"}
          </p>
        </button>

        {/* License */}
        <div className="border-r border-line border-t px-5 py-6 md:border-r-0 md:border-t-0 lg:border-r">
          <StatLabel>License</StatLabel>
          <div className="mt-3 font-mono text-2xl font-semibold text-ink">OSS</div>
          <p className="mt-1.5 text-xs text-faint">Open-source license</p>
        </div>

        {/* Platforms */}
        <div className="border-line border-t px-5 py-6 md:border-r lg:border-t-0">
          <StatLabel>Platforms</StatLabel>
          <div className="mt-3 text-lg font-semibold leading-snug text-ink">
            {platformNames.slice(0, 3).join(" · ") || "Web"}
          </div>
          <p className="mt-1.5 text-xs text-faint">
            {extraPlatforms.length ? `Also ${extraPlatforms.join(", ")}` : "Full list in Details"}
          </p>
        </div>

        {/* Created */}
        <div className="border-line border-t px-5 py-6 lg:border-t-0">
          <StatLabel>Created</StatLabel>
          <div className="mt-3 font-mono text-2xl font-semibold text-ink">
            {monthYear(tool.createdAt)}
          </div>
          <p className="mt-1.5 text-xs text-faint">Repository created</p>
        </div>
      </div>

      {/* ------------------------------ screenshots ------------------------------ */}
      <section className="mt-12">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-xl font-bold tracking-tight text-ink">Screenshots</h2>
          <p className="text-xs text-faint">Official project imagery</p>
        </div>
        <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-card">
          <div className="flex h-10 items-center gap-2 border-b border-line bg-elev/60 px-4">
            <span className="flex shrink-0 items-center gap-2" aria-hidden>
              <span className="h-2.5 w-2.5 rounded-full bg-line2" />
              <span className="h-2.5 w-2.5 rounded-full bg-line2" />
              <span className="h-2.5 w-2.5 rounded-full bg-line2" />
            </span>
            <span className="min-w-0 flex-1 truncate text-center font-mono text-xs text-faint">
              {tool.repo}
            </span>
            <span className="w-[46px] shrink-0" aria-hidden />
          </div>
          <div className="dotgrid relative grid min-h-[clamp(300px,55vh,520px)] place-items-center overflow-hidden p-8">
            {tool.screenshotUrl ? (
               
              <img
                src={tool.screenshotUrl}
                alt={`${tool.name} screenshot`}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="origin-center scale-[1.1] sm:scale-[1.35] lg:scale-[1.6]">
                <FeaturedArt kind={art} />
              </div>
            )}
          </div>
          <div className="border-t border-line px-4 py-2.5">
            <p className="truncate text-center font-mono text-[10px] uppercase tracking-wide text-faint">
              {tool.screenshotUrl ? `${tool.name} · submitted screenshot` : `${tool.name} · ${cat.label} workspace`}
            </p>
          </div>
        </div>
      </section>

      {/* -------------------------- best for / feedback -------------------------- */}
      <section className="mt-12 grid overflow-hidden rounded-2xl border border-line md:grid-cols-2 md:divide-x divide-y md:divide-y-0 divide-line">
        <div className="p-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-faint">Best for</p>
          <h3 className="mt-4 max-w-sm text-2xl font-bold leading-snug tracking-tight text-ink">
            A good fit for {CATEGORY_BEST_FOR[tool.cat] ?? catForCopy}.
          </h3>
        </div>
        <div className="p-8">
          <h3 className="text-[15px] font-semibold text-ink">User feedback</h3>
          {tool.rating ? (
            <>
              <div className="mt-4 flex items-center gap-2 text-sm">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                <span className="font-semibold text-ink">{tool.rating.score.toFixed(1)}</span>
                <span className="text-faint">
                  {tool.rating.reviews} reviews · {tool.rating.source}
                </span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-mute">{tool.rating.highlight}</p>
            </>
          ) : (
            <p className="mt-4 text-sm text-mute">No aggregate rating verified.</p>
          )}
          <p className="mt-4 text-sm leading-relaxed text-mute">
            Explore discussions, issues, and documentation to see how this project fits your
            workflow.
          </p>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
            <a
              href={discussionsUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-sm font-medium text-ink transition-colors hover:text-accent"
            >
              Community discussions
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <a
              href={issuesUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-sm font-medium text-ink transition-colors hover:text-accent"
            >
              Project issues
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
          <p className="mt-5 text-xs leading-relaxed text-faint">
            GitHub stars measure repository interest, not customer satisfaction.
          </p>
        </div>
      </section>

      {/* ----------------------------- about + details ---------------------------- */}
      <section className="mt-14 grid gap-12 lg:grid-cols-[1fr_360px]">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-ink">About {tool.name}</h2>
          <p className="mt-4 max-w-2xl leading-relaxed text-mute">{about}</p>
          <ul className="mt-6 space-y-3">
            {checklist.map((item) => (
              <li key={item} className="flex items-center gap-2.5 text-sm text-ink2">
                <Check className="h-4 w-4 shrink-0 text-accent" aria-hidden />
                {item}
              </li>
            ))}
          </ul>

          {replacesList.length > 0 && (
            <div className="mt-10">
              <h3 className="text-xl font-bold tracking-tight text-ink">Alternative to</h3>
              <div className="mt-4 flex flex-wrap gap-2">
                {replacesList.map((r) => (
                  <span
                    key={r}
                    className="rounded-full border border-line px-3.5 py-1.5 text-sm text-ink2"
                  >
                    {r}
                  </span>
                ))}
              </div>
              <p className="mt-4 text-xs text-faint">
                These tools share use cases. Features, costs, and deployment needs differ.
              </p>
            </div>
          )}
        </div>

        <aside>
          <h3 className="font-semibold text-ink">Details</h3>
          <dl className="mt-3 text-sm [&>div:first-child]:border-t">
            <DetailRow label="Category">{cat.label}</DetailRow>
            <DetailRow label="Available on">
              <span className="block text-right leading-snug">
                {platformNames.join(", ") || "Web"}
              </span>
            </DetailRow>
            <DetailRow label="License">Open source</DetailRow>
            <DetailRow label="Self-hosted">{tool.selfHosted ? "Available" : "—"}</DetailRow>
            <DetailRow label="Repository">
              <a
                href={repoUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex max-w-full items-center gap-1.5 font-mono text-[13px] transition-colors hover:text-accent"
              >
                <span className="truncate">{tool.repo}</span>
                <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
            </DetailRow>
            <DetailRow label="Created">{fullDate(tool.createdAt)}</DetailRow>
          </dl>

          <div className="mt-6 space-y-3">
            <a
              href={repoUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-sm font-medium text-ink transition-colors hover:text-accent"
            >
              Read the documentation
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <a
              href={issuesUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-sm font-medium text-ink transition-colors hover:text-accent"
            >
              Community &amp; issues
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

          <p className="mt-6 text-xs text-faint">GitHub stats captured Oct 5, 2026.</p>
        </aside>
      </section>

      {/* ---------------------------- more in category ---------------------------- */}
      {moreInCat.length > 0 && (
        <section className="mt-16">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-2xl font-bold tracking-tight text-ink">More in {cat.label}</h2>
            <button
              onClick={() => onOpenCategory(cat.id)}
              className="flex shrink-0 items-center gap-1 text-sm text-mute transition-colors hover:text-ink"
            >
              See category
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-x-8 gap-y-8 sm:grid-cols-2">
            {moreInCat.map((t) => (
              <button key={t.id} onClick={() => onOpenTool(t)} className="group text-left">
                <div className="flex items-start gap-3">
                  <AppIcon tool={t} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-[15px] font-semibold text-ink">{t.name}</span>
                      <Github className="h-4 w-4 shrink-0 text-faint transition-colors group-hover:text-ink2" />
                    </div>
                    <p className="mt-1 truncate text-sm text-mute">{t.desc}</p>
                    <p className="mt-1 truncate text-[13px] text-faint">Alternative to {t.replaces}</p>
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-faint">
                      <Star className="h-3 w-3" />
                      <span className="font-mono">{fmtK(t.stars)}</span>
                      <span className="mx-1 opacity-50">·</span>
                      {cat.label}
                      <span className="mx-1 opacity-50">·</span>
                      {PLATFORM_LABEL[t.platforms[0] ?? "web"]}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* -------------------------------- back link ------------------------------- */}
      <div className="mt-14">
        <button
          onClick={() => onNavigate("discover")}
          className="flex items-center gap-1.5 text-sm text-mute transition-colors hover:text-ink"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Discover
        </button>
      </div>
    </div>
  );
}
