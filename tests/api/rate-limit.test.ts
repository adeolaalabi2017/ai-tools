/**
 * Rate limiting (src/lib/aitools/rate-limit.ts) — sliding-window counters
 * kept in the store so throttling and admin lockouts survive restarts.
 * The store is the fake DB; module state is reset where a test needs to
 * simulate a process restart.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", async () => {
  const { fake } = await import("./fake-db");
  return { db: fake.db };
});

import {
  clientIp,
  clearFailures,
  enforceRateLimit,
  rateLimitExceeded,
  recordFailure,
  type RatePolicy,
} from "@/lib/aitools/rate-limit";
import { fake } from "./fake-db";

function req(ip: string): Request {
  return new Request("http://localhost/api/test", {
    headers: { "x-forwarded-for": ip },
  });
}

let ipSeq = 200;
const nextIp = () => `198.51.100.${++ipSeq}`;

beforeEach(() => {
  fake.reset();
});

afterEach(() => {
  vi.resetModules();
});

describe("clientIp", () => {
  it("prefers the first X-Forwarded-For hop (set by the proxy)", () => {
    const r = new Request("http://localhost/", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    expect(clientIp(r)).toBe("1.2.3.4");
  });

  it("falls back to X-Real-IP, then to a shared local bucket", () => {
    const real = new Request("http://localhost/", { headers: { "x-real-ip": "9.9.9.9" } });
    expect(clientIp(real)).toBe("9.9.9.9");
    expect(clientIp(new Request("http://localhost/"))).toBe("local");
  });
});

describe("enforceRateLimit", () => {
  it("allows exactly `limit` requests, then returns 429 + Retry-After", async () => {
    const policy: RatePolicy = { limit: 3, windowMs: 60_000 };
    const ip = nextIp();
    for (let i = 0; i < 3; i++) {
      expect(await enforceRateLimit("t-allow", req(ip), policy)).toBeNull();
    }
    const denied = (await enforceRateLimit("t-allow", req(ip), policy))!;
    expect(denied.status).toBe(429);
    const retryAfter = Number(denied.headers.get("retry-after"));
    expect(retryAfter).toBeGreaterThanOrEqual(1);
    expect(retryAfter).toBeLessThanOrEqual(60);
  });

  it("keeps buckets separate per IP", async () => {
    const policy: RatePolicy = { limit: 1, windowMs: 60_000 };
    expect(await enforceRateLimit("t-ip", req(nextIp()), policy)).toBeNull();
    expect(await enforceRateLimit("t-ip", req(nextIp()), policy)).toBeNull();
  });

  it("keeps buckets separate per surface (bucket name)", async () => {
    const policy: RatePolicy = { limit: 1, windowMs: 60_000 };
    const ip = nextIp();
    expect(await enforceRateLimit("t-surf-a", req(ip), policy)).toBeNull();
    expect(await enforceRateLimit("t-surf-b", req(ip), policy)).toBeNull();
    expect((await enforceRateLimit("t-surf-a", req(ip), policy))?.status).toBe(429);
  });

  it("expires hits outside the window", async () => {
    const policy: RatePolicy = { limit: 2, windowMs: 60_000 };
    const ip = nextIp();
    await enforceRateLimit("t-window", req(ip), policy);
    await enforceRateLimit("t-window", req(ip), policy);
    expect((await enforceRateLimit("t-window", req(ip), policy))?.status).toBe(429);

    /* backdate both hits beyond the window → the caller has room again */
    const old = new Date(Date.now() - 2 * policy.windowMs);
    for (const ev of fake.rawRateEvents) ev.createdAt = old;
    expect(await enforceRateLimit("t-window", req(ip), policy)).toBeNull();
  });
});

describe("survives restarts (counters live in the store)", () => {
  it("a reloaded module still sees the recorded failures", async () => {
    const policy: RatePolicy = { limit: 2, windowMs: 60_000 };
    const ip = nextIp();
    await recordFailure("t-restart", req(ip));
    await recordFailure("t-restart", req(ip));

    /* simulate a process restart: fresh module state, same store */
    vi.resetModules();
    const fresh = await import("@/lib/aitools/rate-limit");

    const denied = (await fresh.rateLimitExceeded("t-restart", req(ip), policy))!;
    expect(denied.status).toBe(429);
  });
});

describe("check-only + explicit recording (admin sign-in style)", () => {
  it("rateLimitExceeded never records by itself", async () => {
    const policy: RatePolicy = { limit: 2, windowMs: 60_000 };
    const ip = nextIp();
    expect(await rateLimitExceeded("t-check", req(ip), policy)).toBeNull();
    expect(await rateLimitExceeded("t-check", req(ip), policy)).toBeNull();
    /* still not over the limit: nothing was recorded */
    expect(await rateLimitExceeded("t-check", req(ip), policy)).toBeNull();
  });

  it("recordFailure accumulates until the limit trips", async () => {
    const policy: RatePolicy = { limit: 2, windowMs: 60_000 };
    const ip = nextIp();
    await recordFailure("t-rec", req(ip));
    await recordFailure("t-rec", req(ip));
    const denied = (await rateLimitExceeded("t-rec", req(ip), policy))!;
    expect(denied.status).toBe(429);
  });

  it("clearFailures resets one caller without touching others", async () => {
    const policy: RatePolicy = { limit: 1, windowMs: 60_000 };
    const ip = nextIp();
    const other = nextIp();
    await recordFailure("t-clear", req(ip));
    await recordFailure("t-clear", req(other));
    await clearFailures("t-clear", req(ip));
    expect(await rateLimitExceeded("t-clear", req(ip), policy)).toBeNull();
    expect((await rateLimitExceeded("t-clear", req(other), policy))?.status).toBe(429);
  });
});

describe("store failure fails closed", () => {
  it("refuses the request (429) when the counter store is down", async () => {
    const policy: RatePolicy = { limit: 5, windowMs: 60_000 };
    vi.spyOn(fake.db.rateEvent, "count").mockRejectedValueOnce(new Error("db down"));
    const res = await enforceRateLimit("t-down", req(nextIp()), policy);
    expect(res?.status).toBe(429);
    vi.restoreAllMocks();
  });

  it("recordFailure/clearFailures swallow store errors (never throw)", async () => {
    vi.spyOn(fake.db.rateEvent, "create").mockRejectedValueOnce(new Error("db down"));
    vi.spyOn(fake.db.rateEvent, "deleteMany").mockRejectedValueOnce(new Error("db down"));
    await expect(recordFailure("t-swallow", req(nextIp()))).resolves.toBeUndefined();
    await expect(clearFailures("t-swallow", req(nextIp()))).resolves.toBeUndefined();
    vi.restoreAllMocks();
  });
});
