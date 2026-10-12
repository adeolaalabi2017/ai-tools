/* ------------------------------------------------------------------ */
/*  AIStore — rate limiting                                             */
/*  Sliding-window counters kept in the database (RateEvent rows), so   */
/*  throttling and admin sign-in lockouts survive restarts and hold     */
/*  across instances — process memory lost every deploy and silently     */
/*  re-opened the brute-force window.                                    */
/*                                                                       */
/*  One row per counted request; a lazy prune on writes removes rows     */
/*  older than PRUNE_AFTER_MS (nothing counts past its own window).      */
/*  If the counter store is unavailable the limiter refuses the request  */
/*  rather than silently stopping limiting.                              */
/*                                                                       */
/*  Client identity comes from X-Forwarded-For (the Caddyfile overwrites */
/*  it with the real remote host, so it can't be spoofed behind the       */
/*  proxy), then X-Real-IP, then "local" for direct dev access.          */
/* ------------------------------------------------------------------ */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

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

/* rows older than this can never fall inside a policy window again */
const PRUNE_AFTER_MS = 24 * 60 * 60_000;
let lastPruneAt = 0;

export function clientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "local";
}

function tooMany(retryAfterSeconds: number): NextResponse {
  return NextResponse.json(
    { error: "Too many requests. Please slow down and try again shortly." },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
  );
}

function refuseUnavailable(policy: RatePolicy): NextResponse {
  return tooMany(Math.max(1, Math.ceil(policy.windowMs / 1000)));
}

async function countInWindow(bucket: string, ip: string, policy: RatePolicy, now: number): Promise<number> {
  return db.rateEvent.count({
    where: { bucket, ip, createdAt: { gte: new Date(now - policy.windowMs) } },
  });
}

async function oldestInWindow(bucket: string, ip: string, policy: RatePolicy, now: number) {
  const rows = await db.rateEvent.findMany({
    where: { bucket, ip, createdAt: { gte: new Date(now - policy.windowMs) } },
    orderBy: { createdAt: "asc" },
    take: 1,
  });
  return rows[0] ?? null;
}

async function record(bucket: string, ip: string, now: number): Promise<void> {
  await db.rateEvent.create({ data: { bucket, ip } });
  if (now - lastPruneAt > 60_000) {
    lastPruneAt = now;
    await db.rateEvent
      .deleteMany({ where: { createdAt: { lt: new Date(now - PRUNE_AFTER_MS) } } })
      .catch(() => undefined); // pruning is best-effort
  }
}

/**
 * Check-and-record: rejects (429 + Retry-After) when the caller is over the
 * limit, otherwise counts this request and returns null. For endpoints where
 * every request is itself the event being limited (votes, submissions).
 */
export async function enforceRateLimit(
  bucket: string,
  request: Request,
  policy: RatePolicy,
): Promise<NextResponse | null> {
  const ip = clientIp(request);
  const now = Date.now();
  try {
    const hits = await countInWindow(bucket, ip, policy, now);
    if (hits >= policy.limit) {
      /* Retry-After = when the oldest hit in the window ages out */
      const oldest = await oldestInWindow(bucket, ip, policy, now);
      const retryAfter = oldest
        ? Math.max(1, Math.ceil((oldest.createdAt.getTime() + policy.windowMs - now) / 1000))
        : Math.max(1, Math.ceil(policy.windowMs / 1000));
      return tooMany(retryAfter);
    }
    await record(bucket, ip, now);
    return null;
  } catch (error) {
    console.warn("[rate-limit] counter store unavailable — refusing request", error);
    return refuseUnavailable(policy);
  }
}

/**
 * Check-only: returns the 429 when the caller is already over the limit,
 * without recording anything. Pairs with recordFailure for abuse that is
 * only detectable after inspection (e.g. a bad admin token).
 */
export async function rateLimitExceeded(
  bucket: string,
  request: Request,
  policy: RatePolicy,
): Promise<NextResponse | null> {
  const now = Date.now();
  try {
    const hits = await countInWindow(bucket, clientIp(request), policy, now);
    return hits >= policy.limit ? tooMany(Math.max(1, Math.ceil(policy.windowMs / 1000))) : null;
  } catch (error) {
    console.warn("[rate-limit] counter store unavailable — refusing request", error);
    return refuseUnavailable(policy);
  }
}

/** Count one abusive event (e.g. a failed sign-in attempt). */
export async function recordFailure(bucket: string, request: Request): Promise<void> {
  try {
    await record(bucket, clientIp(request), Date.now());
  } catch (error) {
    console.warn("[rate-limit] could not record failure", error);
  }
}

/** Forget a caller's failures (e.g. after a successful sign-in). */
export async function clearFailures(bucket: string, request: Request): Promise<void> {
  try {
    await db.rateEvent.deleteMany({ where: { bucket, ip: clientIp(request) } });
  } catch (error) {
    console.warn("[rate-limit] could not clear failures", error);
  }
}
