/* ------------------------------------------------------------------ */
/*  AIStore — typed client for the /api/tools backend                  */
/*  Relative URLs only (same origin). Never throws on parse — throws   */
/*  ApiError for non-2xx so callers can branch on status.              */
/* ------------------------------------------------------------------ */

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
  let res: Response;
  try {
    res = await fetch(url, init);
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
): Promise<ModerateResult> {
  return request<ModerateResult>(`/api/tools/${encodeURIComponent(id)}/moderate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });
}
