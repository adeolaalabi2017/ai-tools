/* ------------------------------------------------------------------ */
/*  /api/posts/[id] — single post                                      */
/*  GET    → by id or slug. Drafts are only reachable via their id     */
/*           (admin editing); slug lookups expose published rows only. */
/*  PATCH  → partial update (title/excerpt/content/author/tags/cover/  */
/*           status). Slug is immutable so public links stay stable.   */
/*  DELETE → remove the post.                                          */
/* ------------------------------------------------------------------ */

import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  isAdminAuthorized,
  postUpdateSchema,
  publishDuePosts,
  requireAdmin,
  serializePost,
  slugify,
} from "@/lib/aitools/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function findPost(idOrSlug: string) {
  const direct = await db.post.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
  });
  if (direct) return direct;
  /* retired slugs keep resolving: find candidates by contains, then exact
     CSV membership in JS (contains alone would match substrings) */
  const candidates = await db.post.findMany({
    where: { previousSlugs: { contains: idOrSlug } },
  });
  return candidates.find((p) => p.previousSlugs.split(",").includes(idOrSlug)) ?? null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    /* due scheduled posts before public lookups, so single-post reads match
       the list behavior (also used by the admin to anything due) */
    if (request.nextUrl.searchParams.get("all") === "1") {
      await publishDuePosts();
    }
    const { id } = await params;
    const post = await findPost(id);
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }
    /* slug lookups must never leak drafts */
    if (post.status !== "published" && post.id !== id) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }
    /* draft-by-id is the admin editing path — moderators only */
    if (post.status !== "published" && !isAdminAuthorized(request)) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }
    return NextResponse.json({ post: serializePost(post) });
  } catch (error) {
    console.error("[GET /api/posts/:id]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const { id } = await params;
    const existing = await db.post.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const body: unknown = await request.json().catch(() => undefined);
    const parsed = postUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const data = parsed.data;

    /* slug rename: explicit on PATCH, never a side effect of retitling.
       Old public URLs must survive, so the retired slug is remembered. */
     let slugUpdate: { slug: string; previousSlugs: string } | undefined;
    if (data.slug !== undefined) {
      const desired = slugify(data.slug);
      if (desired.length < 2 || desired.length > 80) {
        return NextResponse.json(
          { error: "Validation failed", issues: ["Slug needs 2–80 letters or digits"] },
          { status: 400 },
        );
      }
      if (desired !== existing.slug) {
        /* clash against other posts' live slugs or retired slug lists */
        const clash = await db.post.findUnique({ where: { slug: desired } });
        if (clash && clash.id !== id) {
          return NextResponse.json({ error: "Slug already in use." }, { status: 409 });
        }
        const prevMatches = await db.post.findMany({
          where: { previousSlugs: { contains: desired } },
        });
        if (prevMatches.some((p) => p.id !== id && p.previousSlugs.split(",").includes(desired))) {
          return NextResponse.json({ error: "Slug already in use." }, { status: 409 });
        }
        /* retire the current slug; resurrect the desired one if it was retired */
        const prevSet = new Set(existing.previousSlugs.split(",").filter(Boolean));
        prevSet.add(existing.slug);
        prevSet.delete(desired);
        slugUpdate = { slug: desired, previousSlugs: [...prevSet].join(",") };
      }
    }

    /* scheduling semantics:
       - scheduled requires a future publishAt (given now, or already set)
       - scheduled → draft cancels the pending schedule
       - scheduled → published publishes now, keeping the original date
       - already scheduled → a new future publishAt reschedules */
    if (data.status === "scheduled") {
      const effective = data.publishAt ?? existing.publishAt;
      if (!effective) {
        return NextResponse.json(
          { error: "Validation failed", issues: ["Scheduled posts need a publish date (publishAt)"] },
          { status: 400 },
        );
      }
      if (effective.getTime() <= Date.now()) {
        return NextResponse.json(
          { error: "Validation failed", issues: ["Schedule date must be in the future"] },
          { status: 400 },
        );
      }
    } else if (existing.status === "scheduled" || data.publishAt !== undefined) {
      /* schedule consumption: any explicit draft/published transition ends a
         schedule (draft cancels, publish consumes — the publish-stamp logic
         above keeps an original date). A publishAt sent with no status change
         is an in-place reschedule and passes through the write below. */
      if (data.status !== undefined) {
        data.publishAt = null;
      }
    }

    const post = await db.post.update({
      where: { id },
      data: {
        ...(slugUpdate !== undefined ? slugUpdate : {}),
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.excerpt !== undefined ? { excerpt: data.excerpt } : {}),
        ...(data.content !== undefined ? { content: data.content } : {}),
        ...(data.author !== undefined
          ? { author: data.author.trim() || "AIStore Editors" }
          : {}),
        ...(data.tags !== undefined ? { tags: data.tags.join(",") } : {}),
        ...(data.coverEmoji !== undefined
          ? { coverEmoji: data.coverEmoji.trim() || "📝" }
          : {}),
        ...(data.coverUrl !== undefined ? { coverUrl: data.coverUrl } : {}),
        ...(data.status !== undefined
          ? {
              status: data.status,
              /* first publish stamps publishedAt; re-publish keeps the original date */
              ...(data.status === "published" && !existing.publishedAt
                ? { publishedAt: new Date() }
                : {}),
            }
          : {}),
        ...(data.publishAt !== undefined ? { publishAt: data.publishAt } : {}),
      },
    });
    return NextResponse.json({ post: serializePost(post) });
  } catch (error) {
    console.error("[PATCH /api/posts/:id]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const { id } = await params;
    const existing = await db.post.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }
    await db.post.delete({ where: { id } });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("[DELETE /api/posts/:id]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
