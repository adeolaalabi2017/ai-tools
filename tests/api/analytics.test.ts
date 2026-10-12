/**
 * Analytics: the public POST beacon vs the admin-only GET summary.
 * The summary buckets by UTC day — tests pin the window, clamping and
 * unique-visitor math.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", async () => {
  const { fake } = await import("./fake-db");
  return { db: fake.db };
});

import { GET as analyticsSummary, POST as beacon } from "@/app/api/analytics/route";
import { fake } from "./fake-db";
import { jsonRequest, readJson } from "./helpers";

const TOKEN = "test-admin-token-1234567890";

let ipSeq = 120;
const nextIp = () => `203.0.113.${++ipSeq}`;

function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

beforeEach(() => {
  process.env.ADMIN_TOKEN = TOKEN;
  fake.reset();
});

describe("POST /api/analytics (page-view beacon)", () => {
  it("records an anonymous page view — public, no token", async () => {
    const res = await beacon(
      jsonRequest("/api/analytics", {
        method: "POST",
        body: { path: "discover", session: "abcdef123456" },
        ip: nextIp(),
      }),
    );
    expect(res.status).toBe(200);
    expect(fake.rawPageViews).toHaveLength(1);
    expect(fake.rawPageViews[0]).toMatchObject({ path: "discover", session: "abcdef123456" });
  });

  it("400 on invalid bodies (short session, long path)", async () => {
    const badSession = await beacon(
      jsonRequest("/api/analytics", {
        method: "POST",
        body: { path: "discover", session: "short" },
        ip: nextIp(),
      }),
    );
    expect(badSession.status).toBe(400);

    const badPath = await beacon(
      jsonRequest("/api/analytics", {
        method: "POST",
        body: { path: "x".repeat(41), session: "abcdef123456" },
        ip: nextIp(),
      }),
    );
    expect(badPath.status).toBe(400);
  });
});

describe("GET /api/analytics (admin summary)", () => {
  it("401 anonymously — traffic data is moderator-only", async () => {
    const res = await analyticsSummary(jsonRequest("/api/analytics", { ip: nextIp() }));
    expect(res.status).toBe(401);
  });

  it("buckets by UTC day with per-day views and unique visitors", async () => {
    fake.seedPageViews([
      { path: "discover", session: "sess-aaaaaa", createdAt: daysAgo(0) },
      { path: "discover", session: "sess-aaaaaa", createdAt: daysAgo(0) }, // same visitor, 2 views
      { path: "browse", session: "sess-bbbbbb", createdAt: daysAgo(1) },
      { path: "old", session: "sess-cccccc", createdAt: daysAgo(30) }, // outside a 14-day window
    ]);

    const res = await analyticsSummary(jsonRequest("/api/analytics?days=14", { token: TOKEN, ip: nextIp() }));
    expect(res.status).toBe(200);
    const body = (await readJson(res)) as {
      series: { date: string; views: number; visitors: number }[];
      totalViews: number;
      uniqueVisitors: number;
      topPages: { path: string; views: number }[];
    };

    expect(body.series).toHaveLength(14);
    expect(body.totalViews).toBe(3); // the 30-day-old row is outside the window
    expect(body.uniqueVisitors).toBe(2); // sess-aaaaaa counted once

    const today = body.series[13];
    const yesterday = body.series[12];
    expect(today).toMatchObject({ views: 2, visitors: 1 });
    expect(yesterday).toMatchObject({ views: 1, visitors: 1 });

    /* top pages ranked by views, outside-window row excluded */
    expect(body.topPages).toEqual([
      { path: "discover", views: 2 },
      { path: "browse", views: 1 },
    ]);
  });

  it("days defaults to 14 and clamps to 90", async () => {
    const byDefault = (await readJson(
      await analyticsSummary(jsonRequest("/api/analytics", { token: TOKEN, ip: nextIp() })),
    )) as { series: unknown[] };
    expect(byDefault.series).toHaveLength(14);

    const clamped = (await readJson(
      await analyticsSummary(jsonRequest("/api/analytics?days=999", { token: TOKEN, ip: nextIp() })),
    )) as { series: unknown[] };
    expect(clamped.series).toHaveLength(90);

    const garbage = (await readJson(
      await analyticsSummary(jsonRequest("/api/analytics?days=abc", { token: TOKEN, ip: nextIp() })),
    )) as { series: unknown[] };
    expect(garbage.series).toHaveLength(14);
  });
});
