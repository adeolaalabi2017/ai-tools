/**
 * Request builders for driving route handlers directly (no HTTP server).
 * Handlers read request.nextUrl / request.headers / request.json() and take
 * `{ params: Promise<...> }` as their second argument.
 */

import { NextRequest } from "next/server";

export function jsonRequest(
  url: string,
  opts: {
    method?: string;
    body?: unknown;
    token?: string;
    ip?: string;
  } = {},
): NextRequest {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  if (opts.ip) headers["x-forwarded-for"] = opts.ip;
  return new NextRequest(`http://localhost${url}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

/** Second route-handler argument: `{ params: Promise<{ id }> }` */
export function withId(id: string) {
  return { params: Promise.resolve({ id }) };
}

export async function readJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>;
}
