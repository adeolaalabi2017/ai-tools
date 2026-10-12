/**
 * Ads contract: public placement rotation (active ads only, weighted),
 * admin CRUD behind the token, and the public impression/click beacon.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", async () => {
  const { fake } = await import("./fake-db");
  return { db: fake.db };
});

import { GET as listAds, POST as createAd } from "@/app/api/ads/route";
import { DELETE as deleteAd, PATCH as updateAd } from "@/app/api/ads/[id]/route";
import { POST as trackAd } from "@/app/api/ads/[id]/track/route";
import { fake } from "./fake-db";
import { jsonRequest, readJson, withId } from "./helpers";

const TOKEN = "test-admin-token-1234567890";

let ipSeq = 60;
const nextIp = () => `198.18.1.${++ipSeq}`;

const NEW_AD = {
  name: "Acme Cloud — spring",
  headline: "Ship AI features this week",
  body: "Managed inference with zero DevOps.",
  ctaUrl: "https://acme.example",
  placement: "browse",
};

beforeEach(() => {
  process.env.ADMIN_TOKEN = TOKEN;
  fake.reset();
  fake.seedAds([
    { id: "ad-live", name: "Live ad", placement: "browse", active: true, weight: 5 },
    { id: "ad-paused", name: "Paused ad", placement: "browse", active: false, weight: 9 },
    { id: "ad-blog", name: "Blog ad", placement: "blog", active: true, weight: 1 },
  ]);
});

describe("GET /api/ads (public rotation)", () => {
  it("serves only active ads for the requested placement", async () => {
    const res = await listAds(jsonRequest("/api/ads?placement=browse", { ip: nextIp() }));
    expect(res.status).toBe(200);
    const body = (await readJson(res)) as { ads: { id: string }[] };
    expect(body.ads.map((a) => a.id)).toEqual(["ad-live"]);
  });

  it("400 on unknown or missing placement", async () => {
    expect((await listAds(jsonRequest("/api/ads?placement=nope", { ip: nextIp() }))).status).toBe(400);
    expect((await listAds(jsonRequest("/api/ads", { ip: nextIp() }))).status).toBe(400);
  });

  it("returns no more than the requested limit", async () => {
    fake.seedAds([
      { id: "ad-2", placement: "wanted", active: true },
      { id: "ad-3", placement: "wanted", active: true },
      { id: "ad-4", placement: "wanted", active: true },
    ]);
    const res = await listAds(jsonRequest("/api/ads?placement=wanted&limit=2", { ip: nextIp() }));
    const body = (await readJson(res)) as { ads: unknown[] };
    expect(body.ads).toHaveLength(2);
  });

  it("?all=1 (admin list with paused ads) requires the token", async () => {
    const anon = await listAds(jsonRequest("/api/ads?all=1", { ip: nextIp() }));
    expect(anon.status).toBe(401);

    const admin = await listAds(jsonRequest("/api/ads?all=1", { token: TOKEN, ip: nextIp() }));
    const body = (await readJson(admin)) as { ads: { id: string }[]; total: number };
    expect(body.total).toBe(3);
  });
});

describe("POST /api/ads (admin)", () => {
  it("401 anonymously; 400 on invalid bodies", async () => {
    const anon = await createAd(
      jsonRequest("/api/ads", { method: "POST", body: NEW_AD, ip: nextIp() }),
    );
    expect(anon.status).toBe(401);

    const bad = await createAd(
      jsonRequest("/api/ads", {
        method: "POST",
        body: { ...NEW_AD, weight: 99 },
        token: TOKEN,
        ip: nextIp(),
      }),
    );
    expect(bad.status).toBe(400);
  });

  it("creates paused by default with weight 1", async () => {
    const res = await createAd(
      jsonRequest("/api/ads", { method: "POST", body: NEW_AD, token: TOKEN, ip: nextIp() }),
    );
    expect(res.status).toBe(201);
    const { ad } = (await readJson(res)) as {
      ad: { active: boolean; weight: number; impressions: number; clicks: number };
    };
    expect(ad).toMatchObject({ active: false, weight: 1, impressions: 0, clicks: 0 });
    /* and it does NOT appear in the public rotation while paused */
    const pub = await listAds(jsonRequest("/api/ads?placement=browse", { ip: nextIp() }));
    const pubBody = (await readJson(pub)) as { ads: { id: string }[] };
    expect(pubBody.ads.map((a) => a.id)).toEqual(["ad-live"]);
  });
});

describe("PATCH/DELETE /api/ads/[id] (admin)", () => {
  it("PATCH toggles and rescales; 401 anonymously", async () => {
    const anon = await updateAd(
      jsonRequest("/api/ads/ad-paused", { method: "PATCH", body: { active: true }, ip: nextIp() }),
      withId("ad-paused"),
    );
    expect(anon.status).toBe(401);

    const res = await updateAd(
      jsonRequest("/api/ads/ad-paused", {
        method: "PATCH",
        body: { active: true, weight: 3 },
        token: TOKEN,
        ip: nextIp(),
      }),
      withId("ad-paused"),
    );
    expect(res.status).toBe(200);
    const { ad } = (await readJson(res)) as { ad: { active: boolean; weight: number } };
    expect(ad).toMatchObject({ active: true, weight: 3 });

    /* now visible in the public rotation (limit defaults to 1 — ask for more) */
    const pub = await listAds(jsonRequest("/api/ads?placement=browse&limit=3", { ip: nextIp() }));
    const pubBody = (await readJson(pub)) as { ads: { id: string }[] };
    expect(pubBody.ads.map((a) => a.id).sort()).toEqual(["ad-live", "ad-paused"]);
  });

  it("DELETE removes; 401 anonymously; 404 unknown", async () => {
    const anon = await deleteAd(
      jsonRequest("/api/ads/ad-live", { method: "DELETE", ip: nextIp() }),
      withId("ad-live"),
    );
    expect(anon.status).toBe(401);

    const res = await deleteAd(
      jsonRequest("/api/ads/ad-live", { method: "DELETE", token: TOKEN, ip: nextIp() }),
      withId("ad-live"),
    );
    expect(res.status).toBe(200);
    expect(fake.rawAds.map((a) => a.id)).not.toContain("ad-live");

    const missing = await deleteAd(
      jsonRequest("/api/ads/ghost", { method: "DELETE", token: TOKEN, ip: nextIp() }),
      withId("ghost"),
    );
    expect(missing.status).toBe(404);
  });
});

describe("POST /api/ads/[id]/track (public beacon)", () => {
  it("increments impressions and clicks independently", async () => {
    const imp = await trackAd(
      jsonRequest("/api/ads/ad-live/track", { method: "POST", body: { type: "impression" }, ip: nextIp() }),
      withId("ad-live"),
    );
    expect(imp.status).toBe(200);
    expect((await readJson(imp))).toMatchObject({ ok: true, impressions: 1, clicks: 0 });

    const click = await trackAd(
      jsonRequest("/api/ads/ad-live/track", { method: "POST", body: { type: "click" }, ip: nextIp() }),
      withId("ad-live"),
    );
    expect((await readJson(click))).toMatchObject({ impressions: 1, clicks: 1 });
  });

  it("400 on bad type; 404 on unknown ad — no admin token needed", async () => {
    const bad = await trackAd(
      jsonRequest("/api/ads/ad-live/track", { method: "POST", body: { type: "bounce" }, ip: nextIp() }),
      withId("ad-live"),
    );
    expect(bad.status).toBe(400);

    const missing = await trackAd(
      jsonRequest("/api/ads/ghost/track", { method: "POST", body: { type: "impression" }, ip: nextIp() }),
      withId("ghost"),
    );
    expect(missing.status).toBe(404);
  });
});
