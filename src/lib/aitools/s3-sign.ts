/* ------------------------------------------------------------------ */
/*  AIStore — AWS SigV4 signing for S3-compatible object storage        */
/*  Dependency-free (node:crypto). Header-signed PUT/GET for the        */
/*  upload-store adapter — enough for R2, MinIO, B2, Scaleway and AWS   */
/*  with path-style addressing. No presigned URLs (uploads go through   */
/*  our authenticated API; serving is proxied or CDN-direct).           */
/* ------------------------------------------------------------------ */

import { createHash, createHmac } from "node:crypto";

export interface S3Config {
  /** Origin only, e.g. https://<accountid>.r2.cloudflarestorage.com */
  endpoint: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  /** Optional key prefix inside the bucket, e.g. "uploads/" */
  keyPrefix?: string;
  /** Optional public base (CDN / bucket website) — uploads return this URL
   *  directly instead of being proxied through the app. */
  publicBaseUrl?: string;
}

const EMPTY_SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

/** RFC 3986 encode: keep A–Z a–z 0–9 - . _ ~ (AWS canonical rules). */
function awsEncode(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/** Absolute object URL, path-style: <endpoint>/<bucket>/<encoded key>. */
export function s3ObjectUrl(cfg: S3Config, key: string): string {
  const path = [cfg.bucket, ...key.split("/").map(awsEncode)].map((seg) => seg).join("/");
  return `${cfg.endpoint.replace(/\/+$/, "")}/${path}`;
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

function sha256Hex(data: Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

/** <bucket>/<key> as the canonical URI (every path segment AWS-encoded). */
function canonicalUri(cfg: S3Config, key: string): string {
  return `/${[cfg.bucket, ...key.split("/").map(awsEncode)].join("/")}`;
}

export interface SignedRequest {
  url: string;
  method: "PUT" | "GET";
  headers: Record<string, string>;
}

/**
 * Header-signed request for one object. Only the minimum header set is
 * signed; Content-Type joins the signature for PUT so the stored object
 * keeps its media type.
 */
export function signS3Request(
  cfg: S3Config,
  method: "PUT" | "GET",
  key: string,
  body: Uint8Array,
  now = new Date(),
): SignedRequest {
  const url = s3ObjectUrl(cfg, key);
  const host = new URL(url).host;

  const amzDate = `${now.toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`; // YYYYMMDDTHHMMSSZ
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = body.length === 0 ? EMPTY_SHA256 : sha256Hex(body);

  const headers: Record<string, string> = {
    host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
    ...(cfg.sessionToken ? { "x-amz-security-token": cfg.sessionToken } : {}),
  };
  if (method === "PUT") headers["content-type"] = mimeFor(key);

  /* canonical headers must be sorted by lowercase name */
  const headerNames = Object.keys(headers).sort();
  const canonicalHeaders = headerNames.map((h) => `${h}:${headers[h]!.trim()}\n`).join("");
  const signedHeaders = headerNames.join(";");

  const canonicalRequest = [
    method,
    canonicalUri(cfg, key),
    "", // no query string for single-object operations
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const scope = `${dateStamp}/${cfg.region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    createHash("sha256").update(canonicalRequest, "utf8").digest("hex"),
  ].join("\n");

  const keychain = hmac(hmac(hmac(hmac(`AWS4${cfg.secretAccessKey}`, dateStamp), cfg.region), "s3"), "aws4_request");
  const signature = createHmac("sha256", keychain).update(stringToSign, "utf8").digest("hex");

  return {
    url,
    method,
    headers: {
      ...headers,
      Authorization: `AWS4-HMAC-SHA256 Credential=${cfg.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
  };
}

const EXT_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

/** Media type derived from the (server-generated) file extension. */
export function mimeFor(name: string): string {
  const ext = name.split(".").pop() ?? "";
  return EXT_MIME[ext] ?? "application/octet-stream";
}
