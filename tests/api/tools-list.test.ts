/**
 * GET /api/tools — filtering and sorting contract, run against the real
 * route handler with an in-memory DB fake. Assertions on ordering pin the
 * Postgres semantics (C.UTF-8 byte order; NULLS LAST on momentum) that the
 * client-side fallbacks mirror.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", async () => {
  const { fake } = await import("./fake-db");
  return { db: fake.db };
});

import { GET as listTools } from "@/app/api/tools/route";
import { fake } from "./fake-db";
import { jsonRequest, readJson } from "./helpers";

let ipSeq = 100;
const nextIp = () => `192.0.2.${++ipSeq}`;

async function list(query: string) {
  const res = await listTools(jsonRequest(`/api/tools${query}`, { ip: nextIp() }));
  expect(res.status).toBe(200);
  const body = await readJson(res);
  return {
    ids: (body.tools as { id: string }[]).map((t) => t.id),
    total: body.total as number,
    page: body.page as number,
    limit: body.limit as number,
  };
}

beforeEach(() => {
  fake.reset();
});

describe("filtering", () => {
  beforeEach(() => {
    fake.seedTools([
      { id: "alpha", cat: "coding", stars: 100, selfHosted: true, featured: true, weeklyGain: 500 },
      { id: "beta", cat: "coding", stars: 200, sourceAvailable: true },
      { id: "gamma", cat: "voice", stars: 300, platforms: "web,mac", weeklyGain: 1000 },
      { id: "delta", cat: "voice", stars: 50 },
      { id: "epsilon", cat: "agents", featured: true, weeklyGain: 50 },
    ]);
  });

  it("excludes pending submissions from the public listing", async () => {
    fake.seedTools([{ id: "sneaky", status: "pending" }]);
    const { ids, total } = await list("");
    expect(ids).not.toContain("sneaky");
    expect(total).toBe(5);
  });

  it("filters by category", async () => {
    const { ids, total } = await list("?cat=voice");
    expect(ids.sort()).toEqual(["delta", "gamma"]);
    expect(total).toBe(2);
  });

  it("filters by platform (CSV column)", async () => {
    const { ids } = await list("?platform=mac");
    expect(ids).toEqual(["gamma"]);
  });

  it("filters selfHosted / sourceAvailable / featured", async () => {
    expect((await list("?selfHosted=1")).ids).toEqual(["alpha"]);
    expect((await list("?sourceAvailable=1")).ids).toEqual(["beta"]);
    expect((await list("?featured=1")).ids.sort()).toEqual(["alpha", "epsilon"]);
    /* non-"1" values are ignored, not truthy-coerced */
    expect((await list("?featured=0")).total).toBe(5);
    expect((await list("?selfHosted=true")).total).toBe(5);
  });

  it("filters trending (weeklyGain present)", async () => {
    const { ids } = await list("?trending=1");
    expect(ids.sort()).toEqual(["alpha", "epsilon", "gamma"]);
  });

  it("filters community/curated status without admin (public subsets)", async () => {
    fake.seedTools([
      { id: "comm", status: "community" },
      { id: "kept", status: "curated" },
    ]);
    const community = await list("?status=community");
    expect(community.ids).toEqual(["comm"]);
    const curated = await list("?status=curated");
    expect(curated.ids).toContain("kept");
    expect(curated.ids).not.toContain("comm");
  });

  it("search q matches name, repo, desc, replaces and category labels", async () => {
    expect((await list("?q=alpha")).ids).toEqual(["alpha"]);
    expect((await list("?q=Description")).total).toBe(5); // every seeded row's desc
    expect((await list("?q=Voice")).ids.sort()).toEqual(["delta", "gamma"]); // label match
    expect((await list("?q=nothing-matches")).total).toBe(0);
  });

  it("search is case-insensitive (Prisma contains is not, on Postgres)", async () => {
    /* seeded rows: id 'alpha', desc 'Description for alpha' */
    expect((await list("?q=ALPHA")).ids).toEqual(["alpha"]);
    expect((await list("?q=description for ALPHA")).ids).toEqual(["alpha"]);
  });

  it("combines filters and reports the filtered total", async () => {
    const { ids, total } = await list("?cat=voice&featured=0&selfHosted=0");
    expect(ids).toEqual(["gamma", "delta"]); // delta/gamma: not featured, not selfHosted
    expect(total).toBe(2);
  });
});

describe("sorting", () => {
  beforeEach(() => {
    fake.seedTools([
      { id: "zebra", name: "zebra", stars: 10, weeklyGain: 100, createdAt: new Date("2026-01-03") },
      { id: "n8n", name: "n8n", stars: 30, weeklyGain: 900, createdAt: new Date("2026-01-01") },
      { id: "Apple", name: "Apple", stars: 20, weeklyGain: null, createdAt: new Date("2026-01-04") },
      { id: "mango", name: "mango", stars: 30, weeklyGain: 500, createdAt: new Date("2026-01-02") },
    ]);
  });

  it("newest: createdAt desc (default when sort is absent/unknown)", async () => {
    expect((await list("?sort=newest")).ids).toEqual(["Apple", "zebra", "mango", "n8n"]);
    expect((await list("?sort=bogus")).ids).toEqual((await list("?sort=newest")).ids);
    expect((await list("")).ids).toEqual((await list("?sort=newest")).ids);
  });

  it("stars: descending", async () => {
    expect((await list("?sort=stars")).ids).toEqual(["n8n", "mango", "Apple", "zebra"]);
  });

  it("votes: vote count descending, stars as tiebreak", async () => {
    fake.seedVotes([
      { toolId: "zebra", voter: "v1" },
      { toolId: "zebra", voter: "v2" },
      { toolId: "Apple", voter: "v3" },
    ]);
    /* zebra: 2 votes, Apple: 1, n8n/mango: 0 → tie broken by stars (both 30, stable order) */
    const { ids } = await list("?sort=votes");
    expect(ids.slice(0, 2)).toEqual(["zebra", "Apple"]);
    expect([...ids.slice(2)].sort()).toEqual(["mango", "n8n"]);
  });

  it("name: byte order (lowercase initials sort after uppercase)", async () => {
    /* C.UTF-8 / SQLite-BINARY semantics — the client fallback mirrors this */
    expect((await list("?sort=name")).ids).toEqual(["Apple", "mango", "n8n", "zebra"]);
  });

  it("momentum: weeklyGain desc with NULLs last", async () => {
    /* Postgres defaults to NULLS FIRST on DESC — the route must opt out */
    expect((await list("?sort=momentum")).ids).toEqual(["n8n", "mango", "zebra", "Apple"]);
  });
});

describe("pagination + wire shape", () => {
  beforeEach(() => {
    fake.seedTools(Array.from({ length: 10 }, (_, i) => ({ id: `tool-${i}`, stars: i })));
  });

  it("pages 1-based with the requested limit and correct total", async () => {
    const page1 = await list("?sort=stars&limit=3&page=1");
    expect(page1.ids).toEqual(["tool-9", "tool-8", "tool-7"]);
    expect(page1.total).toBe(10);
    expect(page1.page).toBe(1);
    expect(page1.limit).toBe(3);

    const page2 = await list("?sort=stars&limit=3&page=2");
    expect(page2.ids).toEqual(["tool-6", "tool-5", "tool-4"]);
  });

  it("caps limit at 999 and clamps bad page values", async () => {
    expect((await list("?limit=5000")).limit).toBe(999);
    expect((await list("?page=0")).page).toBe(1);
    expect((await list("?page=abc")).page).toBe(1);
  });

  it("serializes tools to the wire shape (platforms array, ISO date, votes)", async () => {
    fake.reset();
    fake.seedTools([{ id: "wire", platforms: "web,mac", createdAt: new Date("2026-01-01T00:00:00Z") }]);
    fake.seedVotes([{ toolId: "wire", voter: "v1" }]);
    const res = await listTools(jsonRequest("/api/tools", { ip: nextIp() }));
    const { tools } = (await readJson(res)) as { tools: Record<string, unknown>[] };
    expect(tools[0].platforms).toEqual(["web", "mac"]);
    expect(tools[0].createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(tools[0].votes).toBe(1);
  });
});
