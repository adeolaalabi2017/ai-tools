"use client";

import { Github, ShoppingBag } from "lucide-react";
import type { ViewId } from "@/lib/aitools/data";

export function Footer({ onNavigate }: { onNavigate: (v: ViewId) => void }) {
  const browse: { label: string; view: ViewId }[] = [
    { label: "Discover", view: "discover" },
    { label: "Categories", view: "categories" },
    { label: "Trending", view: "trending" },
    { label: "New", view: "browse" },
    { label: "Blog", view: "blog" },
  ];
  const contribute: { label: string; view?: ViewId; external?: boolean }[] = [
    { label: "Submit an app", view: "submit" },
    { label: "Wanted alternatives", view: "wanted" },
    { label: "About the collection", view: "discover" },
    { label: "Review queue", view: "admin" },
    { label: "GitHub", external: true },
  ];

  return (
    <footer className="mt-auto border-t border-line bg-surface/60">
      <div className="mx-auto max-w-6xl px-5 py-14">
        <div className="flex flex-col justify-between gap-10 md:flex-row">
          <div className="max-w-xs">
            <div className="flex items-center gap-2 text-ink">
              <ShoppingBag className="h-[18px] w-[18px]" />
              <span className="text-[15px] font-bold tracking-tight">AIStore</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-mute">
              Thoughtful AI tools for the work you do every day.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-16 gap-y-2 sm:gap-x-24">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">Browse</p>
              <ul className="mt-4 space-y-2.5">
                {browse.map((l) => (
                  <li key={l.label}>
                    <button onClick={() => onNavigate(l.view)} className="text-sm text-mute transition-colors hover:text-ink">
                      {l.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">Contribute</p>
              <ul className="mt-4 space-y-2.5">
                {contribute.map((l) => (
                  <li key={l.label}>
                    {l.external ? (
                      <a
                        href="https://github.com"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-mute transition-colors hover:text-ink"
                      >
                        {l.label}
                        <Github className="h-3 w-3" />
                      </a>
                    ) : (
                      <button onClick={() => l.view && onNavigate(l.view)} className="text-sm text-mute transition-colors hover:text-ink">
                        {l.label}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-2 border-t border-line pt-6 text-xs text-faint sm:flex-row sm:items-center sm:justify-between">
          <p>Independently curated. Comparisons describe overlapping use cases.</p>
          <p>
            Built by <span className="text-mute underline underline-offset-2">Z</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
