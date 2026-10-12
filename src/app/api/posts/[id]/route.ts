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
  requireAdmin,
  serializePost,
} from "@/lib/aitools/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function findPost(idOrSlug: string) {
  return db.post.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
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
    const denied = requireAdmin(request);
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

    const post = await db.post.update({
      where: { id },
      data: {
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
        ...(data.status !== undefined
          ? {
              status: data.status,
              /* first publish stamps publishedAt; re-publish keeps the original date */
              ...(data.status === "published" && !existing.publishedAt
                ? { publishedAt: new Date() }
                : {}),
            }
          : {}),
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
    const denied = requireAdmin(request);
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
