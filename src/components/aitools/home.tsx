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
import { ToolDetail } from "./views/tool";
import { Wanted } from "./views/wanted";
import { Blog } from "./views/blog";
import { PostView } from "./views/post";
import type { ApiPost } from "@/lib/aitools/api";
import { AdminDashboard } from "@/components/admin-dashboard";

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
  const [activePost, setActivePost] = useState<ApiPost | null>(null);

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
    setActivePost(null);
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

  const openPost = useCallback((p: ApiPost) => {
    setActivePost(p);
    setView("post");
    window.scrollTo({ top: 0 });
  }, []);

  /* the admin console takes over the whole viewport — no site chrome */
  if (view === "admin") {
    return (
      <div className="bg-base text-ink">
        <AdminDashboard onNavigate={navigate} />
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
          {view === "submit" && (
            <Submit
              onDiscover={() => navigate("discover")}
              onWanted={() => navigate("wanted")}
            />
          )}
          {view === "tool" && (
            <ToolDetail
              toolId={activeToolId}
              onNavigate={navigate}
              onOpenTool={openTool}
              onOpenCategory={openCategory}
            />
          )}
          {view === "wanted" && <Wanted onNavigate={navigate} onOpenTool={openTool} />}
          {view === "blog" && <Blog onNavigate={navigate} onOpenPost={openPost} />}
          {view === "post" && (
            <PostView
              key={activePost?.id ?? "none"}
              post={activePost}
              onNavigate={navigate}
              onOpenPost={openPost}
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
