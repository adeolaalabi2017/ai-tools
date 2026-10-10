"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, CornerDownLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  TOOLS,
  VIEW_PAGES,
  matchTool,
  catLabel,
  type Tool,
  type ViewId,
} from "@/lib/aitools/data";
import { AppIcon, Kbd, CategoryIcon } from "./ui";

type PageItem = { kind: "page"; label: string; hint: string; view: ViewId };
type ToolItem = { kind: "tool"; tool: Tool };
type Item = PageItem | ToolItem;

export function SearchModal({
  open,
  initialQuery,
  onClose,
  onOpenTool,
  onNavigate,
}: {
  open: boolean;
  initialQuery: string;
  onClose: () => void;
  onOpenTool: (tool: Tool) => void;
  onNavigate: (view: ViewId) => void;
}) {
  if (!open) return null;
  /* keyed so a new seed re-initializes the palette from scratch */
  return (
    <Palette
      key={`palette-${initialQuery}`}
      initialQuery={initialQuery}
      onClose={onClose}
      onOpenTool={onOpenTool}
      onNavigate={onNavigate}
    />
  );
}

function Palette({
  initialQuery,
  onClose,
  onOpenTool,
  onNavigate,
}: {
  initialQuery: string;
  onClose: () => void;
  onOpenTool: (tool: Tool) => void;
  onNavigate: (view: ViewId) => void;
}) {
  const [q, setQ] = useState(initialQuery);
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 10);
    document.documentElement.style.overflow = "hidden";
    return () => {
      clearTimeout(t);
      document.documentElement.style.overflow = "";
    };
  }, []);

  const pages = useMemo<PageItem[]>(() => {
    const needle = q.trim().toLowerCase();
    return VIEW_PAGES.filter(
      (p) =>
        !needle ||
        p.label.toLowerCase().includes(needle) ||
        p.hint.toLowerCase().includes(needle),
    ).map((p) => ({ kind: "page" as const, label: p.label, hint: p.hint, view: p.view }));
  }, [q]);

  const tools = useMemo<ToolItem[]>(() => {
    return TOOLS.filter((t) => matchTool(t, q))
      .sort((a, b) => b.stars - a.stars)
      .slice(0, 8)
      .map((t) => ({ kind: "tool" as const, tool: t }));
  }, [q]);

  const items = useMemo<Item[]>(() => [...pages, ...tools], [pages, tools]);

  /* reset the highlighted row whenever the query changes (adjust-during-render) */
  const [prevQ, setPrevQ] = useState(q);
  if (prevQ !== q) {
    setPrevQ(q);
    setIdx(0);
  }

  const activate = useCallback(
    (item: Item | undefined) => {
      if (!item) return;
      onClose();
      if (item.kind === "page") onNavigate(item.view);
      else onOpenTool(item.tool);
    },
    [onClose, onNavigate, onOpenTool],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setIdx((i) => (items.length ? (i + 1) % items.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIdx((i) => (items.length ? (i - 1 + items.length) % items.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      activate(items[idx]);
    }
  };

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${idx}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [idx]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[9vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Search apps, alternatives, and pages"
    >
      <button
        aria-label="Close search"
        onClick={onClose}
        className="absolute inset-0 bg-backdrop backdrop-blur-[2px]"
        tabIndex={-1}
      />
      <div
        className="animate-pop relative w-[min(660px,100%)] overflow-hidden rounded-xl border border-line2 bg-elev shadow-2xl shadow-black/60"
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="h-4 w-4 shrink-0 text-faint" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search apps, alternatives, and pages..."
            className="h-12 flex-1 bg-transparent font-mono text-sm text-ink outline-none placeholder:text-faint"
            aria-label="Search query"
          />
          <button onClick={onClose} aria-label="Close search" className="shrink-0">
            <Kbd>esc</Kbd>
          </button>
        </div>

        <div ref={listRef} className="thin-scroll max-h-[318px] overflow-y-auto overscroll-contain py-2">
          {pages.length > 0 && (
            <>
              <p className="px-4 pb-1.5 pt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
                Pages
              </p>
              {pages.map((p, i) => {
                const gi = items.indexOf(p);
                return (
                  <button
                    key={`page-${p.label}`}
                    data-idx={gi}
                    onMouseEnter={() => setIdx(gi)}
                    onClick={() => activate(p)}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors",
                      gi === idx ? "bg-card" : "hover:bg-card/60",
                    )}
                  >
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-line bg-card text-faint">
                      <CornerDownLeft className="h-3 w-3" />
                    </span>
                    <span className="text-sm font-medium text-ink">{p.label}</span>
                    <span className="truncate text-[13px] text-faint">{p.hint}</span>
                  </button>
                );
              })}
            </>
          )}

          {tools.length > 0 && (
            <>
              <p className="px-4 pb-1.5 pt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
                Apps
              </p>
              {tools.map((item) => {
                const gi = items.indexOf(item);
                const t = item.tool;
                return (
                  <button
                    key={t.id}
                    data-idx={gi}
                    onMouseEnter={() => setIdx(gi)}
                    onClick={() => activate(item)}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors",
                      gi === idx ? "bg-card" : "hover:bg-card/60",
                    )}
                  >
                    <AppIcon tool={t} size="sm" />
                    <span className="shrink-0 text-sm font-medium text-ink">{t.name}</span>
                    <span className="min-w-0 flex-1 truncate text-[13px] text-faint">
                      · Alternative to {t.replaces}
                    </span>
                    <span className="hidden shrink-0 items-center gap-1.5 font-mono text-[11px] text-accent sm:flex">
                      <CategoryIcon id={t.cat} className="h-3 w-3" />
                      {catLabel(t.cat)}
                    </span>
                  </button>
                );
              })}
            </>
          )}

          {items.length === 0 && (
            <div className="px-4 py-10 text-center">
              <p className="text-sm text-mute">No results for &ldquo;{q}&rdquo;</p>
              <p className="mt-1 text-xs text-faint">Try a tool name, a product it replaces, or a category.</p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-5 border-t border-line bg-card/60 px-4 py-2.5 font-mono text-[11px] text-faint">
          <span>↑↓ to navigate</span>
          <span>↵ to open</span>
          <span className="ml-auto">⌘K to toggle</span>
        </div>
      </div>
    </div>
  );
}
