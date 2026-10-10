/* ------------------------------------------------------------------ */
/*  /api/tools/[id] — fetch a single tool by slug id                   */
/* ------------------------------------------------------------------ */

import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { serializeTool } from "@/lib/aitools/server";

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
