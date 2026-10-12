/**
 * Submit → moderate lifecycle, end to end through the real handlers:
 * POST /api/tools (public submit) → pending row hidden from public reads →
 * admin approve → community row in the listing → reject deletes (curated
 * protected). Also covers the slug/id and duplicate-repo rules.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", async () => {
  const { fake } = await import("./fake-db");
  return { db: fake.db };
});

import { POST as submit } from "@/app/api/tools/route";
import { GET as listTools } from "@/app/api/tools/route";
import { GET as getTool, PATCH as patchTool } from "@/app/api/tools/[id]/route";
import { POST as moderate } from "@/app/api/tools/[id]/moderate/route";
import { POST as feature } from "@/app/api/tools/[id]/feature/route";
import { fake } from "./fake-db";
import { jsonRequest, readJson, withId } from "./helpers";

const TOKEN = "test-admin-token-1234567890";

let ipSeq = 20;
const nextIp = () => `203.0.113.${++ipSeq}`;

const VALID = {
  name: "Night Scribe",
  repo: "nightowl/night-scribe",
  desc: "A quiet writing companion for long sessions.",
  replaces: "Google Docs",
  cat: "writing",
  platforms: ["web", "mac"],
  submitter: "QA Bot",
};

beforeEach(() => {
  process.env.ADMIN_TOKEN = TOKEN;
  fake.reset();
  fake.seedTools([{ id: "opencode", name: "OpenCode", status: "curated" }]);
});

function submitReq(body: unknown, ip = nextIp()) {
  return jsonRequest("/api/tools", { method: "POST", body, ip });
}

describe("submission validation", () => {
  it("400 on invalid payloads with zod issues", async () => {
    const res = await submit(submitReq({ name: "x", repo: "bad", desc: "short" }));
    expect(res.status).toBe(400);
    const body = await readJson(res);
    expect(body.error).toBe("Validation failed");
    expect((body.issues as unknown[]).length).toBeGreaterThan(0);
  });

  it("409 on a duplicate repo, case-insensitively", async () => {
    await submit(submitReq(VALID, nextIp()));
    const dup = await submit(submitReq({ ...VALID, repo: "NightOwl/Night-Scribe" }, nextIp()));
    expect(dup.status).toBe(409);
  });
});

describe("submit → pending → approve", () => {
  it("happy path: pending row is hidden publicly, then approved into the listing", async () => {
    const created = await submit(submitReq(VALID));
    expect(created.status).toBe(201);
    const { tool } = (await readJson(created)) as { tool: { id: string; status: string; votes: number } };
    expect(tool.status).toBe("pending");
    expect(tool.id).toBe("night-scribe");
    expect(tool.votes).toBe(0);

    /* hidden from the public listing and from public single reads */
    const pubList = await listTools(jsonRequest("/api/tools", { ip: nextIp() }));
    const pubBody = (await readJson(pubList)) as { tools: { id: string }[] };
    expect(pubBody.tools.map((t) => t.id)).not.toContain("night-scribe");
    expect((await getTool(jsonRequest("/api/tools/night-scribe", { ip: nextIp() }), withId("night-scribe"))).status).toBe(404);

    /* ...but visible to a moderator */
    const queue = await listTools(
      jsonRequest("/api/tools?status=pending", { token: TOKEN, ip: nextIp() }),
    );
    const queueBody = (await readJson(queue)) as { tools: { id: string }[] };
    expect(queueBody.tools.map((t) => t.id)).toEqual(["night-scribe"]);
    expect(
      (
        await getTool(jsonRequest("/api/tools/night-scribe", { token: TOKEN, ip: nextIp() }), withId("night-scribe"))
      ).status,
    ).toBe(200);

    /* approve flips it to community and publishes it */
    const approved = await moderate(
      jsonRequest("/api/tools/night-scribe/moderate", {
        method: "POST",
        body: { action: "approve" },
        token: TOKEN,
        ip: nextIp(),
      }),
      withId("night-scribe"),
    );
    expect(approved.status).toBe(200);
    const approvedBody = (await readJson(approved)) as { tool: { status: string } };
    expect(approvedBody.tool.status).toBe("community");

    const after = await listTools(jsonRequest("/api/tools", { ip: nextIp() }));
    const afterBody = (await readJson(after)) as { tools: { id: string }[]; total: number };
    expect(afterBody.tools.map((t) => t.id)).toContain("night-scribe");
    expect(afterBody.total).toBe(2);
  });

  it("approve with featured sets the badge at approval time", async () => {
    await submit(submitReq(VALID));
    const res = await moderate(
      jsonRequest("/api/tools/night-scribe/moderate", {
        method: "POST",
        body: { action: "approve", featured: true },
        token: TOKEN,
        ip: nextIp(),
      }),
      withId("night-scribe"),
    );
    expect(res.status).toBe(200);
    const { tool } = (await readJson(res)) as { tool: { status: string; featured: boolean } };
    expect(tool).toMatchObject({ status: "community", featured: true });

    /* and it shows up in the featured filter */
    const feat = await listTools(jsonRequest("/api/tools?featured=1", { ip: nextIp() }));
    const featBody = (await readJson(feat)) as { tools: { id: string }[] };
    expect(featBody.tools.map((t) => t.id)).toEqual(["night-scribe"]);
  });

  it("idempotent re-approval of a community row leaves status alone", async () => {
    await submit(submitReq(VALID));
    const approve = (body: unknown) =>
      moderate(
        jsonRequest("/api/tools/night-scribe/moderate", {
          method: "POST",
          body,
          token: TOKEN,
          ip: nextIp(),
        }),
        withId("night-scribe"),
      );
    await approve({ action: "approve" });
    const again = await approve({ action: "approve" });
    expect(again.status).toBe(200);
    expect(((await readJson(again)) as { tool: { status: string } }).tool.status).toBe("community");
  });
});

describe("submit → reject", () => {
  it("reject deletes the pending row (then 404)", async () => {
    await submit(submitReq(VALID));
    const rejected = await moderate(
      jsonRequest("/api/tools/night-scribe/moderate", {
        method: "POST",
        body: { action: "reject" },
        token: TOKEN,
        ip: nextIp(),
      }),
      withId("night-scribe"),
    );
    expect(rejected.status).toBe(200);
    expect((await readJson(rejected)).deleted).toBe(true);
    expect(
      (await getTool(jsonRequest("/api/tools/night-scribe", { token: TOKEN, ip: nextIp() }), withId("night-scribe")))
        .status,
    ).toBe(404);
  });

  it("curated rows cannot be rejected", async () => {
    const res = await moderate(
      jsonRequest("/api/tools/opencode/moderate", {
        method: "POST",
        body: { action: "reject" },
        token: TOKEN,
        ip: nextIp(),
      }),
      withId("opencode"),
    );
    expect(res.status).toBe(400);
    expect((await readJson(res)).error).toMatch(/Curated/);
    expect(fake.rawTools.map((t) => t.id)).toContain("opencode");
  });

  it("400 on unknown action, 404 on unknown tool", async () => {
    const bad = await moderate(
      jsonRequest("/api/tools/night-scribe/moderate", {
        method: "POST",
        body: { action: "maybe" },
        token: TOKEN,
        ip: nextIp(),
      }),
      withId("night-scribe"),
    );
    expect(bad.status).toBe(400);

    const missing = await moderate(
      jsonRequest("/api/tools/ghost/moderate", {
        method: "POST",
        body: { action: "approve" },
        token: TOKEN,
        ip: nextIp(),
      }),
      withId("ghost"),
    );
    expect(missing.status).toBe(404);
  });
});

describe("slug generation", () => {
  it("slugifies the name and appends -2/-3 on collision", async () => {
    const mk = (repo: string) =>
      submit(submitReq({ ...VALID, name: "Night Scribe", repo }, nextIp()));
    const first = await mk("owner-one/night-scribe");
    const second = await mk("owner-two/night-scribe");
    const third = await mk("owner-three/night-scribe");
    expect(((await readJson(first)) as { tool: { id: string } }).tool.id).toBe("night-scribe");
    expect(((await readJson(second)) as { tool: { id: string } }).tool.id).toBe("night-scribe-2");
    expect(((await readJson(third)) as { tool: { id: string } }).tool.id).toBe("night-scribe-3");
  });
});

describe("feature toggle (admin)", () => {
  it("401 without a token; 400 on pending rows; toggles approved rows", async () => {
    await submit(submitReq(VALID));

    /* pending: rejected before the toggle */
    const pending = await feature(
      jsonRequest("/api/tools/night-scribe/feature", {
        method: "POST",
        body: { featured: true },
        ip: nextIp(),
      }),
      withId("night-scribe"),
    );
    expect(pending.status).toBe(401); // no token at all

    const pendingAuthed = await feature(
      jsonRequest("/api/tools/night-scribe/feature", {
        method: "POST",
        body: { featured: true },
        token: TOKEN,
        ip: nextIp(),
      }),
      withId("night-scribe"),
    );
    expect(pendingAuthed.status).toBe(400);

    /* approve first, then toggle */
    await moderate(
      jsonRequest("/api/tools/night-scribe/moderate", {
        method: "POST",
        body: { action: "approve" },
        token: TOKEN,
        ip: nextIp(),
      }),
      withId("night-scribe"),
    );
    const on = await feature(
      jsonRequest("/api/tools/night-scribe/feature", {
        method: "POST",
        body: { featured: true },
        token: TOKEN,
        ip: nextIp(),
      }),
      withId("night-scribe"),
    );
    expect(((await readJson(on)) as { tool: { featured: boolean } }).tool.featured).toBe(true);

    const off = await feature(
      jsonRequest("/api/tools/night-scribe/feature", {
        method: "POST",
        body: { featured: false },
        token: TOKEN,
        ip: nextIp(),
      }),
      withId("night-scribe"),
    );
    expect(((await readJson(off)) as { tool: { featured: boolean } }).tool.featured).toBe(false);
  });
});

describe("PATCH /api/tools/[id] (catalog edit, admin)", () => {
  it("401 anonymously; edits metadata with a token; never mutates name/repo", async () => {
    const anon = await patchTool(
      jsonRequest("/api/tools/opencode", { method: "PATCH", body: { desc: "New description text." }, ip: nextIp() }),
      withId("opencode"),
    );
    expect(anon.status).toBe(401);

    const res = await patchTool(
      jsonRequest("/api/tools/opencode", {
        method: "PATCH",
        body: { desc: "New description text.", selfHosted: true },
        token: TOKEN,
        ip: nextIp(),
      }),
      withId("opencode"),
    );
    expect(res.status).toBe(200);
    const { tool } = (await readJson(res)) as {
      tool: { desc: string; selfHosted: boolean; name: string; repo: string };
    };
    expect(tool.desc).toBe("New description text.");
    expect(tool.selfHosted).toBe(true);
    expect(tool.name).toBe("OpenCode"); // immutable in the schema
    expect(tool.repo).toBe("owner/opencode");
  });
});

describe("submission rate limiting", () => {
  it("429 after 10 submissions per hour per IP — even invalid bodies count", async () => {
    const ip = nextIp();
    let last: number | undefined;
    for (let i = 0; i < 11; i++) {
      const res = await submit(
        jsonRequest("/api/tools", { method: "POST", body: { name: "x" }, ip }),
      );
      last = res.status;
      if (i < 10) expect(res.status).toBe(400); // validation, but still counted
    }
    expect(last).toBe(429);
  });
});
