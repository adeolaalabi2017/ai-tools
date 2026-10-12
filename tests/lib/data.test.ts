/**
 * Pure catalog helpers (src/lib/aitools/data.ts): the client-side search
 * fallback, brand-logo resolution priority, and the small formatters the
 * views share. No React, no DB — everything is deterministic input->output.
 */

import { describe, expect, it } from "vitest";
import {
  CATEGORIES,
  brandLogoUrl,
  catById,
  catLabel,
  countByCat,
  fmtK,
  githubAvatar,
  matchTool,
  trendingTools,
  type Tool,
} from "@/lib/aitools/data";

const tool = (over: Partial<Tool> = {}): Tool => ({
  id: "tester",
  name: "Tester",
  repo: "acme/tester",
  desc: "A tool for testing things.",
  replaces: "Nothing",
  cat: "coding",
  stars: 0,
  platforms: ["web"],
  createdAt: "2026-01-01",
  emoji: "🧪",
  ...over,
});

describe("matchTool (offline search fallback)", () => {
  it("matches name, replaces, desc and category label — case-insensitively", () => {
    const t = tool({ name: "VoiceStudio", replaces: "ElevenLabs", desc: "Local-first studio." });
    expect(matchTool(t, "voicestudio")).toBe(true); // name
    expect(matchTool(t, "ELEVEN")).toBe(true); // replaces
    expect(matchTool(t, "LOCAL-FIRST")).toBe(true); // desc
    expect(matchTool(t, "coding")).toBe(true); // cat "coding" → label "Coding"
    expect(matchTool(t, "dev tools")).toBe(false); // …but not another category's label
  });

  it("matches the category label of the tool's category", () => {
    const t = tool({ cat: "voice" });
    expect(matchTool(t, "voice")).toBe(true);
    expect(matchTool(t, "Voice")).toBe(true);
    expect(matchTool(t, "image")).toBe(false); // images category ≠ voice tool
  });

  it("trims the query and treats empty as match-all", () => {
    const t = tool();
    expect(matchTool(t, "")).toBe(true);
    expect(matchTool(t, "   ")).toBe(true);
    expect(matchTool(t, "  tester  ")).toBe(true);
  });

  it("does not match the repo field (offline fallback scope)", () => {
    const t = tool({ repo: "unique-org/unique-repo" });
    expect(matchTool(t, "unique-org")).toBe(false);
  });

  it("returns false when nothing matches", () => {
    expect(matchTool(tool(), "zzz-no-such-term")).toBe(false);
  });
});

describe("brandLogoUrl (authentic-mark priority chain)", () => {
  it("1. an explicit logoUrl override wins over everything", () => {
    expect(
      brandLogoUrl({ id: "voicestudio", logoUrl: "https://cdn.example/mine.png", repo: "x/y" }),
    ).toBe("https://cdn.example/mine.png");
  });

  it("2. tools with no authentic brand mark render the emoji tile (null)", () => {
    /* voicestudio's owner avatar is a personal photo — intentionally no logo */
    expect(brandLogoUrl({ id: "voicestudio", repo: "debpalash/VoiceStudio" })).toBeNull();
  });

  it("3. verified per-tool brand icons beat the owner avatar", () => {
    /* librechat's owner (danny-avila) has a pinned avatar, but the project's
       own shipped logo must win */
    const url = brandLogoUrl({ id: "librechat", repo: "danny-avila/LibreChat" })!;
    expect(url).toContain("LibreChat");
    expect(url).not.toBe(githubAvatar("danny-avila"));
  });

  it("4. pinned owner brand logos for personal/umbrella accounts", () => {
    const url = brandLogoUrl({ id: "aider", repo: "Aider-AI/aider" })!;
    expect(url).toContain("avatars.githubusercontent.com");
    expect(url).not.toContain(".png?size="); // pinned CDN URL, not the live redirect
  });

  it("5. falls back to the live GitHub owner-avatar redirect", () => {
    /* owner with no pinned entry — the redirect is still the real brand asset */
    expect(brandLogoUrl({ id: "unknown-tool", repo: "acme-corp/widget" })).toBe(
      githubAvatar("acme-corp"),
    );
  });

  it("returns null with no usable owner", () => {
    expect(brandLogoUrl({ id: "x", repo: "" })).toBeNull();
    expect(brandLogoUrl({ id: "x", repo: null })).toBeNull();
  });
});

describe("small formatters", () => {
  it("fmtK", () => {
    expect(fmtK(999)).toBe("999");
    expect(fmtK(1000)).toBe("1K"); // trailing .0 stripped
    expect(fmtK(2000)).toBe("2K");
    expect(fmtK(1500)).toBe("1.5K");
    expect(fmtK(154_000)).toBe("154K"); // >= 100K rounds to whole
    expect(fmtK(211_900)).toBe("212K");
    expect(fmtK(0)).toBe("0");
  });

  it("githubAvatar extracts the owner and honors size", () => {
    expect(githubAvatar("sst/opencode")).toBe("https://github.com/sst.png?size=128");
    expect(githubAvatar("sst/opencode", 256)).toBe("https://github.com/sst.png?size=256");
    expect(githubAvatar("bare-owner")).toBe("https://github.com/bare-owner.png?size=128");
  });

  it("catById falls back to the first category on unknown ids", () => {
    expect(catById("voice").id).toBe("voice");
    expect(catById("nope").id).toBe(CATEGORIES[0].id);
    expect(catLabel("devtools")).toBe("Developer Tools");
    expect(catLabel("nope")).toBe(CATEGORIES[0].label);
  });

  it("countByCat counts over a supplied list", () => {
    const list = [tool({ cat: "voice" }), tool({ cat: "voice" }), tool({ cat: "coding" })];
    expect(countByCat("voice", list)).toBe(2);
    expect(countByCat("images", list)).toBe(0);
  });

  it("trendingTools keeps only tools with a weekly gain, biggest first", () => {
    const list = [
      tool({ id: "small", weeklyGain: 100 }),
      tool({ id: "none" }),
      tool({ id: "big", weeklyGain: 900 }),
    ];
    expect(trendingTools(list).map((t) => t.id)).toEqual(["big", "small"]);
  });
});
