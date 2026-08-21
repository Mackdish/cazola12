/**
 * Cache for Cloudflare bindings that aren't plain strings (e.g. R2Bucket),
 * which src/lib/runtime-env.server.ts intentionally skips. Captured once per
 * request from the Worker's `env` object.
 */
type R2PutOptions = { httpMetadata?: { contentType?: string } };
type R2BucketLike = {
  put: (key: string, value: ArrayBuffer | Uint8Array, options?: R2PutOptions) => Promise<unknown>;
  delete: (key: string) => Promise<void>;
};

let r2Bucket: R2BucketLike | undefined;

export function captureRuntimeBindings(env: unknown): void {
  if (!env || typeof env !== "object") return;
  const bucket = (env as Record<string, unknown>)["R2"];
  if (bucket && typeof bucket === "object" && "put" in bucket) {
    r2Bucket = bucket as R2BucketLike;
  }
}

export function getR2Bucket(): R2BucketLike | undefined {
  return r2Bucket;
}
