/* ------------------------------------------------------------------ */
/*  /api/posts — blog content managed from the admin CMS               */
/*  GET  → published posts (public; scheduled posts auto-publish on    */
/*         the public read when their time is due). `?all=1` returns   */
/*         drafts too (admin CMS list — admin token).                  */
/*  POST → create a post (draft/published/scheduled). Admin only.      */
/* ------------------------------------------------------------------ */

import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  postCreateSchema,
  publishDuePosts,
  requireAdmin,
  serializePost,
  slugify,
} from "@/lib/aitools/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const all = request.nextUrl.searchParams.get("all") === "1";

    // Drafts (and the admin CMS list) are moderator-only.
    if (all) {
      const denied = await requireAdmin(request);
      if (denied) return denied;
    } else {
      // publish due scheduled posts lazily — no scheduler infra needed
      await publishDuePosts();
    }

    const rows = await db.post.findMany({
      where: all ? undefined : { status: "published" },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ posts: rows.map(serializePost), total: rows.length });
  } catch (error) {
    console.error("[GET /api/posts]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** Unique slug from a title: "Release notes" → "release-notes", collisions get -2/-3. */
async function uniqueSlug(title: string): Promise<string> {
  const base = slugify(title) || "post";
  let candidate = base;
  let n = 1;
  while (await db.post.findUnique({ where: { slug: candidate } })) {
    n += 1;
    candidate = `${base}-${n}`;
  }
  return candidate;
}

export async function POST(request: NextRequest) {
  try {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const body: unknown = await request.json().catch(() => undefined);
    const parsed = postCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const data = parsed.data;

    /* a scheduled post must carry a valid future date */
    if (data.status === "scheduled") {
      if (!data.publishAt) {
        return NextResponse.json(
          { error: "Validation failed", issues: ["Scheduled posts need a publish date (publishAt)"] },
          { status: 400 },
        );
      }
      if (data.publishAt.getTime() <= Date.now()) {
        return NextResponse.json(
          { error: "Validation failed", issues: ["Schedule date must be in the future"] },
          { status: 400 },
        );
      }
    }
    const now = new Date();
    const post = await db.post.create({
      data: {
        slug: await uniqueSlug(data.title),
        title: data.title,
        excerpt: data.excerpt,
        content: data.content,
        author: data.author?.trim() || "AIStore Editors",
        tags: (data.tags ?? []).join(","),
        coverEmoji: data.coverEmoji?.trim() || "📝",
        coverUrl: data.coverUrl ?? null,
        status: data.status ?? "draft",
        ...(data.status === "published" ? { publishedAt: now } : {}),
        ...(data.status === "scheduled" ? { publishAt: data.publishAt ?? undefined } : {}),
      },
    });
    return NextResponse.json({ post: serializePost(post) }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/posts]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
