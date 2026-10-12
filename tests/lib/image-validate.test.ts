/**
 * Image sniffing (src/lib/aitools/image-validate.ts): magic-byte
 * identification and dimension parsing for the four accepted formats.
 * Synthetic headers stand in for real files — only the bytes the parser
 * reads matter. Unknown/spoofed/truncated input must return null.
 */

import { describe, expect, it } from "vitest";
import { sniffImage, MAX_PIXELS, MAX_UPLOAD_BYTES } from "@/lib/aitools/image-validate";

function png(width: number, height: number): Uint8Array {
  const b = new Uint8Array(32);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  b.set([0, 0, 0, 13], 8); // IHDR length
  b.set([0x49, 0x48, 0x44, 0x52], 12); // "IHDR"
  new DataView(b.buffer).setUint32(16, width);
  new DataView(b.buffer).setUint32(20, height);
  return b;
}

function jpeg(width: number, height: number): Uint8Array {
  const b = new Uint8Array(16);
  b.set([0xff, 0xd8, 0xff, 0xc0], 0); // SOI + SOF0
  b.set([0, 17], 4); // segment length
  b[6] = 8; // precision
  new DataView(b.buffer).setUint16(7, height);
  new DataView(b.buffer).setUint16(9, width);
  return b;
}

function gif(width: number, height: number): Uint8Array {
  const b = new Uint8Array(13);
  b.set([0x47, 0x49, 0x46, 0x38, 0x39, 0x61], 0); // GIF89a
  new DataView(b.buffer).setUint16(6, width, true);
  new DataView(b.buffer).setUint16(8, height, true);
  return b;
}

function webpLossless(width: number, height: number): Uint8Array {
  const b = new Uint8Array(32);
  b.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
  b.set([0x57, 0x45, 0x42, 0x50], 8); // WEBP
  b.set([0x56, 0x50, 0x38, 0x4c], 12); // VP8L
  b[20] = 0x2f; // signature
  /* 14-bit width-1 / height-1, packed little-endian */
  const w = width - 1;
  const h = height - 1;
  b[21] = w & 0xff;
  b[22] = ((w >> 8) & 0x3f) | ((h & 0x3) << 6);
  b[23] = (h >> 2) & 0xff;
  b[24] = (h >> 10) & 0x0f;
  return b;
}

describe("sniffImage — accepted formats", () => {
  it("identifies PNG and reads IHDR dimensions", () => {
    expect(sniffImage(png(320, 240))).toEqual({
      kind: "png",
      mime: "image/png",
      width: 320,
      height: 240,
    });
  });

  it("identifies JPEG and walks to the SOF marker", () => {
    expect(sniffImage(jpeg(1280, 720))).toMatchObject({
      kind: "jpg",
      mime: "image/jpeg",
      width: 1280,
      height: 720,
    });
  });

  it("identifies GIF87a/89a and reads the logical screen size", () => {
    expect(sniffImage(gif(64, 64))).toMatchObject({ kind: "gif", width: 64, height: 64 });
  });

  it("identifies lossless WebP (VP8L) and unpacks 14-bit dimensions", () => {
    expect(sniffImage(webpLossless(512, 256))).toMatchObject({
      kind: "webp",
      width: 512,
      height: 256,
    });
  });
});

describe("sniffImage — rejections", () => {
  it("rejects unknown and spoofed content", () => {
    expect(sniffImage(new TextEncoder().encode("<svg onload=alert(1)></svg>"))).toBeNull(); // SVG: a script carrier
    expect(sniffImage(new TextEncoder().encode("GIF7 not-a-gif"))).toBeNull(); // wrong version byte
    expect(sniffImage(new TextEncoder().encode("hello, plain text"))).toBeNull();
    expect(sniffImage(new Uint8Array(0))).toBeNull();
  });

  it("rejects truncated headers", () => {
    expect(sniffImage(png(10, 10).slice(0, 12))).toBeNull();
    expect(sniffImage(new Uint8Array([0xff, 0xd8, 0xff]))).toBeNull(); // JPEG SOI only
  });

  it("rejects zero or unparseable dimensions", () => {
    expect(sniffImage(png(0, 100))).toBeNull();
    const noIhdr = png(10, 10);
    noIhdr[12] = 0x58; // corrupt "IHDR"
    expect(sniffImage(noIhdr)).toBeNull();
  });
});

describe("limits", () => {
  it("caps uploads at 2MB and decoded bitmaps at 25 megapixels", () => {
    expect(MAX_UPLOAD_BYTES).toBe(2 * 1024 * 1024);
    expect(MAX_PIXELS).toBe(25_000_000);
    /* a header claiming 30000x30000 is sniffable but rejected by the route */
    const bomb = png(30_000, 30_000);
    expect(sniffImage(bomb)).toMatchObject({ width: 30_000, height: 30_000 });
  });
});
