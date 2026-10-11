/* ------------------------------------------------------------------ */
/*  /api/tools/[id] — single tool                                      */
/*  GET   → fetch by slug id                                           */
/*  PATCH → admin metadata edit (desc/replaces/cat/platforms/flags/    */
/*          emoji). Name + repo are immutable so ids and links hold.   */
/* ------------------------------------------------------------------ */

import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { serializeTool, toolUpdateSchema } from "@/lib/aitools/server";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const tool = await db.tool.findUnique({
      where: { id },
      include: { _count: { select: { toolVotes: true } } },
    });
    if (!tool) {
      return NextResponse.json({ error: "Tool not found" }, { status: 404 });
    }
    return NextResponse.json({ tool: serializeTool(tool, tool._count.toolVotes) });
  } catch (error) {
    console.error("[GET /api/tools/:id]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const existing = await db.tool.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Tool not found" }, { status: 404 });
    }

    const body: unknown = await request.json().catch(() => undefined);
    const parsed = toolUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const data = parsed.data;

    const tool = await db.tool.update({
      where: { id },
      data: {
        ...(data.desc !== undefined ? { desc: data.desc } : {}),
        ...(data.replaces !== undefined ? { replaces: data.replaces } : {}),
        ...(data.cat !== undefined ? { cat: data.cat } : {}),
        ...(data.platforms !== undefined ? { platforms: data.platforms.join(",") } : {}),
        ...(data.selfHosted !== undefined ? { selfHosted: data.selfHosted } : {}),
        ...(data.sourceAvailable !== undefined
          ? { sourceAvailable: data.sourceAvailable }
          : {}),
        ...(data.emoji !== undefined ? { emoji: data.emoji } : {}),
        ...(data.logoUrl !== undefined ? { logoUrl: data.logoUrl } : {}),
        ...(data.screenshotUrl !== undefined ? { screenshotUrl: data.screenshotUrl } : {}),
        ...(data.headerUrl !== undefined ? { headerUrl: data.headerUrl } : {}),
      },
      include: { _count: { select: { toolVotes: true } } },
    });
    return NextResponse.json({ tool: serializeTool(tool, tool._count.toolVotes) });
  } catch (error) {
    console.error("[PATCH /api/tools/:id]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
