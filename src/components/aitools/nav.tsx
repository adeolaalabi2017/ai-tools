"use client";

import { Github, Layers, Moon, Search, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ViewId } from "@/lib/aitools/data";

export const REPO_URL = "https://github.com/adeolaalabi2017/ai-tools";

const LINKS: { id: ViewId; label: string; dot?: boolean }[] = [
  { id: "discover", label: "Discover" },
  { id: "categories", label: "Categories" },
  { id: "trending", label: "Trending" },
  { id: "browse", label: "New", dot: true },
  { id: "blog", label: "Blog" },
];

function toggleTheme() {
  const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem("aistore-theme", next);
  } catch {}
}

export function Nav({
  view,
  onNavigate,
  onOpenSearch,
}: {
  view: ViewId;
  onNavigate: (v: ViewId) => void;
  onOpenSearch: () => void;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-5">
        <button
          onClick={() => onNavigate("discover")}
          className="flex items-center gap-2 text-ink"
          aria-label="Open AI Stack home"
        >
          <Layers className="h-[18px] w-[18px] text-accent" aria-hidden />
          <span className="text-[15px] font-bold tracking-tight">Open AI Stack</span>
        </button>

        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => {
            const active =
              view === l.id || (l.id === "blog" && view === "post");
            return (
              <button
                key={l.id}
                onClick={() => onNavigate(l.id)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] transition-colors",
                  active ? "bg-elev text-ink" : "text-mute hover:text-ink",
                )}
              >
                {l.label}
                {l.dot && <span className="animate-dot h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onNavigate("submit")}
            className="mr-1 flex h-8 shrink-0 items-center rounded-full bg-accent px-3.5 text-[13px] font-medium text-accent-foreground transition-colors hover:bg-accent/90"
          >
            Submit
          </button>
          <button
            onClick={onOpenSearch}
            aria-label="Search"
            className="grid h-8 w-8 place-items-center rounded-full text-mute transition-colors hover:bg-elev hover:text-ink"
          >
            <Search className="h-4 w-4" />
          </button>
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="grid h-8 w-8 place-items-center rounded-full text-mute transition-colors hover:bg-elev hover:text-ink"
          >
            {/* icons swap via data-theme, no state needed */}
            <Sun className="hidden h-4 w-4 [html[data-theme='dark']_&]:block" />
            <Moon className="hidden h-4 w-4 [html[data-theme='light']_&]:block" />
          </button>
          <span className="mx-1 hidden h-5 w-px bg-line sm:block" aria-hidden />
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="Open AI Stack on GitHub"
            className="hidden h-8 w-8 place-items-center rounded-full text-mute transition-colors hover:bg-elev hover:text-ink sm:grid"
          >
            <Github className="h-4 w-4" />
          </a>
        </div>
      </div>

      {/* mobile secondary nav: wraps to a second row on the narrowest phones
          rather than hiding links past a scroll edge */}
      <nav
        aria-label="Primary mobile"
        className="flex flex-wrap items-center gap-1 border-t border-line/70 px-4 py-2 md:hidden"
      >
        {LINKS.map((l) => {
          const active = view === l.id || (l.id === "blog" && view === "post");
          return (
            <button
              key={l.id}
              onClick={() => onNavigate(l.id)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[13px] transition-colors",
                active ? "bg-elev text-ink" : "text-mute",
              )}
            >
              {l.label}
              {l.dot && <span className="animate-dot h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
