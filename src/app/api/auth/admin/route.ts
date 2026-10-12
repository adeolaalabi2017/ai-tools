/* ------------------------------------------------------------------ */
/*  /api/auth/admin — admin session check                              */
/*  Verifies `Authorization: Bearer <ADMIN_TOKEN>`. The login screen    */
/*  calls this before storing a token, so a typo never persists.        */
/*  Goes through requireAdmin so failed attempts share the same        */
/*  per-IP rate limit as the other admin routes.                        */
/* ------------------------------------------------------------------ */

import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/aitools/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  return NextResponse.json({ ok: true });
}
