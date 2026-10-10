"use client";

import { useMemo, useState } from "react";
import { Github, Search, Server, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CATEGORIES,
  PLATFORM_LABEL,
  catById,
  fmtK,
  type Platform,
  type Tool,
} from "@/lib/aitools/data";
import { AppIcon, Dropdown, FeaturedBadge, PlatformRow, WeeklyGain, CategoryIcon, VoteChip } from "./ui";

/* ------------------------------ filter bar ----------------------------- */

export type SortId = "momentum" | "newest" | "stars";

export function FilterBar({
  q,
  onQ,
  category,
  onCategory,
  platform,
  onPlatform,
  selfHosted,
  onSelfHosted,
  sourceAvailable,
  onSourceAvailable,
  sort,
  onSort,
  sortOptions,
  onFilters,
}: {
  q: string;
  onQ: (v: string) => void;
  category: string | null;
  onCategory: (v: string | null) => void;
  platform: string;
  onPlatform: (v: string) => void;
  selfHosted: boolean;
  onSelfHosted: (v: boolean) => void;
  sourceAvailable: boolean;
  onSourceAvailable: (v: boolean) => void;
  sort: string;
  onSort: (v: string) => void;
  sortOptions: { value: string; label: string }[];
  onFilters: (v: string) => void;
}) {
  const chipCats = useMemo(() => CATEGORIES, []);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="flex h-10 flex-1 items-center gap-3 rounded-lg border border-line bg-card px-3.5">
          <Search className="h-4 w-4 shrink-0 text-faint" />
          <input
            value={q}
            onChange={(e) => onQ(e.target.value)}
            placeholder="Search open-source apps..."
            aria-label="Search tools"
            className="h-full min-w-0 flex-1 bg-transparent font-mono text-[13px] text-ink outline-none placeholder:text-faint"
          />
          <span className="hidden shrink-0 font-mono text-[10px] text-faint sm:block">⌘K</span>
        </div>
        <div className="flex items-center gap-2">
          <Dropdown
            value={platform}
            onChange={onPlatform}
            options={[
              { value: "all", label: "All platforms" },
              ...(Object.keys(PLATFORM_LABEL) as Platform[]).map((p) => ({
                value: p,
                label: PLATFORM_LABEL[p],
              })),
            ]}
          />
          <Dropdown
            value=""
            onChange={onFilters}
            icon={SlidersHorizontal}
            label="Filters"
            options={[
              { value: "selfhosted", label: "Self-hosted only", checked: selfHosted },
              { value: "sourceavail", label: "Source-available only", checked: sourceAvailable },
            ]}
          />
          <Dropdown value={sort} onChange={onSort} options={sortOptions} />
        </div>
      </div>

      <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1">
        <Chip
          active={category === null}
          icon={null}
          label="All apps"
          onClick={() => onCategory(null)}
        />
        {chipCats.map((c) => (
          <Chip
            key={c.id}
            active={category === c.id}
            icon={<CategoryIcon id={c.id} className="h-3.5 w-3.5" />}
            label={c.label}
            onClick={() => onCategory(c.id)}
          />
        ))}
      </div>
    </div>
  );

  function Chip({
    active,
    label,
    icon,
    onClick,
  }: {
    active: boolean;
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
  }) {
    return (
      <button
        onClick={onClick}
        className={cn(
          "flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] transition-colors",
          active
            ? "border-accent/40 bg-accent-soft text-accent"
            : "border-line bg-transparent text-mute hover:border-line2 hover:text-ink",
        )}
      >
        {icon}
        {label}
      </button>
    );
  }
}

/* ------------------------------ tool card ------------------------------ */

export function ToolCard({
  tool,
  showWeekly = false,
  onClick,
}: {
  tool: Tool;
  showWeekly?: boolean;
  onClick?: () => void;
}) {
  const cat = catById(tool.cat);
  return (
    <article
      onClick={onClick}
      className={cn(
        "group flex flex-col border-t border-line pt-5",
        onClick && "cursor-pointer",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <AppIcon tool={tool} />
          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate text-[15px] font-semibold text-ink">{tool.name}</h3>
              {tool.featured && <FeaturedBadge />}
            </div>
            <p className="mt-0.5 truncate text-xs text-faint">
              {cat.label}
              {tool.selfHosted ? " · Self-hosted" : ""}
            </p>
          </div>
        </div>
        <Github className="mt-1 h-4 w-4 shrink-0 text-faint transition-colors group-hover:text-ink2" />
      </div>

      <p className="mt-3.5 text-sm leading-relaxed text-mute">{tool.desc}</p>
      <p className="mt-2.5 text-[13px]">
        <span className="text-faint">Replaces </span>
        <span className="font-medium text-ink2">{tool.replaces}</span>
      </p>

      <div className="flex-1" />

      <div className="mt-5 flex items-center justify-between border-t border-line/70 pt-3.5">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center gap-1.5 text-xs">
            <Github className="h-3 w-3 text-faint" />
            <span className="font-mono text-ink2">{fmtK(tool.stars)}</span>
          </span>
          {showWeekly && typeof tool.weeklyGain === "number" && <WeeklyGain gain={tool.weeklyGain} />}
          <VoteChip id={tool.id} name={tool.name} />
        </div>
        <PlatformRow platforms={tool.platforms} />
      </div>
    </article>
  );
}

/* --------------------------- count + pill row -------------------------- */

export function CountRow({
  count,
  selfHosted,
  onToggleSelfHosted,
}: {
  count: number;
  selfHosted: boolean;
  onToggleSelfHosted: () => void;
}) {
  return (
    <div className="flex items-center gap-3 pb-1">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
        {count} apps to explore
      </p>
      <button
        onClick={onToggleSelfHosted}
        className={cn(
          "flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors",
          selfHosted
            ? "border-accent/40 bg-accent-soft text-accent"
            : "border-line text-mute hover:border-line2 hover:text-ink",
        )}
      >
        <Server className="h-3 w-3" />
        Self-hosted
      </button>
    </div>
  );
}
