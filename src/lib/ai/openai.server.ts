/**
 * Server-side OpenAI client.
 *
 * NEVER import this file from client/browser code.
 * The API key is read from server-side environment variables only.
 *
 * Uses the project's runtime-env cache so it works in both:
 * - Local dev (process.env / .env)
 * - Cloudflare Workers (env bindings captured by captureRuntimeEnv)
 */

import OpenAI from "openai";
import { readEnv } from "@/lib/runtime-env.server";

let _openai: OpenAI | null = null;
let _cachedKey: string | undefined;

function resolveApiKey(): string | undefined {
  if (_cachedKey) return _cachedKey;
  _cachedKey = readEnv("OPENAI_API_KEY");
  return _cachedKey;
}

export function getOpenAIClient(): OpenAI {
  const apiKey = resolveApiKey();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }
  if (!_openai) {
    _openai = new OpenAI({ apiKey });
  }
  return _openai;
}

export const AI_MODEL = readEnv("OPENAI_MODEL") ?? "gpt-4o-mini";

export function isAIConfigured(): boolean {
  return Boolean(resolveApiKey());
}

export async function diagnoseOpenAIConnection(): Promise<{
  configured: boolean;
  model: string;
  ok: boolean;
  category?: string;
  message?: string;
  httpStatus?: number;
  responsePreview?: string;
}> {
  const configured = isAIConfigured();
  const model = AI_MODEL;

  if (!configured) {
    return { configured: false, model, ok: false, category: "AI_CONFIGURATION_MISSING", message: "API key missing." };
  }

  try {
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model,
      messages: [{ role: "user", content: "Return the word OK." }],
      max_tokens: 10,
    });

    const content = response.choices[0]?.message?.content?.trim();
    return {
      configured: true,
      model,
      ok: true,
      responsePreview: content ?? "(empty)",
    };
  } catch (error: any) {
    const status = error?.status ?? error?.response?.status;
    const code = error?.code;
    const message = error?.message ?? String(error);

    let category = "AI_INTERNAL_ERROR";
    if (status === 401 || status === 403) category = "AI_AUTH_ERROR";
    else if (status === 429) category = "AI_RATE_LIMIT_ERROR";
    else if (status === 404) category = "AI_MODEL_ERROR";
    else if (status === 400) category = "AI_REQUEST_ERROR";
    else if (status && status >= 500) category = "AI_PROVIDER_ERROR";
    else if (code === "ECONNREFUSED" || code === "ETIMEDOUT" || code === "ENOTFOUND") category = "AI_TIMEOUT";

    return {
      configured: true,
      model,
      ok: false,
      category,
      message,
      httpStatus: status,
    };
  }
}

export function resetAiCache(): void {
  _openai = null;
  _cachedKey = undefined;
}

export function getAiConfigurationStatus(): "configured" | "missing" | "invalid" {
  const key = resolveApiKey();
  if (!key) return "missing";
  if (key.length < 20) return "invalid";
  return "configured";
}
