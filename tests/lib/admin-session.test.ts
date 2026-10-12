/**
 * admin-session.ts: the localStorage-backed external store behind the sign-in
 * gate. Pins the useSyncExternalStore contract (subscribe/snapshot/server
 * snapshot) and the persistence semantics.
 *
 * Runs in node: localStorage is stubbed per test, module state is reset by
 * re-importing with vi.resetModules().
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function stubLocalStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  });
  return store;
}

async function freshSession() {
  vi.resetModules();
  return import("@/lib/aitools/admin-session");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("admin token store", () => {
  beforeEach(() => {
    stubLocalStorage();
  });

  it("starts empty and round-trips set/get/clear through localStorage", async () => {
    const s = await freshSession();
    expect(s.getAdminToken()).toBeNull();

    s.setAdminToken("tok-123");
    expect(s.getAdminToken()).toBe("tok-123");

    s.clearAdminToken();
    expect(s.getAdminToken()).toBeNull();
  });

  it("notifies subscribers on set and clear, and unsubscribe stops it", async () => {
    const s = await freshSession();
    let notified = 0;
    const unsub = s.subscribeAdminToken(() => notified++);

    s.setAdminToken("a");
    expect(notified).toBe(1);
    s.clearAdminToken();
    expect(notified).toBe(2);

    unsub();
    s.setAdminToken("b");
    expect(notified).toBe(2); // unsubscribed
  });

  it("server snapshot is always empty (hydration safety)", async () => {
    const s = await freshSession();
    s.setAdminToken("client-only");
    expect(s.getAdminTokenServerSnapshot()).toBeNull();
    expect(s.getAdminTokenServerSnapshot()).toBe(s.getAdminTokenServerSnapshot()); // stable
  });

  it("reads a persisted token on first snapshot (reload keeps the session)", async () => {
    const store = stubLocalStorage();
    store.set("aistore-admin", "persisted-token");
    const s = await freshSession();
    expect(s.getAdminToken()).toBe("persisted-token");
  });

  it("survives storage that throws (private mode) — session stays in memory", async () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => {
          throw new Error("denied");
        },
        setItem: () => {
          throw new Error("denied");
        },
        removeItem: () => {
          throw new Error("denied");
        },
      },
    });
    const s = await freshSession();
    expect(s.getAdminToken()).toBeNull(); // read failed → empty
    expect(() => s.setAdminToken("mem-only")).not.toThrow();
    expect(s.getAdminToken()).toBe("mem-only"); // cached in memory regardless
    expect(() => s.clearAdminToken()).not.toThrow();
    expect(s.getAdminToken()).toBeNull();
  });
});
