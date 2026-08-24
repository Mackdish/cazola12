/**
 * Server-side OpenAI client.
 *
 * NEVER import this file from client/browser code.
 * The API key is read from server-side environment variables only.
 */

import OpenAI from "openai";

const OPENAI_API_KEY = globalThis.process?.env?.OPENAI_API_KEY ?? "";

if (!OPENAI_API_KEY) {
  console.warn("[ai] OPENAI_API_KEY is not set. AI features will fail at runtime.");
}

let _openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!_openai) {
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured.");
    }
    _openai = new OpenAI({ apiKey: OPENAI_API_KEY });
  }
  return _openai;
}

export { getOpenAIClient as openai };

export const AI_MODEL = globalThis.process?.env?.OPENAI_MODEL ?? "gpt-4o-mini";

export function isAIConfigured(): boolean {
  return Boolean(OPENAI_API_KEY);
}
