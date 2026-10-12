/* ------------------------------------------------------------------ */
/*  /api/ads — house/sponsored card management                         */
/*  GET   ?placement=browse&limit=1 → active ads for a public slot     */
/*        ?all=1                    → full admin list (with stats)     */
/*  POST  → create (admin)                                             */
/* ------------------------------------------------------------------ */

import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  adCreateSchema,
  requireAdmin,
  serializeAd,
  AD_PLACEMENTS,
  type ApiAd,
} from "@/lib/aitools/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;

    if (sp.get("all") === "1") {
      /* the full list (incl. paused ads + stats) is the admin module */
      const denied = await requireAdmin(request);
      if (denied) return denied;

      const rows = await db.ad.findMany({ orderBy: { createdAt: "desc" } });
      const ads: ApiAd[] = rows.map(serializeAd);
      return NextResponse.json({ ads, total: ads.length });
    }

    const placement = (sp.get("placement") ?? "").trim();
    if (!(AD_PLACEMENTS as readonly string[]).includes(placement)) {
      return NextResponse.json({ error: "Unknown placement" }, { status: 400 });
    }
    const rawLimit = Number.parseInt(sp.get("limit") ?? "1", 10);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 3) : 1;

    const rows = await db.ad.findMany({
      where: { placement, active: true },
      orderBy: [{ weight: "desc" }, { createdAt: "desc" }],
    });
    if (rows.length === 0) {
      return NextResponse.json({ ads: [] });
    }

    /* weighted rotation: pick `limit` distinct ads biased by weight */
    const pool = [...rows];
    const picked: typeof rows = [];
    while (pool.length > 0 && picked.length < limit) {
      const total = pool.reduce((acc, a) => acc + a.weight, 0);
      let roll = Math.random() * total;
      let idx = 0;
      for (let i = 0; i < pool.length; i++) {
        roll -= pool[i].weight;
        if (roll <= 0) {
          idx = i;
          break;
        }
      }
      picked.push(pool[idx]);
      pool.splice(idx, 1);
    }
    return NextResponse.json({ ads: picked.map(serializeAd) });
  } catch (error) {
    console.error("[GET /api/ads]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const body: unknown = await request.json().catch(() => undefined);
    const parsed = adCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const data = parsed.data;

    const created = await db.ad.create({
      data: {
        name: data.name,
        headline: data.headline,
        body: data.body,
        ctaLabel: data.ctaLabel,
        ctaUrl: data.ctaUrl,
        imageUrl: data.imageUrl ?? null,
        emoji: data.emoji || "✨",
        placement: data.placement,
        active: data.active ?? false,
        weight: data.weight ?? 1,
      },
    });
    return NextResponse.json({ ad: serializeAd(created) }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/ads]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
