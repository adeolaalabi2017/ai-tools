"use client";

/* ------------------------------------------------------------------ */
/*  Blog index — editorial content managed from the admin CMS.         */
/*  Server-backed via /api/posts (published only), first post featured. */
/* ------------------------------------------------------------------ */

import { useMemo, useState } from "react";
import { ArrowRight, Clock3 } from "lucide-react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import type { ViewId } from "@/lib/aitools/data";
import { fetchPosts, type ApiPost } from "@/lib/aitools/api";
import { fmtDateShort } from "@/components/admin-format";
import { readMinutes } from "../md";
import { AdSlot } from "../ad-slot";

export function Blog({
  onNavigate,
  onOpenPost,
}: {
  onNavigate: (v: ViewId) => void;
  onOpenPost: (post: ApiPost) => void;
}) {
  const postsQuery = useQuery({
    queryKey: ["posts", "published"],
    queryFn: () => fetchPosts(),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
  const posts = useMemo(() => postsQuery.data?.posts ?? [], [postsQuery.data]);

  const [tag, setTag] = useState<string | null>(null);
  const allTags = useMemo(() => {
    const s = new Set<string>();
    for (const p of posts) for (const t of p.tags) s.add(t);
    return [...s].sort();
  }, [posts]);

  const filtered = tag ? posts.filter((p) => p.tags.includes(tag)) : posts;
  const lead = filtered[0];
  const rest = filtered.slice(1);
  const loading = postsQuery.isLoading;

  return (
    <div className="mx-auto max-w-6xl px-5 pb-24">
      {/* header */}
      <div className="flex flex-col justify-between gap-6 pb-10 pt-14 md:flex-row md:items-end">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-ink">Blog</h1>
          <p className="mt-2 text-[15px] text-mute">
            News, guides, and community roundups from the AIStore team.
          </p>
        </div>
      </div>

      {/* tag chips */}
      {allTags.length > 0 && (
        <div className="no-scrollbar -mt-2 mb-8 flex items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setTag(null)}
            className={cn(
              "flex shrink-0 items-center rounded-full border px-3.5 py-1.5 text-[13px] transition-colors",
              tag === null
                ? "border-accent/40 bg-accent-soft text-accent"
                : "border-line text-mute hover:border-line2 hover:text-ink",
            )}
          >
            All posts
          </button>
          {allTags.map((t) => (
            <button
              key={t}
              onClick={() => setTag(t === tag ? null : t)}
              className={cn(
                "flex shrink-0 items-center rounded-full border px-3.5 py-1.5 text-[13px] transition-colors",
                t === tag
                  ? "border-accent/40 bg-accent-soft text-accent"
                  : "border-line text-mute hover:border-line2 hover:text-ink",
              )}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {/* loading */}
      {loading && (
        <div className="grid gap-4 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-52 animate-pulse rounded-xl border border-line bg-card" />
          ))}
        </div>
      )}

      {/* empty */}
      {!loading && posts.length === 0 && (
        <div className="rounded-xl border border-dashed border-line px-6 py-16 text-center">
          <p className="text-sm text-mute">No posts yet.</p>
          <p className="mt-1 text-xs text-faint">Editorial content will appear here once published.</p>
        </div>
      )}

      {/* lead + grid */}
      {!loading && filtered.length > 0 && lead && (
        <>
          <PostCard post={lead} lead onOpen={onOpenPost} />
          {rest.length > 0 && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((p) => (
                <PostCard key={p.id} post={p} onOpen={onOpenPost} />
              ))}
            </div>
          )}
        </>
      )}

      {/* small sponsored card — kept compact so it never interrupts reading */}
      {!loading && posts.length > 0 && <AdSlot placement="blog" className="mt-10 max-w-xl" />}

      {/* footer CTA */}
      <div className="mt-16 flex flex-col items-start justify-between gap-4 rounded-xl border border-line bg-card p-6 sm:flex-row sm:items-center">
        <div>
          <p className="text-[15px] font-semibold text-ink">Built something open source?</p>
          <p className="mt-1 text-sm text-mute">
            Submit it to the directory — featured tools get announced on this blog.
          </p>
        </div>
        <button
          onClick={() => onNavigate("submit")}
          className="flex h-10 shrink-0 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-zinc-950 transition-colors hover:bg-accent/90"
        >
          Submit a project
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------ post card ------------------------------ */

export function PostCard({
  post,
  lead = false,
  onOpen,
}: {
  post: ApiPost;
  lead?: boolean;
  onOpen: (post: ApiPost) => void;
}) {
  return (
    <article
      onClick={() => onOpen(post)}
      className={cn(
        "group flex cursor-pointer flex-col rounded-xl border border-line bg-card p-5 transition-colors hover:border-line2 hover:bg-elev",
        lead && "lg:col-span-3 lg:flex-row lg:items-stretch lg:gap-8",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "grid shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-elev select-none",
          lead ? "h-20 w-20 text-4xl lg:h-28 lg:w-28 lg:text-6xl" : "h-14 w-14 text-2xl",
        )}
      >
        {post.coverUrl ? (
          <img src={post.coverUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          post.coverEmoji
        )}
      </span>
      <div className={cn("mt-4 flex min-w-0 flex-1 flex-col lg:mt-0", lead && "lg:py-1")}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-faint">
          <span>{fmtDateShort(post.publishedAt ?? post.createdAt)}</span>
          <span className="opacity-50">·</span>
          <span className="flex items-center gap-1">
            <Clock3 className="h-3 w-3" />
            {readMinutes(post.content)} min read
          </span>
          {post.tags.slice(0, lead ? 3 : 2).map((t) => (
            <span
              key={t}
              className="rounded-md border border-line px-1.5 py-px text-[10px] uppercase tracking-wide text-faint"
            >
              {t}
            </span>
          ))}
        </div>
        <h2
          className={cn(
            "mt-2 font-bold tracking-tight text-ink transition-colors group-hover:text-ink",
            lead ? "text-2xl" : "text-[17px]",
          )}
        >
          {post.title}
        </h2>
        <p className={cn("mt-1.5 text-sm leading-relaxed text-mute", lead ? "line-clamp-3" : "line-clamp-2")}>
          {post.excerpt}
        </p>
        <div className="mt-auto flex items-center gap-2 pt-4 text-[13px]">
          <span className="text-faint">{post.author}</span>
          <ArrowRight className="h-3.5 w-3.5 text-accent transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
    </article>
  );
}
