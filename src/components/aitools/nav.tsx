"use client";

import { Github, Moon, Search, ShoppingBag, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ViewId } from "@/lib/aitools/data";

const LINKS: { id: ViewId; label: string; dot?: boolean }[] = [
  { id: "discover", label: "Discover" },
  { id: "categories", label: "Categories" },
  { id: "trending", label: "Trending" },
  { id: "browse", label: "New", dot: true },
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
    <header className="sticky top-0 z-40 border-b border-line bg-base/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-5">
        <button
          onClick={() => onNavigate("discover")}
          className="flex items-center gap-2 text-ink"
          aria-label="AIStore home"
        >
          <ShoppingBag className="h-[18px] w-[18px]" />
          <span className="text-[15px] font-bold tracking-tight">AIStore</span>
        </button>

        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <button
              key={l.id}
              onClick={() => onNavigate(l.id)}
              aria-current={view === l.id ? "page" : undefined}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] transition-colors",
                view === l.id ? "bg-elev text-ink" : "text-mute hover:text-ink",
              )}
            >
              {l.label}
              {l.dot && <span className="animate-dot h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onNavigate("submit")}
            className="mr-1 hidden h-8 items-center rounded-full bg-solid px-3.5 text-[13px] font-medium text-solidfg transition-colors hover:bg-solidhover sm:flex"
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
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            aria-label="AIStore on GitHub"
            className="hidden h-8 w-8 place-items-center rounded-full text-mute transition-colors hover:bg-elev hover:text-ink sm:grid"
          >
            <Github className="h-4 w-4" />
          </a>
        </div>
      </div>

      {/* mobile secondary nav */}
      <nav
        aria-label="Primary mobile"
        className="no-scrollbar flex items-center gap-1 overflow-x-auto border-t border-line/70 px-5 py-2 md:hidden"
      >
        {LINKS.map((l) => (
          <button
            key={l.id}
            onClick={() => onNavigate(l.id)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] transition-colors",
              view === l.id ? "bg-elev text-ink" : "text-mute",
            )}
          >
            {l.label}
            {l.dot && <span className="animate-dot h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />}
          </button>
        ))}
        <button
          onClick={() => onNavigate("submit")}
          className="shrink-0 rounded-full bg-solid px-3 py-1.5 text-[13px] font-medium text-solidfg"
        >
          Submit
        </button>
      </nav>
    </header>
  );
}
