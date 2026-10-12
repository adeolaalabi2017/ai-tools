/**
 * The static↔API bridge in tools-provider.tsx: staticToolToApi (seeded
 * catalog → wire shape for query initialData) and apiToolToTool (wire →
 * render shape, static entry as base). These two carry the "editorial
 * extras survive, DB wins for shared fields" contract the whole UI depends
 * on — including the offline-first first paint.
 */

import { describe, expect, it } from "vitest";
import { staticToolToApi, apiToolToTool } from "@/components/aitools/tools-provider";
import { type Tool } from "@/lib/aitools/data";
import type { ApiTool } from "@/lib/aitools/api";

const staticTool: Tool = {
  id: "opencode",
  name: "OpenCode",
  repo: "sst/opencode",
  desc: "An AI coding agent.",
  replaces: "Claude Code",
  cat: "coding",
  stars: 211_900,
  platforms: ["mac", "win", "linux"],
  createdAt: "2025-03-14",
  emoji: "🧑‍💻",
  selfHosted: true,
  weeklyGain: 500,
  featured: true,
  featuredArt: "terminal",
  rating: { score: 4.6, reviews: 214, source: "G2", highlight: "Great." },
};

const apiTool: ApiTool = {
  id: "opencode",
  name: "OpenCode",
  repo: "sst/opencode",
  desc: "An AI coding agent.",
  replaces: "Claude Code",
  cat: "coding",
  stars: 211_900,
  platforms: ["mac", "win", "linux"],
  selfHosted: true,
  sourceAvailable: false,
  weeklyGain: 500,
  createdAt: "2025-03-14",
  emoji: "🧑‍💻",
  glyph: null,
  votes: 3,
  status: "curated",
  submitter: null,
  featured: true,
  logoUrl: null,
  screenshotUrl: null,
  headerUrl: null,
};

describe("staticToolToApi (query initialData)", () => {
  it("maps to the wire shape with safe defaults", () => {
    const minimal: Tool = {
      id: "bare",
      name: "Bare",
      repo: "a/b",
      desc: "d",
      replaces: "r",
      cat: "coding",
      stars: 1,
      platforms: ["web"],
      createdAt: "2026-01-01",
      emoji: "🧩",
    };
    const api = staticToolToApi(minimal);
    expect(api).toMatchObject({
      selfHosted: false,
      sourceAvailable: false,
      weeklyGain: null,
      glyph: null,
      votes: 0,
      status: "curated",
      submitter: null,
      featured: false,
      logoUrl: null,
      screenshotUrl: null,
      headerUrl: null,
    });
    expect(api.platforms).toEqual(["web"]);
  });

  it("preserves editorial + live fields from the static entry", () => {
    const api = staticToolToApi(staticTool);
    expect(api).toMatchObject({
      votes: 0, // static entries never claim votes
      weeklyGain: 500,
      featured: true,
      selfHosted: true,
    });
  });
});

describe("apiToolToTool (wire → render, static as base)", () => {
  it("editorial extras survive from the base (rating, featuredArt)", () => {
    const t = apiToolToTool(apiTool, staticTool);
    expect(t.rating).toEqual(staticTool.rating);
    expect(t.featuredArt).toBe("terminal");
  });

  it("DB content wins for shared fields", () => {
    const t = apiToolToTool(
      { ...apiTool, name: "OpenCode v2", desc: "New description.", stars: 999, votes: 42, featured: false },
      staticTool,
    );
    expect(t.name).toBe("OpenCode v2");
    expect(t.desc).toBe("New description.");
    expect(t.stars).toBe(999);
    expect(t.votes).toBe(42);
    expect(t.featured).toBe(false); // unfeaturing from the admin must stick
  });

  it("DB wins for the boolean flags even when the static entry disagrees", () => {
    /* the merge contract is 'DB content wins for shared fields' — an admin
       un-checking self-hosted on a curated tool must take effect */
    const t = apiToolToTool({ ...apiTool, selfHosted: false, sourceAvailable: false }, staticTool);
    expect(t.selfHosted).toBe(false);
    expect(t.sourceAvailable).toBe(false);

    const on = apiToolToTool({ ...apiTool, selfHosted: true, sourceAvailable: true }, staticTool);
    expect(on.selfHosted).toBe(true);
    expect(on.sourceAvailable).toBe(true);
  });

  it("weeklyGain falls back to the static snapshot when the DB has none", () => {
    /* DB null = the live snapshot went stale; the editorial snapshot stays */
    const t = apiToolToTool({ ...apiTool, weeklyGain: null }, staticTool);
    expect(t.weeklyGain).toBe(500);

    const cleared = apiToolToTool({ ...apiTool, weeklyGain: 0 }, staticTool);
    expect(cleared.weeklyGain).toBe(0); // 0 is a real value, not "missing"
  });

  it("works without a base — community tools render straight from the API", () => {
    const community: ApiTool = {
      ...apiTool,
      id: "night-scribe",
      name: "Night Scribe",
      votes: 0,
      status: "community",
      submitter: "QA Bot",
    };
    const t = apiToolToTool(community);
    expect(t).toMatchObject({
      id: "night-scribe",
      name: "Night Scribe",
      status: "community",
      submitter: "QA Bot",
    });
    expect(t.rating).toBeUndefined();
    expect(t.featuredArt).toBeUndefined();
    expect(t.selfHosted).toBe(true); // straight from api, no static OR-merge
  });

  it("platforms and dates pass through unchanged", () => {
    const t = apiToolToTool(apiTool, staticTool);
    expect(t.platforms).toEqual(["mac", "win", "linux"]);
    expect(t.createdAt).toBe("2025-03-14");
  });
});
