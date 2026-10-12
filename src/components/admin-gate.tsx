"use client";

/* ------------------------------------------------------------------ */
/*  Admin gate — locks the moderation console behind the ADMIN_TOKEN.   */
/*  Verifies the stored token on mount (typos/rotations drop back to    */
/*  the sign-in card), and keeps the sign-in state in localStorage via  */
/*  the same external-store pattern as myVotes/bookmarks.               */
/* ------------------------------------------------------------------ */

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { LockIcon, LogOutIcon, ShieldCheckIcon } from "lucide-react";
import { verifyAdminToken } from "@/lib/aitools/api";
import {
  clearAdminToken,
  getAdminToken,
  getAdminTokenServerSnapshot,
  setAdminToken,
  subscribeAdminToken,
} from "@/lib/aitools/admin-session";

type Phase = "checking" | "locked" | "open";

export function AdminGate({ children }: { children: ReactNode }) {
  const token = useSyncExternalStore(
    subscribeAdminToken,
    getAdminToken,
    getAdminTokenServerSnapshot,
  );
  /* the token that last passed verification — phase is derived from it
     (no setState directly in effects) */
  const [verified, setVerified] = useState<string | null>(null);

  /* verify whatever token we have whenever it changes */
  useEffect(() => {
    if (!token) return;
    let alive = true;
    verifyAdminToken(token).then((status) => {
      if (!alive) return;
      if (status === 200) setVerified(token);
      else {
        /* stale or wrong token — drop it so sign-in shows */
        clearAdminToken();
        setVerified(null);
      }
    });
    return () => {
      alive = false;
    };
  }, [token]);

  const phase: Phase = !token ? "locked" : verified === token ? "open" : "checking";

  if (phase === "open") {
    return (
      <>
        <SignOutPill />
        {children}
      </>
    );
  }

  if (phase === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base text-ink">
        <p className="font-mono text-[13px] text-faint">Verifying admin session…</p>
      </div>
    );
  }

  return <SignInCard />;
}

function SignOutPill() {
  return (
    <button
      onClick={() => clearAdminToken()}
      className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full border border-line bg-card px-3.5 py-2 text-[12px] text-mute transition-colors hover:border-line2 hover:text-ink"
      aria-label="Sign out of the admin console"
    >
      <LogOutIcon className="h-3.5 w-3.5" />
      Sign out
    </button>
  );
}

function SignInCard() {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = value.trim();
    if (!token || busy) return;
    setBusy(true);
    setError(null);
    const status = await verifyAdminToken(token);
    setBusy(false);
    if (status === 200) {
      setAdminToken(token);
      setValue("");
      return;
    }
    if (status === 503) {
      setError("Admin access is not configured on this server (ADMIN_TOKEN missing).");
    } else if (status === 401) {
      setError("That token didn't match. Check ADMIN_TOKEN in your .env.");
    } else if (status === 429) {
      setError("Too many attempts. Wait a minute, then try again.");
    } else {
      setError("Couldn't reach the server. Is the dev server running?");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-base px-5 text-ink">
      <div className="w-full max-w-sm rounded-xl border border-line bg-card p-8">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-elev">
            <LockIcon className="h-4 w-4 text-accent" />
          </span>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-faint">
              AIStore · Admin
            </p>
            <h1 className="text-lg font-bold tracking-tight text-ink">Moderator sign in</h1>
          </div>
        </div>

        <p className="mt-4 text-[13px] leading-relaxed text-mute">
          The review queue, catalog editor, blog CMS and ad manager live behind the
          admin token.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-3">
          <input
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Admin token"
            aria-label="Admin token"
            autoComplete="current-password"
            className="h-10 w-full rounded-lg border border-line bg-elev px-3.5 font-mono text-[13px] text-ink outline-none transition-colors placeholder:text-faint focus:border-line2"
          />
          {error && (
            <p role="alert" className="text-[12px] leading-relaxed text-destructive">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy || !value.trim()}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-accent text-[13px] font-semibold text-zinc-950 transition-colors hover:bg-accent/90 disabled:opacity-50"
          >
            <ShieldCheckIcon className="h-4 w-4" />
            {busy ? "Checking…" : "Enter console"}
          </button>
        </form>

        <p className="mt-5 border-t border-line pt-4 text-[11px] leading-relaxed text-faint">
          Local dev: the token is <span className="font-mono text-mute">ADMIN_TOKEN</span> in
          your <span className="font-mono text-mute">.env</span>. It never leaves this browser
          except as an Authorization header to this server.
        </p>
      </div>
    </div>
  );
}
