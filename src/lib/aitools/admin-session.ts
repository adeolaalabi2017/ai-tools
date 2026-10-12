/* ------------------------------------------------------------------ */
/*  AIStore — admin session                                            */
/*  Bearer token for moderator-only endpoints, kept in localStorage.   */
/*  Same external-store pattern as myVotes/bookmarks: subscribe/       */
/*  snapshot pairs so React reads it with useSyncExternalStore and     */
/*  hydration never mismatches (server snapshot is always empty).      */
/*  api.ts attaches the token to every same-origin /api request.       */
/* ------------------------------------------------------------------ */

const TOKEN_KEY = "aistore-admin";

const listeners = new Set<() => void>();
/* undefined = not read from localStorage yet */
let cache: string | null | undefined;

function readToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/** Current token (client). Cheap: cached after first read. */
export function getAdminToken(): string | null {
  if (cache === undefined) cache = readToken();
  return cache;
}

/** Stable empty value for SSR/hydration. */
export function getAdminTokenServerSnapshot(): string | null {
  return null;
}

export function subscribeAdminToken(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function setAdminToken(token: string): void {
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* storage unavailable — session stays in memory for this page */
  }
  cache = token;
  listeners.forEach((l) => l());
}

export function clearAdminToken(): void {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
  cache = null;
  listeners.forEach((l) => l());
}
