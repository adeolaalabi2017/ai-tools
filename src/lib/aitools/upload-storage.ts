/* ------------------------------------------------------------------ */
/*  AIStore — upload storage adapters (EmDash-style storage ports)      */
/*  local disk is the zero-config default; S3-compatible storage        */
/*  (R2/MinIO/B2/Scaleway/AWS) makes uploads survive redeploys.        */
/*                                                                      */
/*  Serving: names are server-generated UUIDs, so objects are immutable */
/*  and the proxy route can cache them for a year. In S3 mode the       */
/*  returned URL is either the public base (CDN) or the app's proxy.    */
/* ------------------------------------------------------------------ */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { S3Config } from "./s3-sign";
import { mimeFor, signS3Request } from "./s3-sign";

export interface StoredFile {
  /** The URL to persist in the DB (denylist-validated downstream). */
  url: string;
}

/** Raised when the *operator's* storage env is wrong (distinct from a
 *  transient store outage so the route can answer differently). */
export class UploadStorageConfigError extends Error {}

export interface UploadStore {
  put(name: string, bytes: Uint8Array): Promise<StoredFile>;
  get(name: string): Promise<{ bytes: Uint8Array; mime: string } | null>;
}

export const UPLOAD_NAME_RE = /^[\w-]+\.(png|jpg|gif|webp)$/;

/** Server-generated, extension-correct, collision-proof object name. */
export function newUploadName(kind: string): string {
  return `${randomUUID()}.${kind}`;
}

/* ------------------------------ local -------------------------------- */

function localDir(): string {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), "public", "uploads");
}

function localStore(): UploadStore {
  return {
    async put(name: string, bytes: Uint8Array) {
      const dir = localDir();
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, name), bytes);
      /* dev serves public/ directly; the deploy copies public/ into the
         artifact, so it works there too (ephemeral across redeploys) */
      return { url: `/uploads/${name}` };
    },
    async get(name: string) {
      try {
        const raw = await readFile(path.join(localDir(), name));
        /* plain Uint8Array, not node Buffer — consumers compare/stream it */
        return { bytes: new Uint8Array(raw), mime: mimeFor(name) };
      } catch {
        return null;
      }
    },
  };
}

/* ------------------------------- S3 ---------------------------------- */

function readS3Config(): S3Config {
  const endpoint = process.env.UPLOAD_S3_ENDPOINT?.trim();
  const bucket = process.env.UPLOAD_S3_BUCKET?.trim();
  if (!endpoint || !bucket) {
    /* selection is env-gated; a clear operator error, not a user error */
    throw new UploadStorageConfigError(
      "UPLOAD_STORAGE=s3 requires UPLOAD_S3_ENDPOINT and UPLOAD_S3_BUCKET",
    );
  }
  return {
    endpoint,
    bucket,
    region: process.env.UPLOAD_S3_REGION?.trim() || "us-east-1",
    accessKeyId: process.env.UPLOAD_S3_ACCESS_KEY_ID?.trim() || "",
    secretAccessKey: process.env.UPLOAD_S3_SECRET_ACCESS_KEY?.trim() || "",
    sessionToken: process.env.UPLOAD_S3_SESSION_TOKEN?.trim() || undefined,
    keyPrefix: process.env.UPLOAD_S3_KEY_PREFIX?.replace(/\/*$/, "/") || "",
    publicBaseUrl: process.env.UPLOADS_PUBLIC_BASE_URL?.trim().replace(/\/+$/, "") || undefined,
  };
}

function s3Store(cfg: S3Config): UploadStore {
  const keyOf = (name: string) => `${cfg.keyPrefix ?? ""}${name}`;

  return {
    async put(name: string, bytes: Uint8Array) {
      const req = signS3Request(cfg, "PUT", keyOf(name), bytes);
      /* runtime accepts any ArrayBufferView; the DOM lib types (TS 5.7+
         generic typed arrays) disagree with Uint8Array<ArrayBufferLike> */
      const res = await fetch(req.url, {
        method: req.method,
        headers: req.headers,
        body: bytes as unknown as BodyInit,
      });
      if (!res.ok) {
        throw new Error(`S3 put failed: ${res.status} ${await res.text().catch(() => "")}`);
      }
      return {
        url: cfg.publicBaseUrl
          ? `${cfg.publicBaseUrl}/${keyOf(name)}`
          : `/api/uploads/${name}`, // proxied by /api/uploads/[name], immutable-cache
      };
    },
    async get(name: string) {
      const req = signS3Request(cfg, "GET", keyOf(name), new Uint8Array(0));
      const res = await fetch(req.url, { method: req.method, headers: req.headers });
      if (res.status === 404) return null;
      if (!res.ok) {
        throw new Error(`S3 get failed: ${res.status}`);
      }
      return { bytes: new Uint8Array(await res.arrayBuffer()), mime: mimeFor(name) };
    },
  };
}

/* ---------------------------- selection ------------------------------ */

/** Fresh per call so tests (and cavity operators) can switch by env. */
export function getUploadStore(): UploadStore {
  const mode = process.env.UPLOAD_STORAGE?.trim() || "local";
  if (mode === "s3") return s3Store(readS3Config());
  return localStore();
}
