/**
 * Server-only Turnstile verification.
 *
 * Cloudflare secrets are delivered on the per-request `env` object and cached
 * through `captureRuntimeEnv(env)` → `readEnv(...)`. We intentionally do NOT
 * read `process.env.TURNSTILE_SECRET` directly so the runtime cache is used.
 */

import { readEnv } from "@/lib/runtime-env.server";

export async function verifyTurnstile(
  token: string,
  action: string,
  remoteIp?: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const secret = readEnv("TURNSTILE_SECRET");
  if (!secret) {
    return { ok: false, reason: "missing_secret" };
  }

  if (!token || token.length === 0 || token.length > 2048) {
    return { ok: false, reason: "invalid_token" };
  }

  const expectedHostnames = (readEnv("TURNSTILE_HOSTNAMES") || "")
    .split(",")
    .map((hostname) => hostname.trim())
    .filter(Boolean);

  if (expectedHostnames.length === 0) {
    return { ok: false, reason: "missing_hostnames" };
  }

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal: AbortSignal.timeout(10_000),
      body: new URLSearchParams({
        secret,
        response: token,
        ...(remoteIp ? { remoteip: remoteIp } : {}),
      }),
    });

    if (!response.ok) {
      return { ok: false, reason: `siteverify_http_${response.status}` };
    }

    const result = (await response.json()) as {
      success: boolean;
      action?: string;
      hostname?: string;
      ["error-codes"]?: string[];
    };

    if (!result.success) {
      return { ok: false, reason: "siteverify_failed" };
    }

    if (result.action !== action) {
      return { ok: false, reason: "action_mismatch" };
    }

    if (!result.hostname || !expectedHostnames.includes(result.hostname)) {
      return { ok: false, reason: "hostname_not_allowed" };
    }

    return { ok: true };
  } catch {
    return { ok: false, reason: "siteverify_error" };
  }
}
