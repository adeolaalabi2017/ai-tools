/* ------------------------------------------------------------------ */
/*  AIStore — image upload validation                                   */
/*  Dependency-free sniffing for the formats uploads accept. Only      */
/*  raster formats (PNG/JPEG/GIF/WebP) — SVG is deliberately excluded   */
/*  because it is a script carrier when served same-origin.             */
/*                                                                      */
/*  Dimensions are parsed from the container headers so decompression   */
/*  bombs are rejected before the file is ever stored or rendered.      */
/* ------------------------------------------------------------------ */

export type ImageKind = "png" | "jpg" | "gif" | "webp";

export interface ImageInfo {
  kind: ImageKind;
  mime: string;
  width: number;
  height: number;
}

/** Hard cap on stored bytes (the UI is logos/screenshots, not photos). */
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

/** Reject images whose decoded bitmap would exceed this (bomb guard). */
export const MAX_PIXELS = 25_000_000;

const MIME: Record<ImageKind, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

function be16(b: Uint8Array, i: number): number {
  return (b[i]! << 8) | b[i + 1]!;
}

function le16(b: Uint8Array, i: number): number {
  return b[i]! | (b[i + 1]! << 8);
}

function le24(b: Uint8Array, i: number): number {
  return b[i]! | (b[i + 1]! << 8) | (b[i + 2]! << 16);
}

function startsWith(b: Uint8Array, bytes: number[], offset = 0): boolean {
  return bytes.every((byte, i) => b[offset + i] === byte);
}

function pngSize(b: Uint8Array): { width: number; height: number } | null {
  /* signature (8) + IHDR (4) + length (4) → width/height big-endian */
  if (b.length < 24 || !startsWith(b, [0x49, 0x48, 0x44, 0x52], 12)) return null;
  return { width: be16(b, 16) * 65536 + be16(b, 18), height: be16(b, 20) * 65536 + be16(b, 22) };
}

function jpegSize(b: Uint8Array): { width: number; height: number } | null {
  /* walk the segment chain to a Start-Of-Frame marker */
  let pos = 2;
  while (pos + 9 < b.length) {
    if (b[pos] !== 0xff) return null;
    const marker = b[pos + 1]!;
    /* standalone markers carry no length */
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      pos += 2;
      continue;
    }
    const isSof =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      return { width: be16(b, pos + 7), height: be16(b, pos + 5) };
    }
    pos += 2 + be16(b, pos + 2);
  }
  return null;
}

function gifSize(b: Uint8Array): { width: number; height: number } | null {
  if (b.length < 10) return null;
  return { width: le16(b, 6), height: le16(b, 8) };
}

function webpSize(b: Uint8Array): { width: number; height: number } | null {
  if (b.length < 30) return null;
  const chunk = String.fromCharCode(b[12]!, b[13]!, b[14]!, b[15]!);
  if (chunk === "VP8 ") {
    /* lossy: sync code then 14-bit width/height */
    return { width: le16(b, 26) & 0x3fff, height: le16(b, 28) & 0x3fff };
  }
  if (chunk === "VP8L") {
    /* lossless: 14-bit width-1 / height-1 packed little-endian */
    const width = 1 + (b[21]! | ((b[22]! & 0x3f) << 8));
    const height = 1 + ((b[22]! >> 6) | (b[23]! << 2) | ((b[24]! & 0x0f) << 10));
    return { width, height };
  }
  if (chunk === "VP8X") {
    /* extended: 24-bit canvas size - 1 */
    return { width: le24(b, 24) + 1, height: le24(b, 27) + 1 };
  }
  return null;
}

/**
 * Identify an image by its magic bytes and read its declared dimensions.
 * Returns null for anything that is not a well-formed PNG/JPEG/GIF/WebP
 * header — unknown, truncated, or spoofed files are rejected outright.
 */
export function sniffImage(buf: Uint8Array): ImageInfo | null {
  let kind: ImageKind | null = null;
  let size: { width: number; height: number } | null = null;

  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    kind = "png";
    size = pngSize(buf);
  } else if (startsWith(buf, [0xff, 0xd8, 0xff])) {
    kind = "jpg";
    size = jpegSize(buf);
  } else if (
    startsWith(buf, [0x47, 0x49, 0x46, 0x38]) &&
    (buf[4] === 0x37 || buf[4] === 0x39) &&
    buf[5] === 0x61
  ) {
    kind = "gif";
    size = gifSize(buf);
  } else if (
    startsWith(buf, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(buf, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    kind = "webp";
    size = webpSize(buf);
  }

  if (!kind || !size) return null;
  if (size.width <= 0 || size.height <= 0) return null;
  return { kind, mime: MIME[kind], width: size.width, height: size.height };
}
