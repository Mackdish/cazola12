import { readEnv } from "@/lib/runtime-env.server";

type R2PutOptions = { httpMetadata?: { contentType?: string } };
type R2BucketLike = {
  put: (key: string, value: ArrayBuffer | Uint8Array, options?: R2PutOptions) => Promise<unknown>;
  delete: (key: string) => Promise<void>;
};

type WorkersAiLike = {
  run: (model: string, input: Record<string, unknown>) => Promise<unknown>;
};

type GlobalWithBindings = typeof globalThis & {
  __r2Bucket?: R2BucketLike;
  __workersAi?: WorkersAiLike;
};

const g = globalThis as GlobalWithBindings;

async function tryCloudflareWorkersEnv(): Promise<{
  r2?: R2BucketLike;
  ai?: WorkersAiLike;
}> {
  try {
    const mod = await import(/* @vite-ignore */ "cloudflare:workers" as string);
    const cfEnv = (mod as { env?: Record<string, unknown> }).env;
    if (!cfEnv) return {};

    const result: { r2?: R2BucketLike; ai?: WorkersAiLike } = {};
    const r2Name = readEnv("R2_BINDING_NAME") || "R2";
    const bucket = cfEnv[r2Name];
    if (bucket && typeof bucket === "object" && "put" in bucket) {
      result.r2 = bucket as R2BucketLike;
    }

    const ai = cfEnv["AI"];
    if (ai && typeof ai === "object" && "run" in ai) {
      result.ai = ai as WorkersAiLike;
    }

    return result;
  } catch {
    return {};
  }
}

export async function getR2Bucket(): Promise<R2BucketLike | undefined> {
  if (!g.__r2Bucket) {
    const bindings = await tryCloudflareWorkersEnv();
    g.__r2Bucket = bindings.r2;
  }
  return g.__r2Bucket;
}

export async function getWorkersAi(): Promise<WorkersAiLike | undefined> {
  if (!g.__workersAi) {
    const bindings = await tryCloudflareWorkersEnv();
    g.__workersAi = bindings.ai;
  }
  return g.__workersAi;
}

export function resetRuntimeBindings(): void {
  delete g.__r2Bucket;
  delete g.__workersAi;
}

export function captureRuntimeBindings(env: unknown): void {
  if (!env || typeof env !== "object") return;
  const bindings = env as Record<string, unknown>;

  const name = readEnv("R2_BINDING_NAME") || "R2";
  const bucket = bindings[name];
  if (bucket && typeof bucket === "object" && "put" in bucket) {
    g.__r2Bucket = bucket as R2BucketLike;
  }

  const ai = bindings["AI"];
  if (ai && typeof ai === "object" && "run" in ai) {
    g.__workersAi = ai as WorkersAiLike;
  }
}
