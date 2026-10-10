"use client";

import { ArrowRight, Search } from "lucide-react";
import {
  CATEGORIES,
  GOOD_STARTS,
  TOOLS,
  countByCat,
  type Tool,
  type ViewId,
} from "@/lib/aitools/data";
import { CategoryIcon, SectionHeader, SourceBadge, ToolRow } from "../ui";

export function Categories({
  onNavigate,
  onBrowseCategory,
  onOpenSearch,
  onOpenTool,
}: {
  onNavigate: (v: ViewId) => void;
  onBrowseCategory: (cat: string) => void;
  onOpenSearch: () => void;
  onOpenTool: (t: Tool) => void;
}) {
  return (
    <div className="mx-auto max-w-6xl px-5 pb-24">
      {/* header */}
      <div className="flex flex-col justify-between gap-6 pb-10 pt-14 md:flex-row md:items-end">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-ink">Categories</h1>
          <p className="mt-2 text-[15px] text-mute">
            Every app in the collection, grouped by what it helps you do.
          </p>
        </div>
        <button
          onClick={onOpenSearch}
          className="flex h-11 w-full items-center gap-3 rounded-lg border border-line bg-card px-4 text-left transition-colors hover:border-line2 md:w-80"
        >
          <Search className="h-4 w-4 shrink-0 text-faint" />
          <span className="flex-1 truncate font-mono text-[13px] text-faint">Search open-source apps...</span>
          <span className="shrink-0 rounded-[5px] border border-line bg-elev px-1.5 py-0.5 font-mono text-[10px] text-faint">⌘K</span>
        </button>
      </div>

      {/* grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => onBrowseCategory(c.id)}
            className="group rounded-xl border border-line bg-card p-5 text-left transition-colors hover:border-line2 hover:bg-elev"
          >
            <div className="flex items-center gap-3">
              <CategoryIcon id={c.id} className="h-[18px] w-[18px] text-ink2" />
              <span className="text-[15px] font-semibold text-ink">{c.label}</span>
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-[13px] text-faint">
              {countByCat(c.id)} curated apps
              <ArrowRight className="h-3.5 w-3.5 text-accent transition-transform group-hover:translate-x-0.5" />
            </p>
          </button>
        ))}
      </div>

      {/* good places to start */}
      <section className="pt-20">
        <SectionHeader
          title="Good places to start"
          action="All apps"
          onAction={() => onNavigate("browse")}
        />
        <div className="grid gap-x-8 md:grid-cols-2 xl:grid-cols-3">
          {GOOD_STARTS.map((t) => (
            <ToolRow
              key={t.id}
              tool={t}
              badge={t.sourceAvailable ? <SourceBadge /> : undefined}
              onClick={() => onOpenTool(t)}
            />
          ))}
        </div>
      </section>

      {/* collection footnote */}
      <p className="border-t border-line pt-6 text-xs text-faint">
        {TOOLS.length} apps tracked across {CATEGORIES.length} categories · Stars update weekly.
      </p>
    </div>
  );
}
