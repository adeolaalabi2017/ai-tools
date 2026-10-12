/* ------------------------------------------------------------------ */
/*  /api/wants/[id]/vote — toggle the visitor's vote on a request      */
/* ------------------------------------------------------------------ */

import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { serializeWant, wantVoteSchema } from "@/lib/aitools/server";
import { enforceRateLimit, VOTE_POLICY } from "@/lib/aitools/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const limited = await enforceRateLimit("want-vote", request, VOTE_POLICY);
    if (limited) return limited;
    const { id } = await params;

    const body: unknown = await request.json().catch(() => undefined);
    const parsed = wantVoteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const { voter } = parsed.data;

    const want = await db.want.findUnique({ where: { id } });
    if (!want) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    const result = await db.$transaction(async (tx) => {
      const existing = await tx.wantVote.findUnique({
        where: { wantId_voter: { wantId: id, voter } },
      });

      if (existing) {
        await tx.wantVote.delete({ where: { id: existing.id } });
      } else {
        await tx.wantVote.create({ data: { wantId: id, voter } });
      }

      const updated = await tx.want.update({
        where: { id },
        data: {},
        include: { _count: { select: { wantVotes: true } } },
      });
      return {
        votes: updated.baseVotes + updated._count.wantVotes,
        voted: !existing,
        row: updated,
      };
    });

    return NextResponse.json({
      votes: result.votes,
      voted: result.voted,
      want: serializeWant(result.row, result.votes),
    });
  } catch (error) {
    console.error("[POST /api/wants/[id]/vote]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
