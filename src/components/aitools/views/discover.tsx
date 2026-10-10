"use client";

import { ArrowRight, ArrowUpRight, Github, Search, Star } from "lucide-react";
import {
  CATEGORIES,
  EDITORS_PICKS,
  HERO_CHIPS,
  OPEN_FAMILY,
  PAGE_SEEDS,
  POPULAR_CARDS,
  STACK_LIST,
  WELL_REVIEWED,
  catLabel,
  countByCat,
  fmtK,
  platformLabel,
  trendingTools,
  type Tool,
  type ViewId,
} from "@/lib/aitools/data";
import { useTools } from "../tools-provider";
import {
  AppIcon,
  CategoryIcon,
  SectionHeader,
  ToolRow,
  TrendBar,
} from "../ui";
import { FeaturedArt } from "../mockups";

export function Discover({
  onNavigate,
  onOpenCategory,
  onOpenSearch,
  onOpenTool,
}: {
  onNavigate: (v: ViewId) => void;
  onOpenCategory: (cat: string) => void;
  onOpenSearch: (q?: string) => void;
  onOpenTool: (t: Tool) => void;
}) {
  const { tools } = useTools();
  const trend = trendingTools(tools);
  const maxGain = Math.max(...trend.map((t) => t.weeklyGain ?? 0), 1);
  const openFamily = OPEN_FAMILY(tools);
  const editorsPicks = EDITORS_PICKS(tools);
  const popularCards = POPULAR_CARDS(tools);
  const wellReviewed = WELL_REVIEWED(tools);
  const stackList = STACK_LIST(tools);

  return (
    <div className="mx-auto max-w-6xl px-5 pb-24">
      {/* ---------------------------------- hero --------------------------------- */}
      <section className="pb-20 pt-20 text-center sm:pt-24">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-faint">
          The AI tools directory · {tools.length} reviewed tools
        </p>
        <h1 className="mx-auto mt-5 text-balance text-5xl font-extrabold leading-[1.04] tracking-tight text-ink sm:text-6xl md:text-7xl">
          Find the best
          <br />
          <span className="underline decoration-accent decoration-[3px] underline-offset-[10px] md:underline-offset-[14px]">
            AI tools.
          </span>
        </h1>
        <p className="mt-6 text-[15px] text-mute">Curated AI tools for the way you work.</p>

        <button
          onClick={() => onOpenSearch()}
          className="mx-auto mt-9 flex h-12 w-full max-w-xl items-center gap-3 rounded-xl border border-line bg-card px-4 text-left transition-colors hover:border-line2"
        >
          <Search className="h-4 w-4 shrink-0 text-faint" />
          <span className="flex-1 truncate font-mono text-[13px] text-faint">Search open-source apps...</span>
          <span className="shrink-0 rounded-[5px] border border-line bg-elev px-1.5 py-0.5 font-mono text-[10px] text-faint">⌘K</span>
        </button>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {HERO_CHIPS.map((chip) => (
            <button
              key={chip.label}
              onClick={() =>
                chip.cat === "__more"
                  ? onNavigate("categories")
                  : chip.cat
                    ? onOpenCategory(chip.cat)
                    : onNavigate("browse")
              }
              className="rounded-full border border-line bg-card/60 px-3.5 py-1.5 text-[13px] text-ink2 transition-colors hover:border-line2 hover:text-ink"
            >
              {chip.label}
            </button>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[13px]">
          <span className="text-faint">Popular:</span>
          {PAGE_SEEDS.map((s) => (
            <button
              key={s}
              onClick={() => onOpenSearch(s)}
              className="text-ink2 transition-colors hover:text-ink hover:underline hover:underline-offset-4"
            >
              {s}
            </button>
          ))}
        </div>
      </section>

      {/* ------------------------------ editor's picks ----------------------------- */}
      <section>
        <SectionHeader
          title="Editor's picks"
          sub="Three standouts to start with."
          action="All apps"
          onAction={() => onNavigate("browse")}
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {editorsPicks.map((t) => (
            <div
              key={t.id}
              className="group overflow-hidden rounded-2xl border border-line bg-card transition-colors hover:border-line2"
            >
              <div className="dotgrid relative flex h-52 items-center gap-4 overflow-hidden p-6">
                <div className="relative z-10 min-w-0 flex-1">
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">
                    {catLabel(t.cat)}
                  </p>
                  <h3 className="mt-3 text-lg font-bold leading-snug tracking-tight text-ink">
                    {pickHeadline(t.id)}
                  </h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-mute">{pickSub(t.id)}</p>
                </div>
                <div className="hidden w-[46%] shrink-0 sm:block">
                  <div className="origin-right scale-[0.82]">
                    <FeaturedArt kind={t.featuredArt ?? "chat"} />
                  </div>
                </div>
              </div>
              <button
                onClick={() => onOpenTool(t)}
                className="flex w-full items-center gap-3 border-t border-line p-4 text-left transition-colors hover:bg-elev"
              >
                <AppIcon tool={t} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink">{t.name}</span>
                  <span className="block truncate text-xs text-faint">Alternative to {t.replaces}</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-faint transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------- open family ------------------------------ */}
      <section className="pt-20">
        <SectionHeader
          title="The Open family"
          sub="Projects that carry “Open” in their name."
          action={`All ${countByCat("agents", tools) + countByCat("coding", tools) + countByCat("research", tools) + countByCat("voice", tools)} >`}
          onAction={() => onNavigate("browse")}
        />
        <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2 xl:grid-cols-3">
          {openFamily.map((t) => (
            <ToolRow key={t.id} tool={t} onClick={() => onOpenTool(t)} />
          ))}
        </div>
      </section>

      {/* ------------------------------- trending table ---------------------------- */}
      <section className="pt-14">
        <SectionHeader
          title="Trending this week"
          sub="Projects on GitHub's weekly Trending page."
          action="See all"
          onAction={() => onNavigate("trending")}
        />
        <div className="overflow-x-auto">
          <div className="min-w-[640px]">
            <div className="grid grid-cols-[28px_minmax(0,1fr)_130px_170px_90px_24px] items-center gap-4 border-b border-line pb-3 font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
              <span>#</span>
              <span>Project</span>
              <span>Category</span>
              <span>This week</span>
              <span>Stars</span>
              <span />
            </div>
            {trend.map((t, i) => (
              <button
                key={t.id}
                onClick={() => onOpenTool(t)}
                className="grid w-full grid-cols-[28px_minmax(0,1fr)_130px_170px_90px_24px] items-center gap-4 border-b border-line/60 py-4 text-left transition-colors hover:bg-white/[0.02]"
              >
                <span className="text-sm text-faint">{i + 1}</span>
                <span className="flex min-w-0 items-center gap-3">
                  <AppIcon tool={t} />
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-semibold text-ink">{t.name}</span>
                    <span className="block truncate font-mono text-[11px] text-faint">{t.repo}</span>
                  </span>
                </span>
                <span className="text-[13px] text-mute">{catLabel(t.cat)}</span>
                <TrendBar gain={t.weeklyGain ?? 0} max={maxGain} />
                <span className="font-mono text-[13px] text-ink2">{fmtK(t.stars)}</span>
                <Github className="h-4 w-4 text-faint" />
              </button>
            ))}
          </div>
        </div>
        <p className="mt-5 flex items-center gap-2 text-xs text-faint">
          <ArrowUpRight className="h-3 w-3" />
          From GitHub's weekly Trending page · Snapshot Oct 5, 2026
        </p>
      </section>

      {/* --------------------------------- categories ------------------------------ */}
      <section className="pt-20">
        <SectionHeader
          title="Categories"
          sub=""
          action="All categories"
          onAction={() => onNavigate("categories")}
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => onOpenCategory(c.id)}
              className="flex items-center gap-3 rounded-xl border border-line bg-card px-4 py-3.5 text-left transition-colors hover:border-line2 hover:bg-elev"
            >
              <CategoryIcon id={c.id} className="h-4 w-4 shrink-0 text-ink2" />
              <span className="truncate text-sm text-ink2">{c.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ---------------------------------- popular -------------------------------- */}
      <section className="pt-20">
        <SectionHeader
          title="Popular"
          sub="Most-starred tools in the collection."
          action="See all"
          onAction={() => onNavigate("browse")}
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {popularCards.map((t) => (
            <button
              key={t.id}
              onClick={() => onOpenTool(t)}
              className="group overflow-hidden rounded-2xl border border-line bg-card text-left transition-colors hover:border-line2"
            >
              <div className="px-5 pt-5">
                <div className="overflow-hidden rounded-t-lg border border-b-0 border-line">
                  <FeaturedArt kind={t.featuredArt ?? "chat"} />
                </div>
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <AppIcon tool={t} />
                    <span className="truncate text-[15px] font-semibold text-ink">{t.name}</span>
                  </span>
                  <Github className="h-4 w-4 shrink-0 text-faint" />
                </div>
                <p className="mt-2.5 line-clamp-2 text-[13px] leading-relaxed text-mute">{t.desc}</p>
                <p className="mt-2 text-[13px] text-faint">
                  Alternative to <span className="text-ink2">{t.replaces}</span>
                </p>
                <div className="mt-3 flex items-center gap-1.5 text-xs text-faint">
                  <Star className="h-3 w-3" />
                  <span className="font-mono">{fmtK(t.stars)}</span>
                  <span className="mx-1 opacity-50">·</span>
                  {catLabel(t.cat)}
                  <span className="mx-1 opacity-50">·</span>
                  {platformLabel(t)}
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* -------------------------------- well reviewed ----------------------------- */}
      <section className="pt-20">
        <SectionHeader
          title="Well reviewed"
          sub="Established apps with published user ratings."
          action="See all"
          onAction={() => onNavigate("browse")}
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {wellReviewed.map((t) =>
            t.rating ? (
              <div key={t.id} className="flex flex-col rounded-2xl border border-line bg-card p-6 transition-colors hover:border-line2">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-3">
                    <AppIcon tool={t} />
                    <span className="min-w-0 flex-1 overflow-hidden">
                      <span className="block truncate text-[15px] font-semibold text-ink">{t.name}</span>
                      <span className="block truncate text-xs text-faint">{t.desc}</span>
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-faint" />
                </div>
                <div className="mt-5 flex items-center gap-2 text-sm">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  <span className="font-semibold text-ink">{t.rating.score.toFixed(1)}</span>
                  <span className="text-faint">
                    {t.rating.reviews} reviews · {t.rating.source}
                  </span>
                </div>
                <p className="mt-3 text-[13px] leading-relaxed text-mute">{t.rating.highlight}</p>
                {t.rating.feedbackNotes && (
                  <button className="mt-3 flex w-fit items-center gap-1.5 text-xs text-faint transition-colors hover:text-ink2">
                    Feedback notes · {t.rating.feedbackNotes}
                    <ArrowUpRight className="h-3 w-3" />
                  </button>
                )}
                <div className="flex-1" />
                <div className="mt-6 flex items-center justify-between border-t border-line pt-4">
                  <span className="flex items-center gap-1.5 text-xs text-faint">
                    <Star className="h-3 w-3" />
                    <span className="font-mono">{fmtK(t.stars)}</span> GitHub stars
                  </span>
                  <button
                    onClick={() => onOpenTool(t)}
                    className="flex items-center gap-1 text-[13px] text-ink2 transition-colors hover:text-ink"
                  >
                    Explore app
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ) : null,
          )}
        </div>
        <p className="mt-5 text-xs text-faint">
          Published ratings and review counts from Capterra/G2 · Oct 5, 2026 · Ratings cover each listed product, including its hosted or paid editions.
        </p>
      </section>

      {/* --------------------------------- community -------------------------------- */}
      <section className="pt-20">
        <div className="rounded-2xl border border-line bg-card p-8 sm:p-10">
          <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-center">
            <div className="max-w-xl">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">Community</p>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-ink">
                Know a project that belongs here?
              </h2>
              <p className="mt-2.5 text-sm leading-relaxed text-mute">
                Recommend promising finds while AIStore's editorial review keeps the primary catalog carefully curated.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => onNavigate("submit")}
                className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-zinc-950 transition-colors hover:bg-accent/90"
              >
                Submit an app
              </button>
              <button
                onClick={() => onNavigate("trending")}
                className="rounded-lg border border-line bg-elev px-4 py-2.5 text-sm text-ink2 transition-colors hover:border-line2 hover:text-ink"
              >
                Community Finds
              </button>
              <button
                onClick={() => onNavigate("submit")}
                className="rounded-lg border border-line bg-elev px-4 py-2.5 text-sm text-ink2 transition-colors hover:border-line2 hover:text-ink"
              >
                Wanted
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------------- collection -------------------------------- */}
      <section className="pt-6">
        <div className="rounded-2xl border border-line bg-card p-8 sm:p-10">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">Collection</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-ink">An open AI stack</h2>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-mute">
                Chat, images, agents, and automation — an independent toolkit for AI that stays in your hands.
              </p>
              <button
                onClick={() => onNavigate("categories")}
                className="mt-7 inline-flex items-center gap-2 rounded-lg border border-line2 bg-elev px-4 py-2.5 text-sm text-ink transition-colors hover:bg-card"
              >
                Explore the AI stack
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-hidden rounded-xl border border-line">
              {stackList.map((t, i) => (
                <button
                  key={t.id}
                  onClick={() => onOpenTool(t)}
                  className={`group flex w-full items-center gap-3.5 px-5 py-4 text-left transition-colors hover:bg-elev ${
                    i > 0 ? "border-t border-line" : ""
                  }`}
                >
                  <AppIcon tool={t} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">{t.name}</span>
                    <span className="block text-xs text-faint">{stackSub(t.id)}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-faint transition-transform group-hover:translate-x-0.5" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}

/* --------------------------- per-pick copy --------------------------- */

function pickHeadline(id: string): string {
  if (id === "opencode") return "Your next coding companion.";
  if (id === "voicestudio") return "Your voice. Your words.";
  if (id === "comfyui") return "Good images. Open by design.";
  if (id === "open-webui") return "Your chat. Your models.";
  return "";
}

function pickSub(id: string): string {
  if (id === "opencode") return "Meet OpenCode. Make something great.";
  if (id === "voicestudio") return "A local-first studio for voice and storytelling.";
  if (id === "comfyui") return "A node-based canvas for your next idea.";
  if (id === "open-webui") return "Self-host every conversation.";
  return "";
}

function stackSub(id: string): string {
  if (id === "ollama") return "Local models";
  if (id === "open-webui") return "Chat interface";
  if (id === "comfyui") return "Image generation";
  if (id === "flowise") return "Agent builder";
  return "";
}
