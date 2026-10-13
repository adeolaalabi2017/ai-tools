/**
 * Upload lifecycle in S3 storage mode: POST /api/upload stores through the
 * adapter (mocked S3) and hands back a proxy URL; GET /api/uploads/[name]
 * serves the object from storage with immutable caching. Local mode is
 * covered in tests/api/upload.test.ts.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", async () => {
  const { fake } = await import("./fake-db");
  return { db: fake.db };
});

import { NextRequest } from "next/server";
import { POST as upload } from "@/app/api/upload/route";
import { GET as serveUpload } from "@/app/api/uploads/[name]/route";
import { fake } from "./fake-db";

const TOKEN = "test-admin-token-1234567890";
/* full header incl. IHDR: the validator rejects magic-only PNGs as truncated */
const PNG = new Uint8Array(32);
PNG.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
PNG.set([0, 0, 0, 13], 8);
PNG.set([0x49, 0x48, 0x44, 0x52], 12);
new DataView(PNG.buffer).setUint32(16, 320);
new DataView(PNG.buffer).setUint32(20, 240);

let ipSeq = 400;
const nextIp = () => `203.0.113.${++ipSeq}`;

let s3Puts: { key: string; body: Uint8Array }[] = [];

beforeEach(() => {
  process.env.ADMIN_TOKEN = TOKEN;
  process.env.UPLOAD_STORAGE = "s3";
  process.env.UPLOAD_S3_ENDPOINT = "https://s3.storage.test";
  process.env.UPLOAD_S3_BUCKET = "test-bucket";
  process.env.UPLOAD_S3_ACCESS_KEY_ID = "AKID";
  process.env.UPLOAD_S3_SECRET_ACCESS_KEY = "SECRET";
  process.env.UPLOADS_PUBLIC_BASE_URL = "https://cdn.example.com";
  fake.reset();

  /* tiny in-memory S3: captures signed PUTs, serves GETs */
  s3Puts = [];
  vi.stubGlobal("fetch", async (url: string | URL, init?: RequestInit) => {
    const urlText = String(url);
    if (init?.method === "PUT") {
      const key = urlText.replace("https://s3.storage.test/test-bucket/", "");
      s3Puts.push({ key, body: new Uint8Array(await (init.body as ArrayBuffer).slice(0)) });
      return new Response("", { status: 200 });
    }
    const key = urlText.replace("https://s3.storage.test/test-bucket/", "");
    const hit = s3Puts.find((p) => p.key === key);
    if (!hit) return new Response("", { status: 404 });
    return new Response(hit.body.slice().buffer as ArrayBuffer, {
      status: 200,
      headers: { "content-type": "image/png" },
    });
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of [
    "UPLOAD_STORAGE",
    "UPLOAD_S3_ENDPOINT",
    "UPLOAD_S3_BUCKET",
    "UPLOAD_S3_ACCESS_KEY_ID",
    "UPLOAD_S3_SECRET_ACCESS_KEY",
    "UPLOADS_PUBLIC_BASE_URL",
  ]) {
    delete process.env[key];
  }
});

function uploadReq(): NextRequest {
  const fd = new FormData();
  fd.append("file", new File([PNG.slice().buffer as ArrayBuffer], "x.png", { type: "image/png" }));
  return new NextRequest("http://localhost/api/upload", {
    method: "POST",
    headers: { "x-forwarded-for": nextIp() },
    body: fd,
  });
}

describe("upload → proxy round-trip (s3 mode)", () => {
  it("stores into the bucket and serves through /api/uploads with immutable cache", async () => {
    const res = await upload(uploadReq());
    expect(res.status).toBe(201);
    const body = (await res.json()) as { url: string };
    /* PUBLIC_BASE_URL configured → absolute CDN URL (no proxy hop) */
    expect(body.url).toMatch(/^https:\/\/cdn\.example\.com\/[\w-]+\.png$/);

    const name = body.url.split("/").pop()!;
    expect(s3Puts).toHaveLength(1);
    expect(s3Puts[0].key).toBe(name);
    expect(s3Puts[0].body).toEqual(PNG);

    /* now the proxy route resolves the same object from storage */
    const served = await serveUpload(new NextRequest(`http://localhost/api/uploads/${name}`), {
      params: Promise.resolve({ name }),
    });
    expect(served.status).toBe(200);
    expect(served.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(new Uint8Array(await served.arrayBuffer())).toEqual(PNG);
  });

  it("404s unknown or malformed names", async () => {
    const name = `${crypto.randomUUID()}.png`;
    expect(
      (await serveUpload(new NextRequest(`http://localhost/api/uploads/${name}`), {
        params: Promise.resolve({ name }),
      })).status,
    ).toBe(404);
    expect(
      (
        await serveUpload(new NextRequest("http://localhost/api/uploads/../secret"), {
          params: Promise.resolve({ name: "../secret" }),
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await serveUpload(new NextRequest("http://localhost/api/uploads/thing.svg"), {
          params: Promise.resolve({ name: "thing.svg" }),
        })
      ).status,
    ).toBe(404);
  });
});

describe("s3 failure surfaces", () => {
  it("502 with a clear message when the bucket is unreachable", async () => {
    vi.stubGlobal("fetch", async () => new Response("", { status: 503 }));
    const res = await upload(uploadReq());
    expect(res.status).toBe(502);
    expect((await res.json()) as { error: string }).toMatchObject({
      error: "Storage is unavailable. Try again shortly.",
    });
  });

  it("500 with operator guidance when the s3 env is incomplete", async () => {
    delete process.env.UPLOAD_S3_ENDPOINT;
    const res = await upload(uploadReq());
    expect(res.status).toBe(500);
    const err = (await res.json()) as { error: string };
    expect(err.error).toMatch(/not configured/i);
  });
});
