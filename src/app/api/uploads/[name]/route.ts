/* ------------------------------------------------------------------ */
/*  GET /api/uploads/[name] — serves uploaded objects through the       */
/*  storage adapter when they are not on local static disk (S3 mode).   */
/*  Names are server-generated (<uuid>.<ext>) and immutable, so the     */
/*  response can be cached aggressively.                                */
/* ------------------------------------------------------------------ */

import { NextResponse, type NextRequest } from "next/server";
import { getUploadStore, UPLOAD_NAME_RE } from "@/lib/aitools/upload-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  try {
    const { name } = await params;
    if (!UPLOAD_NAME_RE.test(name)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const obj = await getUploadStore().get(name);
    if (!obj) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    /* Uint8Array is a valid BodyInit at runtime; TS 5.7+ lib types narrow
       BlobPart to ArrayBuffer-backed views, so hand the exact buffer over */
    return new Response(obj.bytes.slice().buffer as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": obj.mime,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("[GET /api/uploads/:name]", error);
    return NextResponse.json({ error: "Storage unavailable" }, { status: 502 });
  }
}
