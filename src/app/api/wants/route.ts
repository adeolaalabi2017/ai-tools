/* ------------------------------------------------------------------ */
/*  /api/wants — the "Wanted alternatives" request board               */
/*  GET  → list requests (sorted by votes / newest)                    */
/*  POST → create a request. If the target already exists the          */
/*         duplicate becomes a vote so the strongest needs rise.       */
/* ------------------------------------------------------------------ */

import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  normalizeWantTarget,
  serializeWant,
  wantRequestSchema,
  type ApiWant,
} from "@/lib/aitools/server";
import { enforceRateLimit, SUBMIT_POLICY } from "@/lib/aitools/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SORTS = ["votes", "newest"] as const;
type Sort = (typeof SORTS)[number];

export async function GET(request: NextRequest) {
  try {
    const rawSort = request.nextUrl.searchParams.get("sort") ?? "";
    const sort: Sort = (SORTS as readonly string[]).includes(rawSort) ? (rawSort as Sort) : "votes";

    // The board is small and unpaginated — resolve total votes (base + live)
    // and sort in JS so editorial seeds and real votes compete fairly.
    const rows = await db.want.findMany({
      include: { _count: { select: { wantVotes: true } } },
    });

    const wants: ApiWant[] = rows
      .map((w) => serializeWant(w, w.baseVotes + w._count.wantVotes))
      .sort((a, b) => {
        if (sort === "newest") {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        /* "votes" — most wanted first, newest breaks ties */
        const byVotes = b.votes - a.votes;
        if (byVotes !== 0) return byVotes;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

    return NextResponse.json({ wants, total: wants.length });
  } catch (error) {
    console.error("[GET /api/wants]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const limited = enforceRateLimit("want-submit", request, SUBMIT_POLICY);
    if (limited) return limited;
    const body: unknown = await request.json().catch(() => undefined);
    const parsed = wantRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const { target, note, voter } = parsed.data;
    const id = normalizeWantTarget(target);
    if (!id) {
      return NextResponse.json(
        { error: "Validation failed", issues: ["Name the software to replace (2–80 characters)"] },
        { status: 400 },
      );
    }

    const existing = await db.want.findUnique({
      where: { id },
      include: { _count: { select: { wantVotes: true } } },
    });

    /* Duplicate request → becomes a vote for the original. */
    if (existing) {
      const alreadyVoted = await db.wantVote.findUnique({
        where: { wantId_voter: { wantId: existing.id, voter } },
      });

      let votes = existing.baseVotes + existing._count.wantVotes;
      let dupes = existing.dupes;

      if (!alreadyVoted) {
        const updated = await db.$transaction(async (tx) => {
          await tx.wantVote.create({ data: { wantId: existing.id, voter } });
          return tx.want.update({
            where: { id: existing.id },
            data: { dupes: { increment: 1 } },
            include: { _count: { select: { wantVotes: true } } },
          });
        });
        votes = updated.baseVotes + updated._count.wantVotes;
        dupes = updated.dupes;
      }

      return NextResponse.json(
        { want: serializeWant({ ...existing, dupes }, votes), deduped: true },
        { status: 200 },
      );
    }

    /* New request. The requester's own request counts as their first vote. */
    const created = await db.$transaction(async (tx) => {
      const w = await tx.want.create({
        data: {
          id,
          target,
          note: note || null,
          status: "open",
          requester: null, // anonymous visitor — sign-in isn't wired in this build
          connected: "",
        },
      });
      await tx.wantVote.create({ data: { wantId: w.id, voter } });
      return tx.want.update({
        where: { id: w.id },
        data: {},
        include: { _count: { select: { wantVotes: true } } },
      });
    });

    return NextResponse.json(
      { want: serializeWant(created, created.baseVotes + created._count.wantVotes), deduped: false },
      { status: 201 },
    );
  } catch (error) {
    console.error("[POST /api/wants]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
