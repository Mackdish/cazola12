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
