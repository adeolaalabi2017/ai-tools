/* ------------------------------------------------------------------ */
/*  /api/analytics — anonymous page-view beacon + admin aggregates     */
/*  POST ?body {path, session}  → record one page view                 */
/*  GET  ?days=14               → daily series, uniques, top pages     */
/* ------------------------------------------------------------------ */

import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { pageViewSchema, requireAdmin, type AnalyticsSummary } from "@/lib/aitools/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_DAYS = 90;

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json().catch(() => undefined);
    const parsed = pageViewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed" }, { status: 400 });
    }
    await db.pageView.create({
      data: { path: parsed.data.path, session: parsed.data.session },
    });
    /* beacon — the caller ignores the body */
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[POST /api/analytics]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    /* traffic summaries are for the admin Overview — the public POST
       beacon below stays open */
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const rawDays = Number.parseInt(request.nextUrl.searchParams.get("days") ?? "14", 10);
    const days = Number.isFinite(rawDays) && rawDays > 0 ? Math.min(rawDays, MAX_DAYS) : 14;

    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - (days - 1));

    const rows = await db.pageView.findMany({
      where: { createdAt: { gte: since } },
      select: { path: true, session: true, createdAt: true },
    });

    /* day keys are UTC "YYYY-MM-DD" — stable for bucketing + labels */
    const keyOf = (d: Date) => d.toISOString().slice(0, 10);
    const buckets = new Map<string, { views: number; sessions: Set<string> }>();
    for (let i = 0; i < days; i++) {
      const d = new Date(since);
      d.setUTCDate(since.getUTCDate() + i);
      buckets.set(keyOf(d), { views: 0, sessions: new Set() });
    }

    const perPath = new Map<string, number>();
    const allSessions = new Set<string>();
    for (const r of rows) {
      const key = keyOf(r.createdAt);
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.views += 1;
        bucket.sessions.add(r.session);
      }
      perPath.set(r.path, (perPath.get(r.path) ?? 0) + 1);
      allSessions.add(r.session);
    }

    const series = [...buckets.entries()].map(([date, b]) => ({
      date,
      views: b.views,
      visitors: b.sessions.size,
    }));
    const topPages = [...perPath.entries()]
      .map(([path, views]) => ({ path, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 6);

    const summary: AnalyticsSummary = {
      series,
      totalViews: rows.length,
      uniqueVisitors: allSessions.size,
      topPages,
    };
    return NextResponse.json(summary);
  } catch (error) {
    console.error("[GET /api/analytics]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
