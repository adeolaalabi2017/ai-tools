/* ------------------------------------------------------------------ */
/*  AIStore — typed client for the /api/tools backend                  */
/*  Relative URLs only (same origin). Never throws on parse — throws   */
/*  ApiError for non-2xx so callers can branch on status.              */
/*  The admin bearer token (if signed in) rides along on every call.   */
/* ------------------------------------------------------------------ */

import { getAdminToken } from "./admin-session";

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
  createdAt: string; // ISO date string
  emoji: string;
  glyph: string | null;
  votes: number;
  status: "curated" | "community" | string;
  submitter: string | null;
  featured: boolean;
  logoUrl: string | null;
  screenshotUrl: string | null;
  headerUrl: string | null;
}

export interface ToolsPage {
  tools: ApiTool[];
  total: number;
  page: number;
  limit: number;
}

export interface ToolsQueryParams {
  q?: string;
  cat?: string;
  platform?: string;
  selfHosted?: boolean;
  sourceAvailable?: boolean;
  trending?: boolean;
  /** Editors' picks only — the moderator-toggled `featured` badge. */
  featured?: boolean;
  /** Omit for public lists (curated + community). "pending" = moderation queue only. */
  status?: string;
  sort?: "newest" | "stars" | "momentum" | "votes" | "name" | string;
  page?: number;
  limit?: number;
}

export interface ToolSubmitPayload {
  name: string;
  repo: string;
  desc: string;
  replaces: string;
  cat: string;
  platforms: string[];
  submitter?: string;
  homepage?: string;
  logoUrl?: string;
  screenshotUrl?: string;
  headerUrl?: string;
}

export interface VoteResult {
  votes: number;
  voted: boolean;
}

/** Response of POST /api/tools/[id]/moderate. */
export interface ModerateResult {
  action: string;
  tool?: ApiTool;
  deleted?: boolean;
}

/** Error carrying the HTTP status and validation issues (if any). */
export class ApiError extends Error {
  readonly status: number;
  readonly issues: string[];

  constructor(status: number, message: string, issues: string[] = [], options?: ErrorOptions) {
    super(message, options);
    this.name = "ApiError";
    this.status = status;
    this.issues = issues;
  }
}

/* ----------------------------- internals ----------------------------- */

function buildQuery(params: ToolsQueryParams): string {
  const sp = new URLSearchParams();
  if (params.q && params.q.trim()) sp.set("q", params.q.trim());
  if (params.cat) sp.set("cat", params.cat);
  if (params.platform) sp.set("platform", params.platform);
  if (params.selfHosted) sp.set("selfHosted", "1");
  if (params.sourceAvailable) sp.set("sourceAvailable", "1");
  if (params.trending) sp.set("trending", "1");
  if (params.featured) sp.set("featured", "1");
  if (params.status) sp.set("status", params.status);
  if (params.sort) sp.set("sort", params.sort);
  if (typeof params.page === "number") sp.set("page", String(params.page));
  if (typeof params.limit === "number") sp.set("limit", String(params.limit));
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

async function readErrorBody(res: Response): Promise<{ error?: string; issues?: string[] }> {
  try {
    const body: unknown = await res.json();
    if (body && typeof body === "object") {
      const b = body as { error?: unknown; issues?: unknown };
      const issues = Array.isArray(b.issues)
        ? b.issues
            /* issues may be plain strings or structured objects (e.g. Zod issues) */
            .map((i) => {
              if (typeof i === "string") return i;
              if (i && typeof i === "object" && typeof (i as { message?: unknown }).message === "string") {
                return (i as { message: string }).message;
              }
              return null;
            })
            .filter((i): i is string => typeof i === "string")
        : undefined;
      return {
        error: typeof b.error === "string" ? b.error : undefined,
        issues,
      };
    }
  } catch {
    /* non-JSON error body */
  }
  return {};
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  /* admin endpoints check the bearer token; harmless on public routes */
  const token = getAdminToken();
  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(url, { ...init, headers });
  } catch (cause) {
    throw new ApiError(0, "Network request failed", [], { cause });
  }
  if (!res.ok) {
    const body = await readErrorBody(res);
    throw new ApiError(res.status, body.error ?? `Request failed (${res.status})`, body.issues ?? []);
  }
  return (await res.json()) as T;
}

/* ------------------------------ endpoints ----------------------------- */

/**
 * Checks a candidate admin token against the server before storing it.
 * Returns the HTTP status (0 = network failure): 200 ok, 401 wrong token,
 * 503 admin not configured on the server.
 */
export async function verifyAdminToken(token: string): Promise<number> {
  try {
    const res = await fetch("/api/auth/admin", {
      headers: { Authorization: `Bearer ${token.trim()}` },
    });
    return res.status;
  } catch {
    return 0;
  }
}

export async function fetchTools(params: ToolsQueryParams = {}): Promise<ToolsPage> {
  return request<ToolsPage>(`/api/tools${buildQuery(params)}`);
}

export async function getTool(id: string): Promise<ApiTool | null> {
  try {
    const body = await request<{ tool: ApiTool }>(`/api/tools/${encodeURIComponent(id)}`);
    return body.tool;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export async function submitTool(payload: ToolSubmitPayload): Promise<ApiTool> {
  const body = await request<{ tool: ApiTool }>(`/api/tools`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return body.tool;
}

export async function voteTool(id: string, voter: string): Promise<VoteResult> {
  return request<VoteResult>(`/api/tools/${encodeURIComponent(id)}/vote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ voter }),
  });
}

/** Editorial moderation: approve a pending submission or remove it entirely. */
export async function moderateTool(
  id: string,
  action: "approve" | "reject",
  opts: { featured?: boolean } = {},
): Promise<ModerateResult> {
  return request<ModerateResult>(`/api/tools/${encodeURIComponent(id)}/moderate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, featured: opts.featured }),
  });
}

/** Toggle the editorial "Featured" badge on an approved tool. */
export async function featureTool(id: string, featured: boolean): Promise<{ tool: ApiTool }> {
  return request<{ tool: ApiTool }>(`/api/tools/${encodeURIComponent(id)}/feature`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ featured }),
  });
}

/** Admin metadata edit for a tool (catalog manager). */
export interface ToolUpdatePayload {
  desc?: string;
  replaces?: string;
  cat?: string;
  platforms?: string[];
  selfHosted?: boolean;
  sourceAvailable?: boolean;
  emoji?: string;
  logoUrl?: string | null;
  screenshotUrl?: string | null;
  headerUrl?: string | null;
}

export async function updateTool(id: string, payload: ToolUpdatePayload): Promise<{ tool: ApiTool }> {
  return request<{ tool: ApiTool }>(`/api/tools/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

/* ------------------------------- posts -------------------------------- */

/** Wire format of a blog post (mirrors the server ApiPost). */
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

export interface PostsPage {
  posts: ApiPost[];
  total: number;
}

export interface PostPayload {
  title: string;
  excerpt: string;
  content: string;
  author?: string;
  tags?: string[];
  coverEmoji?: string;
  coverUrl?: string | null;
  /** Edit only: renames the URL slug; old slugs keep resolving (PATCH /api/posts/[id]). */
  slug?: string;
  status?: "draft" | "published";
}

export interface UploadResult {
  url: string;
  mime: string;
  width: number;
  height: number;
}

/**
 * Upload an image (tool branding or blog cover). Accepts PNG/JPEG/GIF/WebP
 * up to 2MB — the server sniffs magic bytes and rejects anything else.
 * Returns the app-relative URL to store in logoUrl/screenshotUrl/headerUrl/
 * coverUrl. Throws ApiError (413/400/429) on rejection.
 */
export async function uploadImage(file: File): Promise<UploadResult> {
  const form = new FormData();
  form.append("file", file);
  return request<UploadResult>("/api/upload", { method: "POST", body: form });
}

/** Public list returns published posts only; `all: true` includes drafts (admin CMS). */
export async function fetchPosts(opts: { all?: boolean } = {}): Promise<PostsPage> {
  return request<PostsPage>(`/api/posts${opts.all ? "?all=1" : ""}`);
}

/** Fetch one post by id or slug (drafts only reachable via id). */
export async function getPost(idOrSlug: string): Promise<ApiPost | null> {
  try {
    return await request<{ post: ApiPost }>(`/api/posts/${encodeURIComponent(idOrSlug)}`)
      .then((b) => b.post);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export async function createPost(payload: PostPayload): Promise<ApiPost> {
  const body = await request<{ post: ApiPost }>(`/api/posts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return body.post;
}

export async function updatePost(id: string, payload: Partial<PostPayload>): Promise<ApiPost> {
  const body = await request<{ post: ApiPost }>(`/api/posts/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return body.post;
}

export async function deletePost(id: string): Promise<{ deleted: boolean }> {
  return request<{ deleted: boolean }>(`/api/posts/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

/* ------------------------------- wants admin --------------------------- */

/** Admin update of a wanted request (status + connected tools). */
export interface WantUpdatePayload {
  status?: "open" | "progress" | "fulfilled";
  connected?: string[];
}

export async function updateWant(id: string, payload: WantUpdatePayload): Promise<{ want: ApiWant }> {
  return request<{ want: ApiWant }>(`/api/wants/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function deleteWant(id: string): Promise<{ deleted: boolean }> {
  return request<{ deleted: boolean }>(`/api/wants/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

/* ------------------------------- wants -------------------------------- */

/** One row on the "Wanted alternatives" board. */
export interface ApiWant {
  id: string;
  target: string;
  note: string | null;
  status: "open" | "progress" | "fulfilled" | string;
  requester: string | null;
  dupes: number;
  votes: number;
  connected: string[];
  createdAt: string;
}

export interface WantsPage {
  wants: ApiWant[];
  total: number;
}

export interface WantRequestPayload {
  target: string;
  note?: string;
  voter: string;
}

export interface WantRequestResult {
  want: ApiWant;
  /** True when the target already existed and the request became a vote. */
  deduped: boolean;
}

export async function fetchWants(sort: "votes" | "newest" = "votes"): Promise<WantsPage> {
  return request<WantsPage>(`/api/wants?sort=${sort}`);
}

export async function createWant(payload: WantRequestPayload): Promise<WantRequestResult> {
  return request<WantRequestResult>(`/api/wants`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function voteWant(id: string, voter: string): Promise<VoteResult> {
  return request<VoteResult>(`/api/wants/${encodeURIComponent(id)}/vote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ voter }),
  });
}

/* -------------------------------- ads --------------------------------- */

/** Wire format of a house/sponsored ad (mirrors the server ApiAd). */
export interface ApiAd {
  id: string;
  name: string;
  headline: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  imageUrl: string | null;
  emoji: string;
  placement: "browse" | "blog" | "wanted" | string;
  active: boolean;
  weight: number;
  impressions: number;
  clicks: number;
  createdAt: string;
  updatedAt: string;
}

export type AdPlacement = "browse" | "blog" | "wanted";

export interface AdPayload {
  name: string;
  headline: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  imageUrl?: string | null;
  emoji?: string;
  placement: AdPlacement;
  active?: boolean;
  weight?: number;
}

/** Public slot: active ads for one placement (weighted rotation server-side). */
export async function fetchAds(placement: AdPlacement, limit = 1): Promise<{ ads: ApiAd[] }> {
  return request<{ ads: ApiAd[] }>(`/api/ads?placement=${placement}&limit=${limit}`);
}

/** Admin list: every ad with its stats. */
export async function fetchAllAds(): Promise<{ ads: ApiAd[]; total: number }> {
  return request<{ ads: ApiAd[]; total: number }>(`/api/ads?all=1`);
}

export async function createAd(payload: AdPayload): Promise<ApiAd> {
  const body = await request<{ ad: ApiAd }>(`/api/ads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return body.ad;
}

export async function updateAd(id: string, payload: Partial<AdPayload>): Promise<ApiAd> {
  const body = await request<{ ad: ApiAd }>(`/api/ads/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return body.ad;
}

export async function deleteAd(id: string): Promise<{ deleted: boolean }> {
  return request<{ deleted: boolean }>(`/api/ads/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

/** Fire-and-forget stats beacon — never throws. */
export function trackAd(id: string, type: "impression" | "click"): void {
  void fetch(`/api/ads/${encodeURIComponent(id)}/track`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type }),
    keepalive: true,
  }).catch(() => undefined);
}

/* ----------------------------- analytics ------------------------------ */

export interface AnalyticsSummary {
  series: { date: string; views: number; visitors: number }[];
  totalViews: number;
  uniqueVisitors: number;
  topPages: { path: string; views: number }[];
}

export async function fetchAnalytics(days = 14): Promise<AnalyticsSummary> {
  return request<AnalyticsSummary>(`/api/analytics?days=${days}`);
}

/** Record one page view — fire-and-forget, never throws. */
export function trackPageView(path: string, session: string): void {
  void fetch(`/api/analytics`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, session }),
    keepalive: true,
  }).catch(() => undefined);
}
