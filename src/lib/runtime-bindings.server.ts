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

export function captureRuntimeBindings(env: unknown): void {
  if (!env || typeof env !== "object") {
    g.__r2DebugInfo = "captureRuntimeBindings called with non-object env";
    return;
  }
  const name = readEnv("R2_BINDING_NAME") || "R2";
  const bucket = (env as Record<string, unknown>)[name];
  if (bucket && typeof bucket === "object" && "put" in bucket) {
    g.__r2Bucket = bucket as R2BucketLike;
    g.__r2DebugInfo = `OK: bound "${name}"`;
  } else {
    const keys = Object.keys(env as Record<string, unknown>).filter((key) => {
      const value = (env as Record<string, unknown>)[key];
      return value && typeof value === "object" && "put" in (value as object);
    });
    g.__r2DebugInfo = `Binding "${name}" not found. All env keys: ${JSON.stringify(Object.keys(env as Record<string, unknown>))}. Object-like keys with put(): ${JSON.stringify(keys)}`;
  }
}

export function getR2Bucket(): R2BucketLike | undefined {
  return g.__r2Bucket;
}

export function getR2BindingDebugInfo(): string {
  return g.__r2DebugInfo ?? "captureRuntimeBindings never ran for this request";
}
