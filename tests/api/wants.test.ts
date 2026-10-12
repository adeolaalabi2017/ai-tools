/**
 * Wanted-alternatives board: request → dedupe-as-vote → toggle votes →
 * admin status/connected management. Vote totals = baseVotes (editorial
 * seeds) + real WantVote rows.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", async () => {
  const { fake } = await import("./fake-db");
  return { db: fake.db };
});

import { GET as listWants, POST as createWant } from "@/app/api/wants/route";
import { DELETE as deleteWant, PATCH as updateWant } from "@/app/api/wants/[id]/route";
import { POST as voteWant } from "@/app/api/wants/[id]/vote/route";
import { fake } from "./fake-db";
import { jsonRequest, readJson, withId } from "./helpers";

const TOKEN = "test-admin-token-1234567890";

let ipSeq = 80;
const nextIp = () => `198.51.100.${++ipSeq}`;

beforeEach(() => {
  process.env.ADMIN_TOKEN = TOKEN;
  fake.reset();
  fake.seedWants([
    { id: "notion", target: "Notion", status: "fulfilled", baseVotes: 10, dupes: 2 },
    { id: "zapier", target: "Zapier", status: "open", baseVotes: 3 },
    { id: "midjourney", target: "Midjourney", status: "progress", baseVotes: 50, createdAt: new Date("2026-01-01") },
  ]);
  fake.seedWantVotes([
    { wantId: "notion", voter: "existing-voter-1" },
    { wantId: "zapier", voter: "existing-voter-2" },
  ]);
});

describe("GET /api/wants", () => {
  it("votes = baseVotes + real WantVote rows, sorted by votes desc", async () => {
    const res = await listWants(jsonRequest("/api/wants", { ip: nextIp() }));
    expect(res.status).toBe(200);
    const body = (await readJson(res)) as { wants: { id: string; votes: number }[] };
    /* midjourney 50+0, notion 10+1, zapier 3+1 */
    expect(body.wants.map((w) => [w.id, w.votes])).toEqual([
      ["midjourney", 50],
      ["notion", 11],
      ["zapier", 4],
    ]);
  });

  it("sort=newest orders by creation", async () => {
    const res = await listWants(jsonRequest("/api/wants?sort=newest", { ip: nextIp() }));
    const body = (await readJson(res)) as { wants: { id: string }[] };
    expect(body.wants.map((w) => w.id)).toEqual(["notion", "zapier", "midjourney"]);
  });
});

describe("POST /api/wants (request board)", () => {
  it("new request: 201, auto-vote from the requester, slug id from target", async () => {
    const res = await createWant(
      jsonRequest("/api/wants", {
        method: "POST",
        body: { target: "Arc Browser", note: "Vertical tabs please.", voter: "voter-token-001" },
        ip: nextIp(),
      }),
    );
    expect(res.status).toBe(201);
    const body = (await readJson(res)) as { want: { id: string; votes: number; status: string }; deduped: boolean };
    expect(body.deduped).toBe(false);
    expect(body.want.id).toBe("arcbrowser");
    expect(body.want).toMatchObject({ votes: 1, status: "open" });
  });

  it("duplicate request becomes a vote for the original (+dupes)", async () => {
    const ip = nextIp();
    const mk = (target: string, voter: string) =>
      createWant(
        jsonRequest("/api/wants", { method: "POST", body: { target, voter }, ip }),
      );

    await mk("Arc Browser", "voter-token-001");
    const dup = await mk("arc browser", "voter-token-002"); // same normalized id
    expect(dup.status).toBe(200);
    const body = (await readJson(dup)) as { want: { id: string; votes: number; dupes: number }; deduped: boolean };
    expect(body.deduped).toBe(true);
    expect(body.want).toMatchObject({ id: "arcbrowser", votes: 2, dupes: 1 });

    /* the same voter requesting again is idempotent — no double vote */
    const again = await mk("ARC BROWSER", "voter-token-002");
    const againBody = (await readJson(again)) as { want: { votes: number; dupes: number } };
    expect(againBody.want).toMatchObject({ votes: 2, dupes: 1 });
  });

  it("400 on invalid bodies (short target, short voter)", async () => {
    const badTarget = await createWant(
      jsonRequest("/api/wants", { method: "POST", body: { target: "x", voter: "voter-token-001" }, ip: nextIp() }),
    );
    expect(badTarget.status).toBe(400);

    const badVoter = await createWant(
      jsonRequest("/api/wants", { method: "POST", body: { target: "Sketch", voter: "short" }, ip: nextIp() }),
    );
    expect(badVoter.status).toBe(400);
  });

  it("submissions are rate limited (10/hr per IP)", async () => {
    const ip = nextIp();
    let last: number | undefined;
    for (let i = 0; i < 11; i++) {
      const res = await createWant(
        jsonRequest("/api/wants", { method: "POST", body: { target: `Tool ${i}`, voter: "voter-token-001" }, ip }),
      );
      last = res.status;
      if (i < 10) expect(res.status).toBe(201);
    }
    expect(last).toBe(429);
  });
});

describe("POST /api/wants/[id]/vote (toggle)", () => {
  it("toggles and reports total votes", async () => {
    const on = await voteWant(
      jsonRequest("/api/wants/notion/vote", {
        method: "POST",
        body: { voter: "voter-token-003" },
        ip: nextIp(),
      }),
      withId("notion"),
    );
    expect(on.status).toBe(200);
    expect((await readJson(on))).toMatchObject({ votes: 12, voted: true }); // 10 base + 2 existing + 1

    const off = await voteWant(
      jsonRequest("/api/wants/notion/vote", {
        method: "POST",
        body: { voter: "voter-token-003" },
        ip: nextIp(),
      }),
      withId("notion"),
    );
    expect((await readJson(off))).toMatchObject({ votes: 11, voted: false });
  });

  it("400 on short voter; 404 on unknown want", async () => {
    const bad = await voteWant(
      jsonRequest("/api/wants/notion/vote", { method: "POST", body: { voter: "short" }, ip: nextIp() }),
      withId("notion"),
    );
    expect(bad.status).toBe(400);

    const missing = await voteWant(
      jsonRequest("/api/wants/ghost/vote", { method: "POST", body: { voter: "voter-token-001" }, ip: nextIp() }),
      withId("ghost"),
    );
    expect(missing.status).toBe(404);
  });
});

describe("PATCH/DELETE /api/wants/[id] (admin)", () => {
  it("PATCH sets status and connects only known tool ids", async () => {
    fake.seedTools([{ id: "open-webui" }, { id: "librechat" }]);

    const anon = await updateWant(
      jsonRequest("/api/wants/notion", { method: "PATCH", body: { status: "progress" }, ip: nextIp() }),
      withId("notion"),
    );
    expect(anon.status).toBe(401);

    const res = await updateWant(
      jsonRequest("/api/wants/notion", {
        method: "PATCH",
        body: { status: "fulfilled", connected: ["open-webui", "ghost-tool", "librechat"] },
        token: TOKEN,
        ip: nextIp(),
      }),
      withId("notion"),
    );
    expect(res.status).toBe(200);
    const { want } = (await readJson(res)) as { want: { status: string; connected: string[] } };
    expect(want.status).toBe("fulfilled");
    /* unknown ids dropped, given order preserved */
    expect(want.connected).toEqual(["open-webui", "librechat"]);
  });

  it("DELETE removes the want and its votes; 401 anonymously", async () => {
    const anon = await deleteWant(
      jsonRequest("/api/wants/notion", { method: "DELETE", ip: nextIp() }),
      withId("notion"),
    );
    expect(anon.status).toBe(401);

    const res = await deleteWant(
      jsonRequest("/api/wants/notion", { method: "DELETE", token: TOKEN, ip: nextIp() }),
      withId("notion"),
    );
    expect(res.status).toBe(200);
    expect(fake.rawWants.map((w) => w.id)).not.toContain("notion");
    expect(fake.rawWantVotes.some((v) => v.wantId === "notion")).toBe(false); // cascade
  });

  it("404 on unknown want", async () => {
    const res = await updateWant(
      jsonRequest("/api/wants/ghost", { method: "PATCH", body: { status: "open" }, token: TOKEN, ip: nextIp() }),
      withId("ghost"),
    );
    expect(res.status).toBe(404);
  });
});
