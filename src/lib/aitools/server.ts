/* ------------------------------------------------------------------ */
/*  AIStore — shared server-side API helpers                           */
/*  Serializer, slugify, and zod schemas behind /api/tools             */
/*  Plus the admin bearer-token gate for moderator-only endpoints.     */
/* ------------------------------------------------------------------ */

import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { CATEGORIES } from "@/lib/aitools/data";
import {
  ADMIN_AUTH_POLICY,
  clearFailures,
  rateLimitExceeded,
  recordFailure,
} from "./rate-limit";

/** Rate-limit bucket for failed admin sign-ins (shared by all admin routes). */
const AUTH_BUCKET = "admin-auth";

/* ------------------------------ admin auth ---------------------------- */

function safeEqual(a: string, b: string): boolean {
  /* hash both sides first so the comparison is fixed-length and constant-time */
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** True when the request carries a valid `Authorization: Bearer <ADMIN_TOKEN>`. */
export function isAdminAuthorized(request: Request): boolean {
  const expected = process.env.ADMIN_TOKEN?.trim();
  if (!expected) return false;
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return false;
  return safeEqual(token, expected);
}

/**
 * Gate for moderator-only endpoints. Returns the error response to send
 * back, or `null` when the caller is authorized:
 *
 *   const denied = await requireAdmin(request);
 *   if (denied) return denied;
 *
 * Fails closed when ADMIN_TOKEN is unset on the server (503) so a fresh
 * deploy never ships an open moderation surface. Failed attempts are rate
 * limited per IP (see rate-limit.ts) to slow token guessing.
 */
export async function requireAdmin(request: Request): Promise<NextResponse | null> {
  const expected = process.env.ADMIN_TOKEN?.trim();
  if (!expected) {
    return NextResponse.json(
      { error: "Admin access is not configured on this server." },
      { status: 503 },
    );
  }
  const limited = await rateLimitExceeded(AUTH_BUCKET, request, ADMIN_AUTH_POLICY);
  if (limited) return limited;
  if (!isAdminAuthorized(request)) {
    await recordFailure(AUTH_BUCKET, request);
    return NextResponse.json(
      { error: "Admin authorization required." },
      { status: 401 },
    );
  }
  await clearFailures(AUTH_BUCKET, request);
  return null;
}

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
  logoUrl: string | null;
  screenshotUrl: string | null;
  headerUrl: string | null;
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
  logoUrl: string | null;
  screenshotUrl: string | null;
  headerUrl: string | null;
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
    logoUrl: t.logoUrl,
    screenshotUrl: t.screenshotUrl,
    headerUrl: t.headerUrl,
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

/**
 * Optional http(s) URL field.
 * - omitted / undefined → "don't touch" on PATCH
 * - "" or null → null (clear the image)
 * - non-empty → must look like an http(s) URL
 */
const optionalUrl = z
  .union([
    z.literal(""),
    z.null(),
    z
      .string()
      .trim()
      .max(500, "URL must be 500 characters or fewer")
      .refine((v) => /^https?:\/\/\S+$/i.test(v), "Must be a valid http(s) URL"),
  ])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === null || v === "" ? null : v));

/**
 * Optional image reference: same semantics as optionalUrl, but also
 * accepts an app-hosted upload (/uploads/<name> — no query/fragment, no
 * traversal). Anything else (javascript:, //, relative paths) is rejected.
 */
const optionalImageUrl = z
  .union([
    z.literal(""),
    z.null(),
    z
      .string()
      .trim()
      .max(500, "URL must be 500 characters or fewer")
      .refine(
        (v) => /^https?:\/\/\S+$/i.test(v) || /^\/(api\/)?uploads\/[\w.-]+$/.test(v),
        "Must be an http(s) URL or an uploaded image",
      ),
  ])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === null || v === "" ? null : v));

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
  logoUrl: optionalUrl, // branding: small square logo
  screenshotUrl: optionalUrl, // branding: product screenshot
  headerUrl: optionalUrl, // branding: wide header/banner image
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

/* ------------------------------- wants -------------------------------- */

/** Wire format returned by every /api/wants endpoint. */
export interface ApiWant {
  id: string;
  target: string;
  note: string | null;
  status: "open" | "progress" | "fulfilled" | string;
  requester: string | null;
  /** Duplicate requests merged into this one. */
  dupes: number;
  /** baseVotes + live WantVote count. */
  votes: number;
  /** Tool ids from the catalog connected to a fulfilled request. */
  connected: string[];
  createdAt: string;
}

/** Structural type of a Prisma `Want` row as read from SQLite. */
export interface DbWant {
  id: string;
  target: string;
  note: string | null;
  status: string;
  requester: string | null;
  dupes: number;
  baseVotes: number;
  connected: string; // CSV of tool ids
  createdAt: Date;
}

export function serializeWant(w: DbWant, votes: number): ApiWant {
  return {
    id: w.id,
    target: w.target,
    note: w.note,
    status: w.status,
    requester: w.requester,
    dupes: w.dupes,
    votes,
    connected: w.connected.split(",").filter(Boolean),
    createdAt: w.createdAt.toISOString(),
  };
}

/**
 * Requests are deduped by a normalized key: lowercase, letters+digits only.
 * "Notion", "notion " and "Notion!" all resolve to the same want id "notion".
 */
export function normalizeWantTarget(target: string): string {
  return target.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 80);
}

/** Body for POST /api/wants — creating a request (or voting via duplicate). */
export const wantRequestSchema = z.object({
  target: z
    .string()
    .trim()
    .min(2, "Name the software to replace (2–80 characters)")
    .max(80, "Name the software to replace (2–80 characters)"),
  note: z.string().trim().max(280, "Note must be 280 characters or fewer").optional(),
  voter: z
    .string()
    .trim()
    .min(8, "Voter token must be 8–64 characters")
    .max(64, "Voter token must be 8–64 characters"),
});

/** Body for POST /api/wants/[id]/vote. Reuses the voter token shape. */
export const wantVoteSchema = voteSchema;

/** Admin body for PATCH /api/wants/[id] — status + connected tool ids. */
export const wantAdminSchema = z.object({
  status: z.enum(["open", "progress", "fulfilled"]).optional(),
  connected: z.array(z.string().trim().min(1).max(80)).max(12).optional(),
});

/** Admin body for PATCH /api/tools/[id] — metadata edits from the catalog manager. */
export const toolUpdateSchema = z.object({
  desc: z.string().trim().min(10, "Description must be 10–200 characters").max(200, "Description must be 10–200 characters").optional(),
  replaces: z.string().trim().min(2, "Replaces must be 2–80 characters").max(80, "Replaces must be 2–80 characters").optional(),
  cat: z.string().refine(isCategoryId, "Unknown category").optional(),
  platforms: z.array(z.enum(PLATFORM_VALUES)).min(1, "Pick at least one platform").optional(),
  selfHosted: z.boolean().optional(),
  sourceAvailable: z.boolean().optional(),
  emoji: z.string().trim().min(1, "Emoji required").max(8, "Emoji must be 8 characters or fewer").optional(),
  logoUrl: optionalUrl,
  screenshotUrl: optionalUrl,
  headerUrl: optionalUrl,
});

/* ------------------------------- posts -------------------------------- */

/** Wire format returned by every /api/posts endpoint. */
export interface ApiPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  author: string;
  tags: string[];
  coverEmoji: string;
  coverUrl: string | null;
  status: "draft" | "published" | string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Structural type of a Prisma `Post` row as read from SQLite. */
export interface DbPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  author: string;
  tags: string; // CSV
  coverEmoji: string;
  coverUrl: string | null;
  status: string;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export function serializePost(p: DbPost): ApiPost {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    content: p.content,
    author: p.author,
    tags: p.tags.split(",").map((s) => s.trim()).filter(Boolean),
    coverEmoji: p.coverEmoji,
    coverUrl: p.coverUrl,
    status: p.status,
    publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

/** Body for POST /api/posts (admin CMS create). */
export const postCreateSchema = z.object({
  title: z.string().trim().min(4, "Title must be 4–120 characters").max(120, "Title must be 4–120 characters"),
  excerpt: z.string().trim().min(10, "Excerpt must be 10–280 characters").max(280, "Excerpt must be 10–280 characters"),
  content: z.string().trim().min(20, "Content must be at least 20 characters"),
  author: z.string().trim().max(80, "Author must be 80 characters or fewer").optional(),
  tags: z.array(z.string().trim().min(1).max(24, "Tags must be 24 characters or fewer")).max(6, "At most 6 tags").optional(),
  coverEmoji: z.string().trim().max(8, "Cover must be 8 characters or fewer").optional(),
  coverUrl: optionalImageUrl,
  status: z.enum(["draft", "published"]).optional(),
});

/** Body for PATCH /api/posts/[id] — partial update. */
export const postUpdateSchema = postCreateSchema.partial().extend({
  /** Renaming: raw input is slugified by the route; old slugs keep resolving. */
  slug: z.string().trim().max(120).optional(),
});

/* -------------------------------- ads --------------------------------- */

export const AD_PLACEMENTS = ["browse", "blog", "wanted"] as const;

/** Wire format returned by every /api/ads endpoint. */
export interface ApiAd {
  id: string;
  name: string;
  headline: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  imageUrl: string | null;
  emoji: string;
  placement: (typeof AD_PLACEMENTS)[number] | string;
  active: boolean;
  weight: number;
  impressions: number;
  clicks: number;
  createdAt: string;
  updatedAt: string;
}

/** Structural type of a Prisma `Ad` row as read from SQLite. */
export interface DbAd {
  id: string;
  name: string;
  headline: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  imageUrl: string | null;
  emoji: string;
  placement: string;
  active: boolean;
  weight: number;
  impressions: number;
  clicks: number;
  createdAt: Date;
  updatedAt: Date;
}

export function serializeAd(a: DbAd): ApiAd {
  return {
    id: a.id,
    name: a.name,
    headline: a.headline,
    body: a.body,
    ctaLabel: a.ctaLabel,
    ctaUrl: a.ctaUrl,
    imageUrl: a.imageUrl,
    emoji: a.emoji,
    placement: a.placement,
    active: a.active,
    weight: a.weight,
    impressions: a.impressions,
    clicks: a.clicks,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

const adPlacement = z.enum(AD_PLACEMENTS);

/** Body for POST /api/ads (admin create). */
export const adCreateSchema = z.object({
  name: z.string().trim().min(2, "Label must be 2–60 characters").max(60, "Label must be 2–60 characters"),
  headline: z.string().trim().min(2, "Headline must be 2–60 characters").max(60, "Headline must be 2–60 characters"),
  body: z.string().trim().min(2, "Body must be 2–120 characters").max(120, "Body must be 2–120 characters"),
  ctaLabel: z.string().trim().min(1, "CTA label required").max(24, "CTA label must be 24 characters or fewer").default("Learn more"),
  ctaUrl: z
    .string()
    .trim()
    .max(500, "URL must be 500 characters or fewer")
    .refine((v) => /^https?:\/\/\S+$/i.test(v), "Must be a valid http(s) URL"),
  imageUrl: optionalUrl,
  emoji: z.string().trim().max(8, "Emoji must be 8 characters or fewer").optional(),
  placement: adPlacement.default("browse"),
  active: z.boolean().optional(),
  weight: z.number().int().min(1, "Weight must be 1–10").max(10, "Weight must be 1–10").optional(),
});

/** Body for PATCH /api/ads/[id] — partial update. */
export const adUpdateSchema = adCreateSchema.partial();

/** Body for POST /api/ads/[id]/track — fire-and-forget stats. */
export const adTrackSchema = z.object({
  type: z.enum(["impression", "click"]),
});

/* ----------------------------- analytics ------------------------------ */

/** Body for POST /api/analytics — one page view beacon. */
export const pageViewSchema = z.object({
  path: z.string().trim().min(1).max(40),
  session: z.string().trim().min(8).max(64),
});

/** Aggregate shape returned by GET /api/analytics. */
export interface AnalyticsSummary {
  /** Pageviews for each of the last `days` days, oldest first (ISO date keys). */
  series: { date: string; views: number; visitors: number }[];
  totalViews: number;
  uniqueVisitors: number;
  topPages: { path: string; views: number }[];
}
