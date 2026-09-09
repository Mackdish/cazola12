/**
 * Server-only Gemini REST client.
 *
 * We intentionally use fetch instead of an SDK so the TradeMall Cloudflare
 * Worker stays dependency-light and the Gemini key never reaches the browser.
 */
import { readEnv } from "@/lib/runtime-env.server";

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = "gemini-3.7-flash";
const TIMEOUT_MS = 45_000;
const MAX_PROMPT_CHARS = 50_000;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const MAX_RETRIES = 2;

export class GeminiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "GeminiError";
  }
}

type GeminiPart = { text: string } | { inline_data: { mime_type: string; data: string } };

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  promptFeedback?: { blockReason?: string };
  modelVersion?: string;
};

function getConfig() {
  const apiKey = readEnv("GEMINI_API_KEY");
  if (!apiKey)
    throw new GeminiError(
      "Gemini is not configured. Add GEMINI_API_KEY to the server environment.",
    );
  return {
    apiKey,
    model: readEnv("GEMINI_MODEL") || DEFAULT_MODEL,
  };
}

function extractText(payload: GeminiResponse): string {
  const text = (payload.candidates ?? [])
    .flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("\n")
    .trim();

  if (!text) {
    const reason = payload.promptFeedback?.blockReason || payload.candidates?.[0]?.finishReason;
    throw new GeminiError(
      reason
        ? `Gemini did not return a usable response (${reason}).`
        : "Gemini returned an empty response.",
    );
  }
  return text;
}

function parseJson<T>(text: string): T {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");
    if (first >= 0 && last > first) {
      try {
        return JSON.parse(cleaned.slice(first, last + 1)) as T;
      } catch {
        // fall through
      }
    }
    throw new GeminiError("Gemini returned invalid JSON. Please try again.");
  }
}

function validateInputParts(parts: GeminiPart[]) {
  for (const part of parts) {
    if ("text" in part && part.text.length > MAX_PROMPT_CHARS) {
      throw new GeminiError("The AI request is too large. Please shorten the input and try again.");
    }
    if (
      "inline_data" in part &&
      part.inline_data.data.length > Math.ceil((MAX_IMAGE_BYTES * 4) / 3)
    ) {
      throw new GeminiError("The image is too large for AI analysis.");
    }
  }
}

function retryable(status?: number) {
  return (
    status === 408 || status === 409 || status === 429 || (status !== undefined && status >= 500)
  );
}

async function callGemini(input: {
  parts: GeminiPart[];
  schema?: Record<string, unknown>;
  systemInstruction?: string;
}): Promise<{ text: string; usage?: GeminiResponse["usageMetadata"]; model: string }> {
  const { apiKey, model } = getConfig();
  validateInputParts(input.parts);

  const generationConfig: Record<string, unknown> = {
    temperature: 0.2,
    maxOutputTokens: 4096,
  };

  // Gemini's REST API expects responseMimeType/responseSchema in generationConfig.
  if (input.schema) {
    generationConfig.responseMimeType = "application/json";
    generationConfig.responseSchema = input.schema;
  }

  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts: input.parts }],
    generationConfig,
  };

  if (input.systemInstruction) {
    body.systemInstruction = { parts: [{ text: input.systemInstruction }] };
  }

  let lastError: GeminiError | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(
        `${GEMINI_BASE_URL}/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify(body),
          signal: controller.signal,
        },
      );
      const raw = await response.text();
      let payload: GeminiResponse & { error?: { message?: string } };
      try {
        payload = JSON.parse(raw) as GeminiResponse & { error?: { message?: string } };
      } catch {
        throw new GeminiError(
          `Gemini returned an invalid response (${response.status}).`,
          response.status,
        );
      }
      if (!response.ok) {
        const message = payload.error?.message || `Gemini request failed (${response.status}).`;
        throw new GeminiError(message, response.status);
      }
      return {
        text: extractText(payload),
        usage: payload.usageMetadata,
        model: payload.modelVersion || model,
      };
    } catch (error) {
      if (error instanceof GeminiError) lastError = error;
      else if (error instanceof Error && error.name === "AbortError")
        lastError = new GeminiError("Gemini took too long to respond. Please try again.");
      else lastError = new GeminiError("Could not reach Gemini. Please try again.");
      if (!retryable(lastError.status) || attempt >= MAX_RETRIES) throw lastError;
      await new Promise((resolve) =>
        setTimeout(resolve, 400 * 2 ** attempt + Math.floor(Math.random() * 250)),
      );
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError ?? new GeminiError("Gemini request failed. Please try again.");
}

export async function generateStructured<T>(input: {
  prompt: string;
  schema: Record<string, unknown>;
  systemInstruction?: string;
}): Promise<{ data: T; usage?: GeminiResponse["usageMetadata"]; model: string }> {
  const response = await callGemini({
    parts: [{ text: input.prompt }],
    schema: input.schema,
    systemInstruction: input.systemInstruction,
  });
  return { data: parseJson<T>(response.text), usage: response.usage, model: response.model };
}

export async function generateStructuredWithImage<T>(input: {
  prompt: string;
  schema: Record<string, unknown>;
  mimeType: string;
  bytes: Uint8Array;
  systemInstruction?: string;
}): Promise<{ data: T; usage?: GeminiResponse["usageMetadata"]; model: string }> {
  if (input.bytes.byteLength === 0 || input.bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new GeminiError("The image is too large for AI analysis.");
  }
  if (!/^image\/(png|jpe?g|webp|gif)$/i.test(input.mimeType)) {
    throw new GeminiError("TradeMall AI currently supports PNG, JPEG, WebP and GIF images.");
  }
  const base64 = uint8ToBase64(input.bytes);
  const response = await callGemini({
    parts: [{ text: input.prompt }, { inline_data: { mime_type: input.mimeType, data: base64 } }],
    schema: input.schema,
    systemInstruction: input.systemInstruction,
  });
  return { data: parseJson<T>(response.text), usage: response.usage, model: response.model };
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}
