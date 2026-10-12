/**
 * POST /api/upload: the image-upload contract. Files land in UPLOAD_DIR
 * (pointed at a tmp dir here) with server-generated names; validation is
 * strict — size cap, magic bytes, pixel ceiling. Anonymous callers share
 * a rate budget; admins bypass it.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

vi.mock("@/lib/db", async () => {
  const { fake } = await import("./fake-db");
  return { db: fake.db };
});

import { NextRequest } from "next/server";
import { POST as upload } from "@/app/api/upload/route";
import { fake } from "./fake-db";

const TOKEN = "test-admin-token-1234567890";

let ipSeq = 300;
const nextIp = () => `203.0.113.${++ipSeq}`;

let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "aistore-uploads-"));
  process.env.UPLOAD_DIR = dir;
});

afterAll(async () => {
  delete process.env.UPLOAD_DIR;
  await rm(dir, { recursive: true, force: true });
});

beforeEach(() => {
  process.env.ADMIN_TOKEN = TOKEN;
  fake.reset();
});

afterEach(() => {
  delete process.env.ADMIN_TOKEN;
});

/* minimal valid PNG header (32 bytes) */
function pngBytes(width = 320, height = 240): Uint8Array<ArrayBuffer> {
  const b = new Uint8Array(32);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  b.set([0, 0, 0, 13], 8);
  b.set([0x49, 0x48, 0x44, 0x52], 12);
  new DataView(b.buffer).setUint32(16, width);
  new DataView(b.buffer).setUint32(20, height);
  return b;
}

function uploadReq(opts: {
  file?: Uint8Array<ArrayBuffer> | string;
  name?: string;
  type?: string;
  ip?: string;
  token?: string;
}): NextRequest {
  const fd = new FormData();
  if (opts.file !== undefined) {
    const part =
      typeof opts.file === "string"
        ? new File([opts.file], opts.name ?? "x.txt", { type: opts.type ?? "text/plain" })
        : new File([opts.file], opts.name ?? "x.png", { type: opts.type ?? "image/png" });
    fd.append("file", part);
  }
  const headers: Record<string, string> = {};
  if (opts.ip) headers["x-forwarded-for"] = opts.ip;
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  return new NextRequest("http://localhost/api/upload", {
    method: "POST",
    headers,
    body: fd,
  });
}

describe("successful uploads", () => {
  it("201s, stores the file under a generated name, returns the public URL", async () => {
    const res = await upload(uploadReq({ file: pngBytes(), ip: nextIp() }));
    expect(res.status).toBe(201);
    const body = (await res.json()) as { url: string; mime: string; width: number; height: number };
    expect(body).toMatchObject({ mime: "image/png", width: 320, height: 240 });
    expect(body.url).toMatch(/^\/uploads\/[\w-]+\.png$/);

    /* the file exists on disk under exactly the returned name */
    const stored = body.url.replace("/uploads/", "");
    expect(await readdir(dir)).toContain(stored);
  });

  it("generates a fresh name per upload (no client input in the path)", async () => {
    const evilName = "../../escape.png";
    const a = (await (await upload(uploadReq({ file: pngBytes(), name: evilName, ip: nextIp() }))).json()) as {
      url: string;
    };
    const b = (await (await upload(uploadReq({ file: pngBytes(), name: evilName, ip: nextIp() }))).json()) as {
      url: string;
    };
    expect(a.url).not.toBe(b.url);
    expect(a.url).not.toContain("..");
  });
});

describe("rejections", () => {
  it("400 with no file or an empty file", async () => {
    expect((await upload(uploadReq({ ip: nextIp() }))).status).toBe(400);
    expect((await upload(uploadReq({ file: new Uint8Array(0), ip: nextIp() }))).status).toBe(400);
  });

  it("413 over the 2MB cap (checked before parsing)", async () => {
    const big = new Uint8Array(2 * 1024 * 1024 + 1);
    expect((await upload(uploadReq({ file: big, ip: nextIp() }))).status).toBe(413);
  });

  it("400 for non-images and SVG (a script carrier)", async () => {
    expect(
      (await upload(uploadReq({ file: "<svg onload=alert(1)></svg>", name: "x.svg", type: "image/svg+xml", ip: nextIp() })))
        .status,
    ).toBe(400);
    /* PNG magic bytes with a GIF extension still validate as PNG — bytes win */
    const res = await upload(uploadReq({ file: pngBytes(), name: "fake.gif", type: "image/gif", ip: nextIp() }));
    expect(res.status).toBe(201);
  });

  it("400 for a decompression bomb (dimensions over the ceiling)", async () => {
    const bomb = pngBytes(30_000, 30_000); // 900 MP claimed
    expect((await upload(uploadReq({ file: bomb, ip: nextIp() }))).status).toBe(400);
  });
});

describe("rate limiting", () => {
  it("locks an anonymous IP after the budget — even request shape doesn't matter", async () => {
    const ip = nextIp();
    let last: number | undefined;
    for (let i = 0; i < 21; i++) {
      /* no file at all: the limiter counts before parsing */
      last = (await upload(uploadReq({ ip }))).status;
      if (i < 20) expect(last).toBe(400);
    }
    expect(last).toBe(429);
  });

  it("admins bypass the upload budget", async () => {
    const ip = nextIp();
    for (let i = 0; i < 25; i++) {
      const res = await upload(uploadReq({ ip, token: TOKEN }));
      expect(res.status).not.toBe(429); // 400 (no file) is fine — never throttled
    }
  });
});
