import { readEnv } from "@/lib/runtime-env.server";

type R2PutOptions = { httpMetadata?: { contentType?: string } };
type R2BucketLike = {
  put: (key: string, value: ArrayBuffer | Uint8Array, options?: R2PutOptions) => Promise<unknown>;
  delete: (key: string) => Promise<void>;
};

type GlobalWithR2 = typeof globalThis & {
  __r2Bucket?: R2BucketLike;
};

const g = globalThis as GlobalWithR2;

async function tryCloudflareWorkersEnv(): Promise<R2BucketLike | undefined> {
  try {
    const mod = await import(/* @vite-ignore */ "cloudflare:workers" as string);
    const cfEnv = (mod as { env?: Record<string, unknown> }).env;
    if (!cfEnv) return undefined;
    const name = readEnv("R2_BINDING_NAME") || "R2";
    const bucket = cfEnv[name];
    if (bucket && typeof bucket === "object" && "put" in bucket) {
      return bucket as R2BucketLike;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export async function getR2Bucket(): Promise<R2BucketLike | undefined> {
  if (!g.__r2Bucket) {
    g.__r2Bucket = await tryCloudflareWorkersEnv();
  }
  return g.__r2Bucket;
}

export function resetRuntimeBindings(): void {
  delete g.__r2Bucket;
}

export function captureRuntimeBindings(env: unknown): void {
  if (!env || typeof env !== "object") return;
  const name = readEnv("R2_BINDING_NAME") || "R2";
  const bucket = (env as Record<string, unknown>)[name];
  if (bucket && typeof bucket === "object" && "put" in bucket) {
    g.__r2Bucket = bucket as R2BucketLike;
  }
}
