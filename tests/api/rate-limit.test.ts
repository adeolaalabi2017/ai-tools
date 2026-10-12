/**
 * In-memory sliding-window rate limiter (src/lib/aitools/rate-limit.ts).
 * Policy windows are shortened per test via custom RatePolicy values —
 * no fake timers needed, just distinct IPs.
 */

import { describe, expect, it } from "vitest";
import {
  clientIp,
  clearFailures,
  enforceRateLimit,
  rateLimitExceeded,
  recordFailure,
  type RatePolicy,
} from "@/lib/aitools/rate-limit";

function req(ip: string): Request {
  return new Request("http://localhost/api/test", {
    headers: { "x-forwarded-for": ip },
  });
}

let ipSeq = 200;
const nextIp = () => `198.51.100.${++ipSeq}`;

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
  it("allows exactly `limit` requests, then returns 429 + Retry-After", () => {
    const policy: RatePolicy = { limit: 3, windowMs: 60_000 };
    const ip = nextIp();
    for (let i = 0; i < 3; i++) {
      expect(enforceRateLimit("t-allow", req(ip), policy)).toBeNull();
    }
    const denied = enforceRateLimit("t-allow", req(ip), policy)!;
    expect(denied.status).toBe(429);
    const retryAfter = Number(denied.headers.get("retry-after"));
    expect(retryAfter).toBeGreaterThanOrEqual(1);
    expect(retryAfter).toBeLessThanOrEqual(60);
  });

  it("keeps buckets separate per IP", () => {
    const policy: RatePolicy = { limit: 1, windowMs: 60_000 };
    expect(enforceRateLimit("t-ip", req(nextIp()), policy)).toBeNull();
    expect(enforceRateLimit("t-ip", req(nextIp()), policy)).toBeNull();
  });

  it("keeps buckets separate per surface (bucket name)", () => {
    const policy: RatePolicy = { limit: 1, windowMs: 60_000 };
    const ip = nextIp();
    expect(enforceRateLimit("t-surf-a", req(ip), policy)).toBeNull();
    expect(enforceRateLimit("t-surf-b", req(ip), policy)).toBeNull();
    expect(enforceRateLimit("t-surf-a", req(ip), policy)?.status).toBe(429);
  });
});

describe("check-only + explicit recording (admin sign-in style)", () => {
  it("rateLimitExceeded never records by itself", () => {
    const policy: RatePolicy = { limit: 2, windowMs: 60_000 };
    const ip = nextIp();
    expect(rateLimitExceeded("t-check", req(ip), policy)).toBeNull();
    expect(rateLimitExceeded("t-check", req(ip), policy)).toBeNull();
    /* still not over the limit: nothing was recorded */
    expect(rateLimitExceeded("t-check", req(ip), policy)).toBeNull();
  });

  it("recordFailure accumulates until the limit trips", () => {
    const policy: RatePolicy = { limit: 2, windowMs: 60_000 };
    const ip = nextIp();
    recordFailure("t-rec", req(ip), policy);
    recordFailure("t-rec", req(ip), policy);
    const denied = rateLimitExceeded("t-rec", req(ip), policy)!;
    expect(denied.status).toBe(429);
  });

  it("clearFailures resets one caller without touching others", () => {
    const policy: RatePolicy = { limit: 1, windowMs: 60_000 };
    const ip = nextIp();
    const other = nextIp();
    recordFailure("t-clear", req(ip), policy);
    recordFailure("t-clear", req(other), policy);
    clearFailures("t-clear", req(ip));
    expect(rateLimitExceeded("t-clear", req(ip), policy)).toBeNull();
    expect(rateLimitExceeded("t-clear", req(other), policy)?.status).toBe(429);
  });
});
