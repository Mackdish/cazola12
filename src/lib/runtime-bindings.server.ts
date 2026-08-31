import { readEnv } from "@/lib/runtime-env.server";

type R2PutOptions = { httpMetadata?: { contentType?: string } };
type R2BucketLike = {
  put: (key: string, value: ArrayBuffer | Uint8Array, options?: R2PutOptions) => Promise<unknown>;
  delete: (key: string) => Promise<void>;
};

export type WorkersAI = {
  run: (
    model: string,
    input: {
      messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
      temperature?: number;
      max_tokens?: number;
    },
  ) => Promise<unknown>;
};

type GlobalWithR2 = typeof globalThis & {
  __r2Bucket?: R2BucketLike;
  __workersAI?: WorkersAI;
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

async function tryCloudflareWorkersAI(): Promise<WorkersAI | undefined> {
  try {
    const mod = await import(/* @vite-ignore */ "cloudflare:workers" as string);
    const ai = (mod as { env?: Record<string, unknown> }).env?.AI;
    return ai && typeof ai === "object" && "run" in ai ? (ai as WorkersAI) : undefined;
  } catch {
    return undefined;
  }
}

export function captureRuntimeBindings(env: unknown): void {
  if (!env || typeof env !== "object") return;
  const name = readEnv("R2_BINDING_NAME") || "R2";
  const bucket = (env as Record<string, unknown>)[name];
  if (bucket && typeof bucket === "object" && "put" in bucket) {
    g.__r2Bucket = bucket as R2BucketLike;
  }

  const ai = (env as Record<string, unknown>).AI;
  if (ai && typeof ai === "object" && "run" in ai) {
    g.__workersAI = ai as WorkersAI;
  } else {
    delete g.__workersAI;
  }
}

export async function getR2Bucket(): Promise<R2BucketLike | undefined> {
  if (g.__r2Bucket) return g.__r2Bucket;
  const fromCfWorkers = await tryCloudflareWorkersEnv();
  if (fromCfWorkers) {
    g.__r2Bucket = fromCfWorkers;
    return fromCfWorkers;
  }
  return undefined;
}

/** True only when an AI binding was captured from the active Worker request. */
export function isWorkersAIAvailable(): boolean {
  return Boolean(g.__workersAI);
}

export async function getWorkersAI(): Promise<WorkersAI | undefined> {
  if (g.__workersAI) return g.__workersAI;
  const fromCfWorkers = await tryCloudflareWorkersAI();
  if (fromCfWorkers) {
    g.__workersAI = fromCfWorkers;
    return fromCfWorkers;
  }
  return undefined;
}
