"use client";

/* ------------------------------------------------------------------ */
/*  Post reader — renders one CMS post with the safe markdown renderer */
/*  and a "more from the blog" rail. Falls back to a fetch when the    */
/*  post wasn't handed over from the index (e.g. future deep links).   */
/* ------------------------------------------------------------------ */

import { ChevronLeft, Clock3 } from "lucide-react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { ViewId } from "@/lib/aitools/data";
import { fetchPosts, getPost, type ApiPost } from "@/lib/aitools/api";
import { fmtDateShort } from "@/components/admin-format";
import { Markdown, readMinutes } from "../md";
import { PostCard } from "./blog";

export function PostView({
  post,
  onNavigate,
  onOpenPost,
}: {
  /** Post handed over from the index (instant paint); null triggers a fetch. */
  post: ApiPost | null;
  onNavigate: (v: ViewId) => void;
  onOpenPost: (post: ApiPost) => void;
}) {
  /* deep-load fallback: refresh by id so edits made in the CMS show up */
  const fetched = useQuery({
    queryKey: ["posts", "detail", post?.id ?? "none"],
    queryFn: () => getPost(post!.id),
    enabled: post !== null,
    placeholderData: keepPreviousData,
    initialData: post ?? undefined,
  });

  const moreQuery = useQuery({
    queryKey: ["posts", "published"],
    queryFn: () => fetchPosts(),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });

  if (!post) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-24 text-center">
        <p className="text-sm text-mute">This post is no longer available.</p>
        <button
          onClick={() => onNavigate("blog")}
          className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-card px-4 text-sm text-ink2 transition-colors hover:border-line2 hover:text-ink"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to blog
        </button>
      </div>
    );
  }

  const current = fetched.data ?? post;
  const more = (moreQuery.data?.posts ?? []).filter((p) => p.id !== current.id).slice(0, 3);

  return (
    <div className="mx-auto max-w-6xl px-5 pb-24">
      {/* breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 pt-8 text-xs">
        <button onClick={() => onNavigate("discover")} className="text-mute transition-colors hover:text-ink">
          Discover
        </button>
        <span className="text-faint" aria-hidden>
          &gt;
        </span>
        <button onClick={() => onNavigate("blog")} className="text-mute transition-colors hover:text-ink">
          Blog
        </button>
        <span className="text-faint" aria-hidden>
          &gt;
        </span>
        <span className="max-w-[220px] truncate text-ink sm:max-w-none" aria-current="page">
          {current.title}
        </span>
      </nav>

      {/* header */}
      <header className="mt-8 max-w-3xl">
        <div className="flex items-center gap-4">
          <span
            aria-hidden
            className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl border border-line bg-elev text-4xl select-none"
          >
            {current.coverUrl ? (
              <img src={current.coverUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              current.coverEmoji
            )}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-faint">
              <span>{fmtDateShort(current.publishedAt ?? current.createdAt)}</span>
              <span className="opacity-50">·</span>
              <span className="flex items-center gap-1">
                <Clock3 className="h-3 w-3" />
                {readMinutes(current.content)} min read
              </span>
              {current.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-md border border-line px-1.5 py-px text-[10px] uppercase tracking-wide text-faint"
                >
                  {t}
                </span>
              ))}
            </div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
              {current.title}
            </h1>
          </div>
        </div>
        <p className="mt-4 text-lg leading-snug text-mute">{current.excerpt}</p>
        <p className="mt-3 text-[13px] text-faint">By {current.author}</p>
      </header>

      {/* body */}
      <article className="mt-10 max-w-3xl border-t border-line pt-10">
        <Markdown source={current.content} />
      </article>

      {/* back */}
      <div className="mt-12 max-w-3xl">
        <button
          onClick={() => onNavigate("blog")}
          className="flex h-10 items-center gap-2 rounded-lg border border-line bg-card px-4 text-sm text-ink2 transition-colors hover:border-line2 hover:text-ink"
        >
          <ChevronLeft className="h-4 w-4" />
          All posts
        </button>
      </div>

      {/* more from the blog */}
      {more.length > 0 && (
        <section className="mt-16 border-t border-line pt-10">
          <h2 className="mb-6 text-[22px] font-bold tracking-tight text-ink">More from the blog</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {more.map((p) => (
              <PostCard key={p.id} post={p} onOpen={onOpenPost} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
