/**
 * Admin auth gate: the requireAdmin()/isAdminAuthorized() contract every
 * moderator endpoint relies on. Uses the real server helpers against real
 * NextRequest objects — only the DB is faked.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", async () => {
  const { fake } = await import("./fake-db");
  return { db: fake.db };
});

import { GET as authCheck } from "@/app/api/auth/admin/route";
import { POST as moderate } from "@/app/api/tools/[id]/moderate/route";
import { GET as listTools } from "@/app/api/tools/route";
import { isAdminAuthorized, requireAdmin } from "@/lib/aitools/server";
import { jsonRequest, readJson, withId } from "./helpers";

const TOKEN = "test-admin-token-1234567890";

/** Unique IP per test: the limiter's buckets are module-level state. */
let ipSeq = 0;
const nextIp = () => `203.0.113.${++ipSeq}`;

beforeEach(() => {
  process.env.ADMIN_TOKEN = TOKEN;
});

afterEach(() => {
  delete process.env.ADMIN_TOKEN;
});

describe("isAdminAuthorized", () => {
  it("accepts a correct Bearer token", () => {
    const req = jsonRequest("/api/auth/admin", { token: TOKEN });
    expect(isAdminAuthorized(req)).toBe(true);
  });

  it("rejects a wrong token", () => {
    const req = jsonRequest("/api/auth/admin", { token: "nope" });
    expect(isAdminAuthorized(req)).toBe(false);
  });

  it("rejects a missing or malformed Authorization header", () => {
    expect(isAdminAuthorized(jsonRequest("/api/auth/admin"))).toBe(false);
    const basic = jsonRequest("/api/auth/admin");
    basic.headers.set("authorization", `Basic ${TOKEN}`);
    expect(isAdminAuthorized(basic)).toBe(false);
    const bare = jsonRequest("/api/auth/admin");
    bare.headers.set("authorization", TOKEN); // no "Bearer " prefix
    expect(isAdminAuthorized(bare)).toBe(false);
  });

  it("fails closed when ADMIN_TOKEN is not configured", async () => {
    delete process.env.ADMIN_TOKEN;
    const req = jsonRequest("/api/auth/admin", { token: TOKEN });
    expect(isAdminAuthorized(req)).toBe(false);
    expect((await requireAdmin(req))?.status).toBe(503);
  });
});

describe("requireAdmin response contract", () => {
  it("returns null when authorized", async () => {
    expect(await requireAdmin(jsonRequest("/x", { token: TOKEN }))).toBeNull();
  });

  it("returns 401 with a JSON error when not authorized", async () => {
    const res = (await requireAdmin(jsonRequest("/x", { token: "wrong" })))!;
    expect(res.status).toBe(401);
    expect((await readJson(res)).error).toBeTruthy();
  });

  it("returns 503 (not 401) when the server has no token configured", async () => {
    delete process.env.ADMIN_TOKEN;
    const res = (await requireAdmin(jsonRequest("/x")))!;
    expect(res.status).toBe(503);
  });
});

describe("GET /api/auth/admin (login check)", () => {
  it("200 with the right token", async () => {
    const res = await authCheck(jsonRequest("/api/auth/admin", { token: TOKEN, ip: nextIp() }));
    expect(res.status).toBe(200);
    expect((await readJson(res)).ok).toBe(true);
  });

  it("401 with a wrong token", async () => {
    const res = await authCheck(jsonRequest("/api/auth/admin", { token: "wrong", ip: nextIp() }));
    expect(res.status).toBe(401);
  });
});

describe("moderator endpoints reject anonymous callers", () => {
  it("POST /api/tools/[id]/moderate → 401", async () => {
    const res = await moderate(
      jsonRequest("/api/tools/x/moderate", { method: "POST", body: { action: "approve" }, ip: nextIp() }),
      withId("x"),
    );
    expect(res.status).toBe(401);
  });

  it("GET /api/tools?status=pending → 401 (moderation queue)", async () => {
    const res = await listTools(jsonRequest("/api/tools?status=pending", { ip: nextIp() }));
    expect(res.status).toBe(401);
  });

  it("status=community/curated stay public", async () => {
    const res = await listTools(jsonRequest("/api/tools?status=community", { ip: nextIp() }));
    expect(res.status).toBe(200);
  });
});

describe("failed sign-ins are rate limited", () => {
  it("locks the IP after 10 failures — even the correct token is then rejected", async () => {
    const ip = nextIp();
    for (let i = 0; i < 10; i++) {
      const res = await authCheck(jsonRequest("/api/auth/admin", { token: "wrong", ip }));
      expect(res.status).toBe(401);
    }
    /* 11th attempt: 429 with Retry-After, before the token is even checked */
    const locked = await authCheck(jsonRequest("/api/auth/admin", { token: TOKEN, ip }));
    expect(locked.status).toBe(429);
    expect(locked.headers.get("retry-after")).toBeTruthy();
  });

  it("a successful sign-in clears the failure count", async () => {
    const ip = nextIp();
    for (let i = 0; i < 5; i++) {
      await authCheck(jsonRequest("/api/auth/admin", { token: "wrong", ip }));
    }
    expect((await authCheck(jsonRequest("/api/auth/admin", { token: TOKEN, ip }))).status).toBe(200);
    /* counter reset: 5 more failures still leave room before the limit */
    for (let i = 0; i < 5; i++) {
      expect((await authCheck(jsonRequest("/api/auth/admin", { token: "wrong", ip }))).status).toBe(401);
    }
  });

  it("does not lock out other IPs", async () => {
    const victim = nextIp();
    const bystander = nextIp();
    for (let i = 0; i < 10; i++) {
      await authCheck(jsonRequest("/api/auth/admin", { token: "wrong", ip: victim }));
    }
    expect((await authCheck(jsonRequest("/api/auth/admin", { token: TOKEN, ip: victim }))).status).toBe(429);
    expect((await authCheck(jsonRequest("/api/auth/admin", { token: TOKEN, ip: bystander }))).status).toBe(200);
  });
});
