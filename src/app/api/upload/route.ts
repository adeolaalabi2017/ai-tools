/* ------------------------------------------------------------------ */
/*  POST /api/upload — image upload for tool branding + blog covers     */
/*                                                                       */
/*  Anonymous submitters may upload (that is the point of the branding   */
/*  fields), so the guardrails are strict: 2MB cap, raster formats only  */
/*  (magic-byte checked — SVG is a script carrier and stays excluded),   */
/*  decoded-size ceiling, random filenames. Admins bypass the rate      */
/*  limit; everyone else shares the upload budget per IP.                */
/*                                                                       */
/*  Files land in public/uploads (UPLOAD_DIR overrides for tests),       */
/*  served statically at /uploads/<name>.                                */
/* ------------------------------------------------------------------ */

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthorized } from "@/lib/aitools/server";
import { enforceRateLimit, UPLOAD_POLICY } from "@/lib/aitools/rate-limit";
import { MAX_PIXELS, MAX_UPLOAD_BYTES, sniffImage } from "@/lib/aitools/image-validate";
import { getUploadStore, newUploadName, UploadStorageConfigError } from "@/lib/aitools/upload-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    if (!isAdminAuthorized(request)) {
      const limited = await enforceRateLimit("upload", request, UPLOAD_POLICY);
      if (limited) return limited;
    }

    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Attach an image as the 'file' form field." },
        { status: 400 },
      );
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "The file is empty." }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "Images must be 2MB or smaller." },
        { status: 413 },
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const info = sniffImage(bytes);
    if (!info) {
      return NextResponse.json(
        { error: "Only PNG, JPEG, GIF and WebP images are supported." },
        { status: 400 },
      );
    }
    if (info.width * info.height > MAX_PIXELS) {
      return NextResponse.json(
        { error: `Images must be ${Math.floor(MAX_PIXELS / 1_000_000)} megapixels or smaller.` },
        { status: 400 },
      );
    }

    /* storage adapter decides where bytes live (local disk / S3-compatible);
       UUID names mean no client input ever reaches a storage path */
    let stored;
    try {
      stored = await getUploadStore().put(newUploadName(info.kind), bytes);
    } catch (error) {
      if (error instanceof UploadStorageConfigError) {
        console.error("[POST /api/upload] storage misconfigured", error);
        return NextResponse.json(
          { error: "Storage is not configured correctly." },
          { status: 500 },
        );
      }
      console.error("[POST /api/upload] storage write failed", error);
      return NextResponse.json(
        { error: "Storage is unavailable. Try again shortly." },
        { status: 502 },
      );
    }

    return NextResponse.json(
      {
        url: stored.url,
        mime: info.mime,
        width: info.width,
        height: info.height,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[POST /api/upload]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
