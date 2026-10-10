/* ------------------------------------------------------------------ */
/*  AIStore — shared server-side API helpers                           */
/*  Serializer, slugify, and zod schemas behind /api/tools             */
/* ------------------------------------------------------------------ */

import { z } from "zod";
import { CATEGORIES } from "@/lib/aitools/data";

/** Wire format returned by every /api/tools endpoint (mirrors the frontend Tool type). */
export interface ApiTool {
  id: string;
  name: string;
  repo: string;
  desc: string;
  replaces: string;
  cat: string;
  stars: number;
  platforms: string[];
  selfHosted: boolean;
  sourceAvailable: boolean;
  weeklyGain: number | null;
  createdAt: string;
  emoji: string;
  glyph: string | null;
  votes: number;
  status: string;
  submitter: string | null;
  featured: boolean;
}

/** Structural type of a Prisma `Tool` row as read from SQLite. */
export interface DbTool {
  id: string;
  name: string;
  repo: string;
  desc: string;
  replaces: string;
  cat: string;
  stars: number;
  platforms: string; // CSV: "web,mac"
  selfHosted: boolean;
  sourceAvailable: boolean;
  weeklyGain: number | null;
  createdAt: Date;
  emoji: string;
  glyph: string | null;
  status: string;
  submitter: string | null;
  featured: boolean;
}

/**
 * Prisma row → API JSON shape.
 * `votes` is derived from the Vote table count (the Tool table has no counter column).
 */
export function serializeTool(t: DbTool, votes: number): ApiTool {
  return {
    id: t.id,
    name: t.name,
    repo: t.repo,
    desc: t.desc,
    replaces: t.replaces,
    cat: t.cat,
    stars: t.stars,
    platforms: t.platforms.split(",").filter(Boolean),
    selfHosted: t.selfHosted,
    sourceAvailable: t.sourceAvailable,
    weeklyGain: t.weeklyGain,
    createdAt: t.createdAt.toISOString(),
    emoji: t.emoji,
    glyph: t.glyph,
    votes,
    status: t.status,
    submitter: t.submitter,
    featured: t.featured,
  };
}

/** Lowercase, keep a-z0-9, spaces/dashes (any non-alphanumeric run) → single dash, trim. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const CATEGORY_IDS: readonly string[] = CATEGORIES.map((c) => c.id);

export const isCategoryId = (id: string): boolean => CATEGORY_IDS.includes(id);

/** Category ids whose label contains the lowercased query — OR-ed into text search. */
export function matchingCategoryIds(q: string): string[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return [];
  return CATEGORIES.filter((c) => c.label.toLowerCase().includes(needle)).map((c) => c.id);
}

/* ------------------------------ zod schemas ------------------------------ */

export const PLATFORM_VALUES = ["web", "mac", "win", "linux", "ios", "android"] as const;

/** Community submission body. Unknown fields are stripped by default. */
export const submissionSchema = z.object({
  name: z.string().trim().min(2, "Name must be 2–60 characters").max(60, "Name must be 2–60 characters"),
  repo: z.string().trim().regex(/^[\w.-]+\/[\w.-]+$/, "Repo must be in owner/repo format"),
  desc: z.string().trim().min(10, "Description must be 10–200 characters").max(200, "Description must be 10–200 characters"),
  replaces: z.string().trim().min(2, "Replaces must be 2–80 characters").max(80, "Replaces must be 2–80 characters"),
  cat: z.string().refine(isCategoryId, "Unknown category"),
  platforms: z.array(z.enum(PLATFORM_VALUES)).min(1).default(["web"]),
  submitter: z.string().trim().max(120).optional(),
  homepage: z.string().trim().optional(), // accepted but not persisted (no column)
});

/** Upvote toggle body. */
export const voteSchema = z.object({
  voter: z
    .string()
    .trim()
    .min(8, "Voter token must be 8–64 characters")
    .max(64, "Voter token must be 8–64 characters"),
});

/** Moderation body behind /api/tools/[id]/moderate. */
export const moderateSchema = z.object({
  action: z.enum(["approve", "reject"]),
  /** Optional editorial flag applied when approving (ignored on reject). */
  featured: z.boolean().optional(),
});

/** Feature-toggle body behind /api/tools/[id]/feature. */
export const featureSchema = z.object({
  featured: z.boolean(),
});
