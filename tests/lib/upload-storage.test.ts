/**
 * Upload storage adapters (src/lib/aitools/upload-storage.ts):
 * local disk round-trip, S3 signing wire, URL selection (proxy vs
 * public CDN base), and env-driven adapter selection.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { getUploadStore, UPLOAD_NAME_RE } from "@/lib/aitools/upload-storage";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
let dir: string;
const envBackup = new Map<string, string | undefined>();

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "aistore-store-"));
  for (const key of [
    "UPLOAD_DIR",
    "UPLOAD_STORAGE",
    "UPLOAD_S3_ENDPOINT",
    "UPLOAD_S3_BUCKET",
    "UPLOAD_S3_REGION",
    "UPLOAD_S3_ACCESS_KEY_ID",
    "UPLOAD_S3_SECRET_ACCESS_KEY",
    "UPLOAD_S3_SESSION_TOKEN",
    "UPLOAD_S3_KEY_PREFIX",
    "UPLOADS_PUBLIC_BASE_URL",
  ]) {
    envBackup.set(key, process.env[key]);
    delete process.env[key];
  }
});

afterEach(async () => {
  for (const [key, value] of envBackup) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  envBackup.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  await rm(dir, { recursive: true, force: true });
});

function s3Env() {
  process.env.UPLOAD_STORAGE = "s3";
  process.env.UPLOAD_S3_ENDPOINT = "https://s3.storage.test";
  process.env.UPLOAD_S3_BUCKET = "test-bucket";
  process.env.UPLOAD_S3_ACCESS_KEY_ID = "AKID";
  process.env.UPLOAD_S3_SECRET_ACCESS_KEY = "SECRET";
}

describe("UPLOAD_NAME_RE", () => {
  it("accepts only server-shaped names (uuid.ext)", () => {
    expect(UPLOAD_NAME_RE.test(`${crypto.randomUUID()}.png`)).toBe(true);
    expect(UPLOAD_NAME_RE.test("../escape.png")).toBe(false);
    expect(UPLOAD_NAME_RE.test("thing.svg")).toBe(false);
    expect(UPLOAD_NAME_RE.test("thing.png.txt")).toBe(false);
    expect(UPLOAD_NAME_RE.test("")).toBe(false);
  });
});

describe("local adapter (default)", () => {
  it("writes into UPLOAD_DIR and returns the static URL", async () => {
    process.env.UPLOAD_DIR = dir;
    const store = getUploadStore();
    const stored = await store.put("abc.png", PNG);

    expect(stored.url).toBe("/uploads/abc.png");
    /* content compare — readFile's Buffer wrapper is a Uint8Array subclass
       and vitest's toEqual discriminates it from a plain Uint8Array */
    const onDisk = await readFile(path.join(dir, "abc.png"));
    expect(Array.from(onDisk)).toEqual(Array.from(PNG));

    const got = await store.get("abc.png");
    expect(got?.mime).toBe("image/png");
    expect(Array.from(got?.bytes ?? [])).toEqual(Array.from(PNG));
  });

  it("returns null for missing files", async () => {
    process.env.UPLOAD_DIR = dir;
    expect(await getUploadStore().get("nope.png")).toBeNull();
  });
});

describe("s3 adapter", () => {
  function capture() {
    const calls: { url: string; init?: RequestInit }[] = [];
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return new Response("", { status: 200 });
    });
    return calls;
  }

  it("PUTs signed requests to the bucket and proxies the URL by default", async () => {
    s3Env();
    const calls = capture();
    const stored = await getUploadStore().put("abc.png", PNG);

    expect(stored.url).toBe("/api/uploads/abc.png");
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://s3.storage.test/test-bucket/abc.png");
    const headers = new Headers(calls[0].init?.headers);
    expect(headers.get("content-type")).toBe("image/png");
    expect(headers.get("authorization")).toMatch(/^AWS4-HMAC-SHA256 Credential=AKID\//);
  });

  it("returns the public CDN URL when a public base is configured", async () => {
    s3Env();
    process.env.UPLOAD_S3_KEY_PREFIX = "aistore/";
    process.env.UPLOADS_PUBLIC_BASE_URL = "https://cdn.example.com";
    const calls = capture();

    const stored = await getUploadStore().put("abc.png", PNG);
    expect(stored.url).toBe("https://cdn.example.com/aistore/abc.png");
    expect(calls[0].url).toBe("https://s3.storage.test/test-bucket/aistore/abc.png");
  });

  it("get: streams the object, maps 404 to null", async () => {
    s3Env();
    const calls: { url: string; init?: RequestInit }[] = [];
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (calls.length === 1) {
        return new Response(PNG.slice().buffer as ArrayBuffer, {
          status: 200,
          headers: { "content-type": "image/png" },
        });
      }
      return new Response("", { status: 404 });
    });

    const store = getUploadStore();
    const got = await store.get("abc.png");
    expect(got?.mime).toBe("image/png");
    expect((got?.bytes as Uint8Array)).toEqual(PNG);
    expect(calls[0].init?.method).toBe("GET");

    expect(await store.get("gone.png")).toBeNull();
  });

  it("surfaces a failed PUT as a thrown error (route maps to 502)", async () => {
    s3Env();
    vi.stubGlobal("fetch", async () => new Response("nope", { status: 500 }));
    await expect(getUploadStore().put("abc.png", PNG)).rejects.toThrow(/S3 put failed: 500/);
  });
});

describe("adapter selection", () => {
  function capture() {
    const calls: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      calls.push(String(url));
      return new Response("", { status: 200 });
    });
    return calls;
  }

  it("local by default; s3 only when configured", async () => {
    process.env.UPLOAD_DIR = dir;
    const local = getUploadStore();
    const stored = await local.put("abc.png", PNG);
    expect(stored.url).toBe("/uploads/abc.png"); // static path, not the proxy

    s3Env();
    const calls = capture(); // s3 domain is not real — never hit the network
    const storedS3 = await getUploadStore().put("abc.png", PNG);
    expect(storedS3.url).not.toBe("/uploads/abc.png");
    expect(calls[0]).toContain("test-bucket/abc.png");
  });

  it("misconfigured s3 throws a clear operator error", () => {
    process.env.UPLOAD_STORAGE = "s3";
    expect(() => getUploadStore()).toThrow(/UPLOAD_S3_ENDPOINT and UPLOAD_S3_BUCKET/);
  });
});
