/* ------------------------------------------------------------------ */
/*  /api/ads/[id] — admin edit / delete of a house ad                  */
/* ------------------------------------------------------------------ */

import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { adUpdateSchema, serializeAd } from "@/lib/aitools/server";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const existing = await db.ad.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Ad not found" }, { status: 404 });
    }

    const body: unknown = await request.json().catch(() => undefined);
    const parsed = adUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const data = parsed.data;

    const ad = await db.ad.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.headline !== undefined ? { headline: data.headline } : {}),
        ...(data.body !== undefined ? { body: data.body } : {}),
        ...(data.ctaLabel !== undefined ? { ctaLabel: data.ctaLabel } : {}),
        ...(data.ctaUrl !== undefined ? { ctaUrl: data.ctaUrl } : {}),
        ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl } : {}),
        ...(data.emoji !== undefined ? { emoji: data.emoji || "✨" } : {}),
        ...(data.placement !== undefined ? { placement: data.placement } : {}),
        ...(data.active !== undefined ? { active: data.active } : {}),
        ...(data.weight !== undefined ? { weight: data.weight } : {}),
      },
    });
    return NextResponse.json({ ad: serializeAd(ad) });
  } catch (error) {
    console.error("[PATCH /api/ads/:id]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const existing = await db.ad.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Ad not found" }, { status: 404 });
    }
    await db.ad.delete({ where: { id } });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("[DELETE /api/ads/:id]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
