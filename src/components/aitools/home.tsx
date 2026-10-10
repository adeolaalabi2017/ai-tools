"use client";

import { useCallback, useEffect, useState } from "react";
import { byId, type Tool, type ViewId } from "@/lib/aitools/data";
import { Nav } from "./nav";
import { Footer } from "./footer";
import { SearchModal } from "./search-modal";
import { Discover } from "./views/discover";
import { Categories } from "./views/categories";
import { Trending } from "./views/trending";
import { Browse } from "./views/browse";
import { Submit } from "./views/submit";

export default function AIToolStore() {
  const [view, setView] = useState<ViewId>("discover");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchSeed, setSearchSeed] = useState("");
  const [browseQuery, setBrowseQuery] = useState("");
  const [browseCategory, setBrowseCategory] = useState<string | null>(null);

  /* ⌘K / Ctrl+K toggles the search palette from anywhere */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const navigate = useCallback((v: ViewId) => {
    setView(v);
    /* arriving at the catalog from nav/footer starts unfiltered */
    if (v === "browse") {
      setBrowseQuery("");
      setBrowseCategory(null);
    }
    window.scrollTo({ top: 0 });
  }, []);

  const openSearch = useCallback((q = "") => {
    setSearchSeed(q);
    setSearchOpen(true);
  }, []);

  const browseWith = useCallback((cat: string | null, q = "") => {
    setBrowseCategory(cat);
    setBrowseQuery(q);
    setView("browse");
    window.scrollTo({ top: 0 });
  }, []);

  const openTool = useCallback(
    (t: Tool) => {
      browseWith(null, t.name);
    },
    [browseWith],
  );

  return (
    <div className="flex min-h-screen flex-col bg-base text-ink">
      <Nav view={view} onNavigate={navigate} onOpenSearch={() => openSearch()} />

      <main className="flex-1">
        <div key={view} className="animate-rise">
          {view === "discover" && (
            <Discover
              onNavigate={navigate}
              onBrowseCategory={(c) => browseWith(c)}
              onOpenSearch={openSearch}
              onOpenTool={openTool}
            />
          )}
          {view === "categories" && (
            <Categories
              onNavigate={navigate}
              onBrowseCategory={(c) => browseWith(c)}
              onOpenSearch={() => openSearch()}
              onOpenTool={openTool}
            />
          )}
          {view === "trending" && <Trending onOpenTool={openTool} />}
          {view === "browse" && (
            <Browse
              key={`${browseQuery}|${browseCategory ?? "all"}`}
              initialQuery={browseQuery}
              initialCategory={browseCategory}
              onOpenTool={openTool}
            />
          )}
          {view === "submit" && <Submit onDiscover={() => navigate("discover")} />}
        </div>
      </main>

      <Footer onNavigate={navigate} />

      <SearchModal
        open={searchOpen}
        initialQuery={searchSeed}
        onClose={() => setSearchOpen(false)}
        onNavigate={navigate}
        onOpenTool={(t) => {
          const fresh = byId(t.id) ?? t;
          browseWith(fresh.cat, fresh.name);
        }}
      />
    </div>
  );
}
