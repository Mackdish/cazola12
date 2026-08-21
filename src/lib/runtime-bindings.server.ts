import { readEnv } from "@/lib/runtime-env.server";

type R2PutOptions = { httpMetadata?: { contentType?: string } };
type R2BucketLike = {
  put: (key: string, value: ArrayBuffer | Uint8Array, options?: R2PutOptions) => Promise<unknown>;
  delete: (key: string) => Promise<void>;
};

type GlobalWithR2 = typeof globalThis & {
  __r2Bucket?: R2BucketLike;
  __r2DebugInfo?: string;
};

const g = globalThis as GlobalWithR2;

async function tryCloudflareWorkersEnv(): Promise<R2BucketLike | undefined> {
  try {
    const mod = await import("cloudflare:workers");
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

export function captureRuntimeBindings(env: unknown): void {
  if (!env || typeof env !== "object") {
    g.__r2DebugInfo = "captureRuntimeBindings called with non-object env (fallback to cloudflare:workers will be tried on next getR2Bucket call)";
    return;
  }
  const name = readEnv("R2_BINDING_NAME") || "R2";
  const bucket = (env as Record<string, unknown>)[name];
  if (bucket && typeof bucket === "object" && "put" in bucket) {
    g.__r2Bucket = bucket as R2BucketLike;
    g.__r2DebugInfo = `OK: bound "${name}" via fetch env`;
  }
}

export async function getR2Bucket(): Promise<R2BucketLike | undefined> {
  if (g.__r2Bucket) return g.__r2Bucket;
  const fromCfWorkers = await tryCloudflareWorkersEnv();
  if (fromCfWorkers) {
    g.__r2Bucket = fromCfWorkers;
    g.__r2DebugInfo = "OK: bound via cloudflare:workers import";
    return fromCfWorkers;
  }
  return undefined;
}

export function getR2BindingDebugInfo(): string {
  return g.__r2DebugInfo ?? "no diagnostic captured yet";
}
