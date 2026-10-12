/* ------------------------------------------------------------------ */
/*  /api/tools — list + search + filter + sort, and community submit   */
/* ------------------------------------------------------------------ */

import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  matchingCategoryIds,
  requireAdmin,
  serializeTool,
  slugify,
  submissionSchema,
  PLATFORM_VALUES,
  type ApiTool,
} from "@/lib/aitools/server";
import { enforceRateLimit, SUBMIT_POLICY } from "@/lib/aitools/rate-limit";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SORTS = ["newest", "stars", "momentum", "votes", "name"] as const;
type Sort = (typeof SORTS)[number];

/** Whitelisted values for the optional `status` query param. */
const STATUS_FILTERS = ["pending", "community", "curated"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

function buildOrderBy(sort: Sort): Prisma.ToolOrderByWithRelationInput[] {
  switch (sort) {
    case "stars":
      return [{ stars: "desc" }];
    case "votes":
      // Deterministic tiebreak: equal vote counts fall back to stars.
      return [{ toolVotes: { _count: "desc" } }, { stars: "desc" }];
    case "name":
      return [{ name: "asc" }];
    case "momentum":
      /* NULLS LAST is explicit: Postgres defaults to NULLS FIRST on DESC,
         which would lead the momentum list with tools that have no momentum
         (and would diverge from the client-side fallbacks). */
      return [{ weeklyGain: { sort: "desc", nulls: "last" } }, { stars: "desc" }];
    default:
      return [{ createdAt: "desc" }];
  }
}

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;

    const q = (sp.get("q") ?? "").trim();
    const cat = (sp.get("cat") ?? "").trim();
    const platform = (sp.get("platform") ?? "").trim();

    const rawSort = sp.get("sort") ?? "";
    const sort: Sort = (SORTS as readonly string[]).includes(rawSort) ? (rawSort as Sort) : "newest";

    // Optional status filter: "pending" | "community" | "curated".
    // Absent or invalid → public listing (everything except pending).
    const rawStatus = sp.get("status") ?? "";
    const statusFilter: StatusFilter | null = (STATUS_FILTERS as readonly string[]).includes(rawStatus)
      ? (rawStatus as StatusFilter)
      : null;

    // The moderation queue (pending submissions) is admin-only; the
    // community/curated filters just narrow the public listing.
    if (statusFilter === "pending") {
      const denied = requireAdmin(request);
      if (denied) return denied;
    }

    const rawPage = Number.parseInt(sp.get("page") ?? "", 10);
    const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
    const rawLimit = Number.parseInt(sp.get("limit") ?? "", 10);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 999) : 24;

    const where: Prisma.ToolWhereInput = {};
    const or: Prisma.ToolWhereInput[] = [];

    if (q) {
      /* mode: "insensitive" is explicit — Prisma `contains` is case-sensitive
         on Postgres (it was insensitive on SQLite) */
      or.push(
        { name: { contains: q, mode: "insensitive" } },
        { repo: { contains: q, mode: "insensitive" } },
        { desc: { contains: q, mode: "insensitive" } },
        { replaces: { contains: q, mode: "insensitive" } },
      );
      const labelCatIds = matchingCategoryIds(q);
      if (labelCatIds.length > 0) or.push({ cat: { in: labelCatIds } });
    }
    if (or.length > 0) where.OR = or;

    if (statusFilter) {
      where.status = statusFilter;
    } else {
      where.status = { not: "pending" };
    }

    if (cat) where.cat = cat;
    if ((PLATFORM_VALUES as readonly string[]).includes(platform)) {
      where.platforms = { contains: platform };
    }
    if (sp.get("selfHosted") === "1") where.selfHosted = true;
    if (sp.get("sourceAvailable") === "1") where.sourceAvailable = true;
    if (sp.get("trending") === "1") where.weeklyGain = { not: null };
    // Editors' picks only — the moderator-toggled `featured` badge.
    if (sp.get("featured") === "1") where.featured = true;

    const [total, rows] = await Promise.all([
      db.tool.count({ where }),
      db.tool.findMany({
        where,
        orderBy: buildOrderBy(sort),
        skip: (page - 1) * limit,
        take: limit,
        include: { _count: { select: { toolVotes: true } } },
      }),
    ]);

    const tools: ApiTool[] = rows.map((t) => serializeTool(t, t._count.toolVotes));
    return NextResponse.json({ tools, total, page, limit });
  } catch (error) {
    console.error("[GET /api/tools]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const limited = enforceRateLimit("tool-submit", request, SUBMIT_POLICY);
    if (limited) return limited;

    const body: unknown = await request.json().catch(() => undefined);
    const parsed = submissionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const data = parsed.data;

    // Duplicate repo check (case-insensitive, trimmed). The `contains`
    // prefilter is case-insensitive too, or case-variant repos would slip by.
    const repoNorm = data.repo.toLowerCase();
    const candidates = await db.tool.findMany({
      where: { repo: { contains: data.repo, mode: "insensitive" } },
    });
    if (candidates.some((t) => t.repo.trim().toLowerCase() === repoNorm)) {
      return NextResponse.json({ error: "This repository is already listed." }, { status: 409 });
    }

    // Unique slug id: name → "night-scribe", on collision append "-2", "-3", …
    const base = slugify(data.name) || "tool";
    let id = base;
    for (let n = 2; (await db.tool.findUnique({ where: { id } })); n += 1) {
      id = `${base}-${n}`;
    }

    const created = await db.tool.create({
      data: {
        id,
        name: data.name,
        repo: data.repo,
        desc: data.desc,
        replaces: data.replaces,
        cat: data.cat,
        platforms: data.platforms.join(","),
        status: "pending",
        stars: 0,
        weeklyGain: null,
        emoji: "🧩",
        glyph: null,
        submitter: data.submitter || null,
        logoUrl: data.logoUrl ?? null,
        screenshotUrl: data.screenshotUrl ?? null,
        headerUrl: data.headerUrl ?? null,
      },
      include: { _count: { select: { toolVotes: true } } },
    });

    return NextResponse.json({ tool: serializeTool(created, created._count.toolVotes) }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/tools]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
