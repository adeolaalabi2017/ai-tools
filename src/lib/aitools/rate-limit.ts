/* ------------------------------------------------------------------ */
/*  AIStore — in-memory rate limiting                                  */
/*  Dependency-free sliding window over per-IP buckets. State lives in  */
/*  the Node process: it resets on restart and is per-instance, which   */
/*  is fine for the single standalone server this app runs as. For a    */
/*  multi-instance deployment, move the counters to shared storage.     */
/*                                                                      */
/*  Client identity comes from X-Forwarded-For (the Caddyfile overwrites */
/*  it with the real remote host, so it can't be spoofed behind the      */
/*  proxy), then X-Real-IP, then "local" for direct dev access.          */
/* ------------------------------------------------------------------ */

import { NextResponse } from "next/server";

export interface RatePolicy {
  /** Allowed events per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

/** Failed admin sign-ins per IP: generous for typos, tight for guessing. */
export const ADMIN_AUTH_POLICY: RatePolicy = { limit: 10, windowMs: 15 * 60_000 };
/** Community submissions (tools + wants) per IP. */
export const SUBMIT_POLICY: RatePolicy = { limit: 10, windowMs: 60 * 60_000 };
/** Vote toggles per IP — high enough for enthusiastic browsing. */
export const VOTE_POLICY: RatePolicy = { limit: 120, windowMs: 60 * 60_000 };

/* bucket key → event timestamps (sliding window) */
const buckets = new Map<string, number[]>();
const MAX_KEYS = 5_000;

export function clientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "local";
}

function keyFor(bucket: string, request: Request): string {
  return `${bucket}:${clientIp(request)}`;
}

/** Drop expired timestamps for one key; returns what's still inside the window. */
function freshHits(key: string, windowMs: number, now: number): number[] {
  const hits = buckets.get(key);
  if (!hits) return [];
  const fresh = hits.filter((t) => now - t < windowMs);
  if (fresh.length === 0) buckets.delete(key);
  return fresh;
}

function record(key: string, hits: number[], now: number): void {
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > MAX_KEYS) {
    /* bounded memory: sweep the oldest buckets once the map grows too big */
    const cutoff = now - 60 * 60_000;
    for (const [k, v] of buckets) {
      if (v.length === 0 || v[v.length - 1] < cutoff) buckets.delete(k);
    }
  }
}

function tooMany(hits: number[], policy: RatePolicy, now: number): NextResponse {
  const retryAfter = Math.max(1, Math.ceil((hits[0] + policy.windowMs - now) / 1000));
  return NextResponse.json(
    { error: "Too many requests. Please slow down and try again shortly." },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}

/**
 * Check-and-record: rejects (429 + Retry-After) when the caller is over the
 * limit, otherwise counts this request and returns null. For endpoints where
 * every request is itself the event being limited (votes, submissions).
 */
export function enforceRateLimit(
  bucket: string,
  request: Request,
  policy: RatePolicy,
): NextResponse | null {
  const now = Date.now();
  const key = keyFor(bucket, request);
  const hits = freshHits(key, policy.windowMs, now);
  if (hits.length >= policy.limit) return tooMany(hits, policy, now);
  record(key, hits, now);
  return null;
}

/**
 * Check-only: returns the 429 when the caller is already over the limit,
 * without recording anything. Pairs with recordFailure for abuse that is
 * only detectable after inspection (e.g. a bad admin token).
 */
export function rateLimitExceeded(
  bucket: string,
  request: Request,
  policy: RatePolicy,
): NextResponse | null {
  const now = Date.now();
  const hits = freshHits(keyFor(bucket, request), policy.windowMs, now);
  return hits.length >= policy.limit ? tooMany(hits, policy, now) : null;
}

/** Count one abusive event (e.g. a failed sign-in attempt). */
export function recordFailure(bucket: string, request: Request, policy: RatePolicy): void {
  const key = keyFor(bucket, request);
  record(key, freshHits(key, policy.windowMs, Date.now()), Date.now());
}

/** Forget a caller's failures (e.g. after a successful sign-in). */
export function clearFailures(bucket: string, request: Request): void {
  buckets.delete(keyFor(bucket, request));
}
