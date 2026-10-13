/**
 * SigV4 signing (src/lib/aitools/s3-sign.ts): canonical-request structure,
 * credential scoping, determinism and sensitivity. We cannot test against
 * live S3, so the tests pin the wire format AWS documents (path-style URL,
 * sorted canonical headers, empty-payload hash, multi-stage HMAC key).
 */

import { createHash, createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { mimeFor, s3ObjectUrl, signS3Request, type S3Config } from "@/lib/aitools/s3-sign";

const cfg: S3Config = {
  endpoint: "https://s3.storage.test",
  bucket: "test-bucket",
  region: "auto",
  accessKeyId: "AKIDEXAMPLE",
  secretAccessKey: "wJalrXUtnFEMI",
};
const NOW = new Date("2026-10-13T12:00:00Z");
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe("s3ObjectUrl", () => {
  it("builds path-style URLs with encoded key segments", () => {
    expect(s3ObjectUrl(cfg, "uploads/a b.png")).toBe(
      "https://s3.storage.test/test-bucket/uploads/a%20b.png",
    );
  });

  it("keeps safe characters unencoded and splits path segments", () => {
    /* the store owns any key prefix; the URL builder takes the full key */
    expect(s3ObjectUrl(cfg, "site-ui/logo~/x_y-z.png")).toBe(
      "https://s3.storage.test/test-bucket/site-ui/logo~/x_y-z.png",
    );
    expect(s3ObjectUrl(cfg, "sp ace/file.png")).toBe(
      "https://s3.storage.test/test-bucket/sp%20ace/file.png",
    );
  });
});

describe("signS3Request", () => {
  it("signs a PUT with the documented canonical shape", () => {
    const signed = signS3Request(cfg, "PUT", "uploads/cover.png", PNG, NOW);

    expect(signed.method).toBe("PUT");
    expect(signed.url).toBe("https://s3.storage.test/test-bucket/uploads/cover.png");

    /* the four signed headers, in sorted order */
    expect(signed.headers["content-type"]).toBe("image/png");
    expect(signed.headers["x-amz-content-sha256"]).toBe(
      createHash("sha256").update(PNG).digest("hex"),
    );
    expect(signed.headers["x-amz-date"]).toBe("20261013T120000Z");

    const auth = signed.headers.Authorization;
    expect(auth).toMatch(/^AWS4-HMAC-SHA256 /);
    /* credential scope binds the date, region, service and terminator */
    expect(auth).toContain("Credential=AKIDEXAMPLE/20261013/auto/s3/aws4_request");
    /* exactly the headers sent, comma-joined in canonical order */
    expect(auth).toContain(
      "SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date",
    );
    expect(auth).toMatch(/Signature=[0-9a-f]{64}$/);
  });

  it("produces the same signature the SigV4 spec computes", () => {
    /* independent re-implementation of the signing chain for this fixture —
       if the module's own math drifts, this recomputation drifts with it... so
       instead rebuild each stage from the *inputs* and assert the module used
       exactly those stages, via the canonical request spelled out here. */
    const canonicalRequest = [
      "PUT",
      "/test-bucket/uploads/cover.png",
      "",
      `content-type:image/png\nhost:s3.storage.test\nx-amz-content-sha256:${createHash("sha256").update(PNG).digest("hex")}\nx-amz-date:20261013T120000Z\n`,
      "content-type;host;x-amz-content-sha256;x-amz-date",
      createHash("sha256").update(PNG).digest("hex"),
    ].join("\n");
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      "20261013T120000Z",
      "20261013/auto/s3/aws4_request",
      createHash("sha256").update(canonicalRequest, "utf8").digest("hex"),
    ].join("\n");
    let key = createHmac("sha256", `AWS4${cfg.secretAccessKey}`).update("20261013").digest();
    key = createHmac("sha256", key).update("auto").digest();
    key = createHmac("sha256", key).update("s3").digest();
    key = createHmac("sha256", key).update("aws4_request").digest();
    const expected = createHmac("sha256", key).update(stringToSign, "utf8").digest("hex");

    const signed = signS3Request(cfg, "PUT", "uploads/cover.png", PNG, NOW);
    expect(signed.headers.Authorization).toContain(`Signature=${expected}`);
  });

  it("signs a GET with the empty-payload hash and no content-type", () => {
    const signed = signS3Request(cfg, "GET", "uploads/cover.png", new Uint8Array(0), NOW);
    expect(signed.headers["x-amz-content-sha256"]).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    expect(signed.headers["content-type"]).toBeUndefined();
    expect(signed.headers.Authorization).toContain(
      "SignedHeaders=host;x-amz-content-sha256;x-amz-date",
    );
  });

  it("is deterministic for the same inputs and changes when they differ", () => {
    const a = signS3Request(cfg, "PUT", "k.png", PNG, NOW).headers.Authorization;
    const b = signS3Request(cfg, "PUT", "k.png", PNG, NOW).headers.Authorization;
    expect(a).toBe(b);

    const otherKey = signS3Request(cfg, "PUT", "other.png", PNG, NOW).headers.Authorization;
    expect(a).not.toBe(otherKey);

    const otherTime = signS3Request(cfg, "PUT", "k.png", PNG, new Date("2026-10-13T12:00:01Z"))
      .headers.Authorization;
    expect(a).not.toBe(otherTime);

    const otherSecret = signS3Request(
      { ...cfg, secretAccessKey: "different" },
      "PUT",
      "k.png",
      PNG,
      NOW,
    ).headers.Authorization;
    expect(a).not.toBe(otherSecret);
  });

  it("includes the session token as a signed header when present", () => {
    const signed = signS3Request(
      { ...cfg, sessionToken: "tok-123" },
      "PUT",
      "k.png",
      PNG,
      NOW,
    );
    expect(signed.headers["x-amz-security-token"]).toBe("tok-123");
    expect(signed.headers.Authorization).toContain(
      "SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date;x-amz-security-token",
    );
  });
});

describe("mimeFor", () => {
  it("maps the four accepted extensions", () => {
    expect(mimeFor("a.png")).toBe("image/png");
    expect(mimeFor("a.jpg")).toBe("image/jpeg");
    expect(mimeFor("a.gif")).toBe("image/gif");
    expect(mimeFor("a.webp")).toBe("image/webp");
    expect(mimeFor("a.bin")).toBe("application/octet-stream");
  });

  it("raises the base64 signature of the HMAC chain when the secret differs", () => {
    /* guards against a signed-header copy/paste of the *unsigned* HMAC —
       different secret must flow into the chain */
    const one = signS3Request({ ...cfg, secretAccessKey: "k1" }, "PUT", "x.png", PNG, NOW);
    const two = signS3Request({ ...cfg, secretAccessKey: "k2" }, "PUT", "x.png", PNG, NOW);
    expect(
      createHmac("sha256", "compare-marker").update(one.headers.Authorization).digest("base64"),
    ).not.toBe(
      createHmac("sha256", "compare-marker").update(two.headers.Authorization).digest("base64"),
    );
  });
});
