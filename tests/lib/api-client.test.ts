/**
 * The typed fetch client (src/lib/aitools/api.ts): query-string building,
 * the ApiError contract (status + normalized issues), and the admin bearer
 * attach. All HTTP is stubbed — these pin the client's request/response
 * contract, not the server's behavior (that's tests/api/*).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  fetchTools,
  getTool,
  voteTool,
  createPost,
  verifyAdminToken,
} from "@/lib/aitools/api";
import { clearAdminToken, setAdminToken } from "@/lib/aitools/admin-session";

type StubCall = { url: string; init?: RequestInit };

function stubFetch(status: number, body: unknown) {
  const calls: StubCall[] = [];
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  });
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
  clearAdminToken();
});

beforeEach(() => {
  clearAdminToken();
});

describe("query string building (via fetchTools)", () => {
  it("serializes every filter and trims q", async () => {
    const calls = stubFetch(200, { tools: [], total: 0, page: 1, limit: 24 });
    await fetchTools({
      q: "  voice  ",
      cat: "voice",
      platform: "mac",
      selfHosted: true,
      sourceAvailable: true,
      trending: true,
      featured: true,
      status: "pending",
      sort: "votes",
      page: 2,
      limit: 50,
    });
    const url = new URL(calls[0].url, "http://localhost");
    expect(url.pathname).toBe("/api/tools");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      q: "voice",
      cat: "voice",
      platform: "mac",
      selfHosted: "1",
      sourceAvailable: "1",
      trending: "1",
      featured: "1",
      status: "pending",
      sort: "votes",
      page: "2",
      limit: "50",
    });
  });

  it("omits falsy/unset params entirely", async () => {
    const calls = stubFetch(200, { tools: [], total: 0, page: 1, limit: 24 });
    await fetchTools({ q: "   ", selfHosted: false });
    expect(calls[0].url).toBe("/api/tools");
  });
});

describe("admin bearer attach", () => {
  it("sends Authorization when signed in — on every call", async () => {
    setAdminToken("secret-token-123");
    const calls = stubFetch(200, { tools: [], total: 0, page: 1, limit: 24 });
    await fetchTools({});

    const headers = new Headers(calls[0].init?.headers);
    expect(headers.get("authorization")).toBe("Bearer secret-token-123");
  });

  it("sends no Authorization header when signed out", async () => {
    const calls = stubFetch(200, { tools: [], total: 0, page: 1, limit: 24 });
    await fetchTools({});
    const headers = new Headers(calls[0].init?.headers);
    expect(headers.get("authorization")).toBeNull();
  });
});

describe("ApiError contract", () => {
  it("throws ApiError with status and message on non-2xx", async () => {
    stubFetch(404, { error: "Tool not found" });
    await expect(getTool("ghost")).resolves.toBeNull(); // getTool maps 404 → null

    stubFetch(500, { error: "Internal server error" });
    const err = await voteTool("opencode", "voter-token-1").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(500);
    expect(err.message).toBe("Internal server error");
  });

  it("normalizes zod issues to strings (objects → their message)", async () => {
    stubFetch(400, {
      error: "Validation failed",
      issues: [{ message: "Name must be 2–60 characters" }, "plain string issue", 42],
    });
    const err = await createPost({ title: "x", excerpt: "x", content: "x" }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.issues).toEqual(["Name must be 2–60 characters", "plain string issue"]);
  });

  it("survives non-JSON error bodies", async () => {
    vi.stubGlobal("fetch", async () => new Response("<html>gateway</html>", { status: 502 }));
    const err = await voteTool("opencode", "voter-token-1").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(502);
    expect(err.issues).toEqual([]);
  });

  it("wraps network failures as status 0", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("fetch failed");
    });
    const err = await voteTool("opencode", "voter-token-1").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(0);
  });
});

describe("verifyAdminToken (login check)", () => {
  it("returns the HTTP status verbatim and never throws", async () => {
    stubFetch(200, { ok: true });
    expect(await verifyAdminToken("right")).toBe(200);

    stubFetch(401, { error: "Admin authorization required." });
    expect(await verifyAdminToken("wrong")).toBe(401);

    stubFetch(503, { error: "Admin access is not configured on this server." });
    expect(await verifyAdminToken("anything")).toBe(503);
  });

  it("returns 0 on network failure", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("fetch failed");
    });
    expect(await verifyAdminToken("x")).toBe(0);
  });

  it("sends the candidate token, not the stored one", async () => {
    setAdminToken("stored-token");
    const calls = stubFetch(200, { ok: true });
    await verifyAdminToken("candidate-token");
    const headers = new Headers(calls[0].init?.headers);
    expect(headers.get("authorization")).toBe("Bearer candidate-token");
  });
});
