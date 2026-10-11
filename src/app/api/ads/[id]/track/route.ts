/* ------------------------------------------------------------------ */
/*  /api/ads/[id]/track — fire-and-forget impression / click stats     */
/* ------------------------------------------------------------------ */

import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { adTrackSchema } from "@/lib/aitools/server";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body: unknown = await request.json().catch(() => undefined);
    const parsed = adTrackSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed" }, { status: 400 });
    }

    const exists = await db.ad.findUnique({ where: { id }, select: { id: true } });
    if (!exists) {
      return NextResponse.json({ error: "Ad not found" }, { status: 404 });
    }

    const ad =
      parsed.data.type === "impression"
        ? await db.ad.update({ where: { id }, data: { impressions: { increment: 1 } } })
        : await db.ad.update({ where: { id }, data: { clicks: { increment: 1 } } });

    return NextResponse.json({ ok: true, impressions: ad.impressions, clicks: ad.clicks });
  } catch (error) {
    console.error("[POST /api/ads/:id/track]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
