/**
 * POST /api/tools/[id]/vote — anonymous upvote toggle. The handler runs its
 * own $transaction, so the fake db's transaction wrapper is exercised too.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", async () => {
  const { fake } = await import("./fake-db");
  return { db: fake.db };
});

import { POST as vote } from "@/app/api/tools/[id]/vote/route";
import { GET as getTool } from "@/app/api/tools/[id]/route";
import { fake } from "./fake-db";
import { jsonRequest, readJson, withId } from "./helpers";

let ipSeq = 50;
const nextIp = () => `198.18.0.${++ipSeq}`;

const VOTER = "voter-token-001";

beforeEach(() => {
  fake.reset();
  fake.seedTools([{ id: "tool-a" }, { id: "tool-b" }]);
});

async function castVote(id: string, body: unknown, ip = nextIp()) {
  const res = await vote(
    jsonRequest(`/api/tools/${id}/vote`, { method: "POST", body, ip }),
    withId(id),
  );
  return { res, body: await readJson(res) };
}

describe("vote toggle", () => {
  it("first call votes, second call unvotes", async () => {
    const on = await castVote("tool-a", { voter: VOTER });
    expect(on.res.status).toBe(200);
    expect(on.body).toEqual({ votes: 1, voted: true });

    const off = await castVote("tool-a", { voter: VOTER });
    expect(off.res.status).toBe(200);
    expect(off.body).toEqual({ votes: 0, voted: false });
  });

  it("counts distinct voters and derives votes from Vote rows", async () => {
    await castVote("tool-a", { voter: "voter-token-001" });
    await castVote("tool-a", { voter: "voter-token-002" });
    const { body } = await castVote("tool-b", { voter: "voter-token-003" });
    expect(body).toEqual({ votes: 1, voted: true }); // tool-b is independent

    /* GET single tool derives the same count */
    const res = await getTool(jsonRequest("/api/tools/tool-a"), withId("tool-a"));
    const { tool } = (await readJson(res)) as { tool: { votes: number } };
    expect(tool.votes).toBe(2);
  });

  it("persists to the Vote store (unique tool+voter)", async () => {
    await castVote("tool-a", { voter: VOTER });
    expect(fake.rawVotes).toHaveLength(1);
    expect(fake.rawVotes[0]).toMatchObject({ toolId: "tool-a", voter: VOTER });
    await castVote("tool-a", { voter: VOTER });
    expect(fake.rawVotes).toHaveLength(0);
  });
});

describe("vote validation and errors", () => {
  it("400 on a voter token that is too short (8 char minimum)", async () => {
    const { res, body } = await castVote("tool-a", { voter: "short" });
    expect(res.status).toBe(400);
    expect(body.error).toBe("Validation failed");
    expect(Array.isArray(body.issues)).toBe(true);
  });

  it("400 on a missing or non-object body", async () => {
    expect((await castVote("tool-a", undefined)).res.status).toBe(400);
    expect((await castVote("tool-a", "not-an-object")).res.status).toBe(400);
  });

  it("404 on an unknown tool, without creating a vote", async () => {
    const { res } = await castVote("nope", { voter: VOTER });
    expect(res.status).toBe(404);
    expect(fake.rawVotes).toHaveLength(0);
  });
});

describe("vote rate limiting", () => {
  it("429 after the per-IP toggle budget (120/hr) is exhausted", async () => {
    const ip = nextIp();
    let last: number | undefined;
    for (let i = 0; i < 121; i++) {
      const { res } = await castVote(i % 2 === 0 ? "tool-a" : "tool-b", { voter: VOTER }, ip);
      last = res.status;
      if (i < 120) expect(res.status).toBe(200);
    }
    expect(last).toBe(429);
  });

  it("other IPs keep voting after one IP is throttled", async () => {
    const throttled = nextIp();
    for (let i = 0; i < 120; i++) {
      await castVote("tool-a", { voter: VOTER }, throttled);
    }
    const { res } = await castVote("tool-a", { voter: VOTER }, throttled);
    expect(res.status).toBe(429);

    const fresh = await castVote("tool-b", { voter: VOTER }, nextIp());
    expect(fresh.res.status).toBe(200);
  });
});
