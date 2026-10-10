/* ------------------------------------------------------------------ */
/*  /api/tools/[id]/moderate — approve or reject (delete) a tool       */
/*                                                                     */
/*  approve: pending → community (idempotent no-op if already          */
/*           community/curated). An optional `featured` boolean sets   */
/*           the editorial flag at approval time.                      */
/*  reject:  allowed only for pending/community rows → deletes the     */
/*           tool (Vote rows cascade). Curated rows are protected.     */
/* ------------------------------------------------------------------ */

import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { moderateSchema, serializeTool } from "@/lib/aitools/server";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const body: unknown = await request.json().catch(() => undefined);
    const parsed = moderateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const { action } = parsed.data;

    const tool = await db.tool.findUnique({
      where: { id },
      include: { _count: { select: { toolVotes: true } } },
    });
    if (!tool) {
      return NextResponse.json({ error: "Tool not found" }, { status: 404 });
    }

    if (action === "approve") {
      // Idempotent: pending → community; community/curated stay untouched.
      // An explicit `featured` flag ("Feature on AIStore" toggle) is applied
      // whenever provided — including on idempotent re-approvals.
      if (tool.status === "pending" || parsed.data.featured !== undefined) {
        const updated = await db.tool.update({
          where: { id },
          data: {
            ...(tool.status === "pending" ? { status: "community" } : {}),
            ...(parsed.data.featured !== undefined ? { featured: parsed.data.featured } : {}),
          },
          include: { _count: { select: { toolVotes: true } } },
        });
        return NextResponse.json({
          action: "approve",
          tool: serializeTool(updated, updated._count.toolVotes),
        });
      }
      return NextResponse.json({
        action: "approve",
        tool: serializeTool(tool, tool._count.toolVotes),
      });
    }

    // action === "reject" → delete, but curated rows are protected.
    if (tool.status === "curated") {
      return NextResponse.json(
        { error: "Curated tools cannot be removed." },
        { status: 400 },
      );
    }
    await db.tool.delete({ where: { id } }); // Vote rows cascade via schema
    return NextResponse.json({ action: "reject", deleted: true });
  } catch (error) {
    console.error("[POST /api/tools/:id/moderate]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
