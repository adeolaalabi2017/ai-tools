/* ------------------------------------------------------------------ */
/*  /api/tools/[id]/vote — toggle an anonymous upvote                  */
/* ------------------------------------------------------------------ */

import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { voteSchema } from "@/lib/aitools/server";
import { enforceRateLimit, VOTE_POLICY } from "@/lib/aitools/rate-limit";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const limited = enforceRateLimit("tool-vote", request, VOTE_POLICY);
    if (limited) return limited;
    const { id } = await params;

    const body: unknown = await request.json().catch(() => undefined);
    const parsed = voteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const voter = parsed.data.voter;

    const result = await db.$transaction(async (tx) => {
      const tool = await tx.tool.findUnique({ where: { id } });
      if (!tool) return null;

      const existing = await tx.vote.findUnique({
        where: { toolId_voter: { toolId: id, voter } },
      });

      if (existing) {
        await tx.vote.delete({ where: { id: existing.id } });
        const votes = await tx.vote.count({ where: { toolId: id } });
        return { votes, voted: false };
      }

      await tx.vote.create({ data: { toolId: id, voter } });
      const votes = await tx.vote.count({ where: { toolId: id } });
      return { votes, voted: true };
    });

    if (!result) {
      return NextResponse.json({ error: "Tool not found" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error("[POST /api/tools/:id/vote]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
