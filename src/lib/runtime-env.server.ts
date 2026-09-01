/**
 * Runtime environment resolver.
 *
 * On Cloudflare Workers secrets are delivered on the per-request `env` object,
 * not on `process.env`, and `process.env` writes can be rejected. We therefore
 * cache every incoming env binding here and read config through `readEnv`,
 * which falls back across: cached bindings -> process.env -> import.meta.env.
 */

const cache = new Map<string, string>();

/** Called on every request with the Cloudflare `env` bindings object. */
export function captureRuntimeEnv(env: unknown): void {
  if (!env || typeof env !== "object") return;
  for (const [key, value] of Object.entries(env as Record<string, unknown>)) {
    if (typeof value === "string" && value !== "") cache.set(key, value);
  }
}

/** Reads a config value, trying each provided name in order. */
export function readEnv(...names: string[]): string | undefined {
  for (const name of names) {
    const cached = cache.get(name);
    if (cached) return cached;

    try {
      const fromProcess = process.env?.[name];
      if (typeof fromProcess === "string" && fromProcess !== "") return fromProcess;
    } catch {
      // process may be unavailable in some runtimes.
    }

    try {
      const fromVite = (import.meta as any)?.env?.[name];
      if (typeof fromVite === "string" && fromVite !== "") return fromVite;
    } catch {
      // import.meta.env is not always defined.
    }
  }
  return undefined;
}

export function traceEnv(
  name: string,
  onMiss?: (name: string, checked: string[]) => void,
): string | undefined {
  const checked: string[] = [];
  const cached = cache.get(name);
  checked.push("runtime env cache");
  if (cached) return cached;

  try {
    const fromProcess = process.env?.[name];
    checked.push("process.env");
    if (typeof fromProcess === "string" && fromProcess !== "") return fromProcess;
  } catch {
    checked.push("process.env");
  }

  try {
    const fromVite = (import.meta as any)?.env?.[name];
    checked.push("import.meta.env");
    if (typeof fromVite === "string" && fromVite !== "") return fromVite;
  } catch {
    checked.push("import.meta.env");
  }

  if (onMiss) onMiss(name, checked);
  return undefined;
}
