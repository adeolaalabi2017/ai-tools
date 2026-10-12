/* ------------------------------------------------------------------ */
/*  /api/wants/[id] — admin management of a wanted-alternative request */
/*  PATCH  → status ("open" | "progress" | "fulfilled") and/or the     */
/*           list of connected tool ids (validated against the catalog)*/
/*  DELETE → remove the request (WantVote rows cascade).               */
/* ------------------------------------------------------------------ */

import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { serializeWant, requireAdmin, wantAdminSchema } from "@/lib/aitools/server";

export const runtime = "nodejs";

async function wantWithVotes(id: string) {
  return db.want.findUnique({
    where: { id },
    include: { _count: { select: { wantVotes: true } } },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const denied = requireAdmin(request);
    if (denied) return denied;

    const { id } = await params;
    const existing = await db.want.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Want not found" }, { status: 404 });
    }

    const body: unknown = await request.json().catch(() => undefined);
    const parsed = wantAdminSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const data = parsed.data;

    /* keep only tool ids that actually exist, preserving the given order */
    let connectedCsv: string | undefined;
    if (data.connected !== undefined) {
      const found = await db.tool.findMany({
        where: { id: { in: data.connected } },
        select: { id: true },
      });
      const known = new Set(found.map((t) => t.id));
      connectedCsv = data.connected.filter((c) => known.has(c)).join(",");
    }

    const updated = await db.want.update({
      where: { id },
      data: {
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(connectedCsv !== undefined ? { connected: connectedCsv } : {}),
      },
    });
    const withVotes = await wantWithVotes(id);
    const votes = withVotes
      ? withVotes.baseVotes + withVotes._count.wantVotes
      : updated.baseVotes;
    return NextResponse.json({ want: serializeWant(withVotes ?? updated, votes) });
  } catch (error) {
    console.error("[PATCH /api/wants/:id]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const denied = requireAdmin(request);
    if (denied) return denied;

    const { id } = await params;
    const existing = await db.want.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Want not found" }, { status: 404 });
    }
    await db.want.delete({ where: { id } }); // WantVote rows cascade
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("[DELETE /api/wants/:id]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
