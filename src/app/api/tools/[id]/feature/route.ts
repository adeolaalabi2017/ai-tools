/* ------------------------------------------------------------------ */
/*  /api/tools/[id]/feature — toggle the editorial "Featured" badge    */
/*                                                                     */
/*  Body: { featured: boolean }                                        */
/*  Pending rows are rejected (feature them at approval time via       */
/*  POST /api/tools/[id]/moderate { action: "approve", featured }).    */
/*  Returns 200 { tool } with the serialized row.                      */
/* ------------------------------------------------------------------ */

import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { featureSchema, serializeTool } from "@/lib/aitools/server";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const body: unknown = await request.json().catch(() => undefined);
    const parsed = featureSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const tool = await db.tool.findUnique({
      where: { id },
      include: { _count: { select: { toolVotes: true } } },
    });
    if (!tool) {
      return NextResponse.json({ error: "Tool not found" }, { status: 404 });
    }
    if (tool.status === "pending") {
      return NextResponse.json(
        { error: "Pending submissions are featured at approval time." },
        { status: 400 },
      );
    }

    const updated = await db.tool.update({
      where: { id },
      data: { featured: parsed.data.featured },
      include: { _count: { select: { toolVotes: true } } },
    });
    return NextResponse.json({ tool: serializeTool(updated, updated._count.toolVotes) });
  } catch (error) {
    console.error("[POST /api/tools/:id/feature]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
