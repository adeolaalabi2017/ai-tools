"use client";

import { useCallback, useEffect, useState } from "react";
import { type Tool, type ViewId } from "@/lib/aitools/data";
import { ToolsProvider, useTools } from "./tools-provider";
import { Nav } from "./nav";
import { Footer } from "./footer";
import { SearchModal } from "./search-modal";
import { Discover } from "./views/discover";
import { Categories } from "./views/categories";
import { CategoryView } from "./views/category";
import { Trending } from "./views/trending";
import { Browse } from "./views/browse";
import { Submit } from "./views/submit";
import { AdminQueue } from "./views/admin";
import { ToolDetail } from "./views/tool";

export default function AIToolStore() {
  return (
    <ToolsProvider>
      <AIToolStoreApp />
    </ToolsProvider>
  );
}

function AIToolStoreApp() {
  const { getTool } = useTools();
  const [view, setView] = useState<ViewId>("discover");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchSeed, setSearchSeed] = useState("");
  const [browseQuery, setBrowseQuery] = useState("");
  const [browseCategory, setBrowseCategory] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeToolId, setActiveToolId] = useState<string | null>(null);

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
    setActiveCategory(null);
    setActiveToolId(null);
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

  const openCategory = useCallback((catId: string) => {
    setActiveCategory(catId);
    setView("category");
    window.scrollTo({ top: 0 });
  }, []);

  const openTool = useCallback((t: Tool) => {
    setActiveToolId(t.id);
    setView("tool");
    window.scrollTo({ top: 0 });
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-base text-ink">
      <Nav view={view} onNavigate={navigate} onOpenSearch={() => openSearch()} />

      <main className="flex-1">
        <div
          key={
            view === "category"
              ? `category:${activeCategory ?? ""}`
              : view === "tool"
                ? `tool:${activeToolId ?? ""}`
                : view
          }
          className="animate-rise"
        >
          {view === "discover" && (
            <Discover
              onNavigate={navigate}
              onOpenCategory={openCategory}
              onOpenSearch={openSearch}
              onOpenTool={openTool}
            />
          )}
          {view === "categories" && (
            <Categories
              onNavigate={navigate}
              onOpenCategory={openCategory}
              onOpenSearch={() => openSearch()}
              onOpenTool={openTool}
            />
          )}
          {view === "category" && activeCategory && (
            <CategoryView
              catId={activeCategory}
              onNavigate={navigate}
              onOpenTool={openTool}
              onOpenCategory={openCategory}
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
          {view === "admin" && <AdminQueue onNavigate={navigate} />}
          {view === "tool" && (
            <ToolDetail
              toolId={activeToolId}
              onNavigate={navigate}
              onOpenTool={openTool}
              onOpenCategory={openCategory}
            />
          )}
        </div>
      </main>

      <Footer onNavigate={navigate} />

      <SearchModal
        open={searchOpen}
        initialQuery={searchSeed}
        onClose={() => setSearchOpen(false)}
        onNavigate={navigate}
        onOpenTool={(t) => {
          openTool(getTool(t.id) ?? t);
        }}
      />
    </div>
  );
}
