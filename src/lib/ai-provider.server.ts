/**
 * Provider-agnostic TradeMall AI gateway.
 *
 * Supported providers:
 * Gemini, OpenAI, Anthropic/Claude, Mistral, DeepSeek, xAI/Grok and Ollama.
 * Providers are selected server-side using AI_PROVIDER_ORDER. A failed provider
 * (quota, timeout, transient outage, invalid response) falls through to the next
 * configured provider. No API key is ever exposed to the browser.
 */
import { readEnv } from "@/lib/runtime-env.server";

export type AiProviderName =
  "gemini" | "openai" | "claude" | "mistral" | "deepseek" | "grok" | "ollama";
export type AiUsage = { inputTokens?: number; outputTokens?: number; totalTokens?: number };
export type AiResult<T> = { data: T; model: string; provider: AiProviderName; usage?: AiUsage };

const TIMEOUT_MS = 45_000;
const MAX_RETRIES_PER_PROVIDER = 2;
const DEFAULT_ORDER: AiProviderName[] = [
  "gemini",
  "grok",
  "openai",
  "claude",
  "mistral",
  "deepseek",
  "ollama",
];
const MAX_PROMPT_CHARS = 50_000;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

export class AiProviderError extends Error {
  constructor(
    message: string,
    public readonly provider?: AiProviderName,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "AiProviderError";
  }
}

const providerConfig: Record<
  AiProviderName,
  { keyEnv?: string; modelEnv: string; defaultModel: string }
> = {
  gemini: { keyEnv: "GEMINI_API_KEY", modelEnv: "GEMINI_MODEL", defaultModel: "gemini-3.7-flash" },
  openai: { keyEnv: "OPENAI_API_KEY", modelEnv: "OPENAI_MODEL", defaultModel: "gpt-5-mini" },
  claude: {
    keyEnv: "ANTHROPIC_API_KEY",
    modelEnv: "ANTHROPIC_MODEL",
    defaultModel: "claude-sonnet-4-5",
  },
  mistral: {
    keyEnv: "MISTRAL_API_KEY",
    modelEnv: "MISTRAL_MODEL",
    defaultModel: "mistral-small-latest",
  },
  deepseek: {
    keyEnv: "DEEPSEEK_API_KEY",
    modelEnv: "DEEPSEEK_MODEL",
    defaultModel: "deepseek-chat",
  },
  grok: { keyEnv: "XAI_API_KEY", modelEnv: "XAI_MODEL", defaultModel: "grok-4-1-fast-reasoning" },
  ollama: { modelEnv: "OLLAMA_MODEL", defaultModel: "llama3.2:3b" },
};

function configured(name: AiProviderName): boolean {
  if (name === "ollama") return Boolean(readEnv("OLLAMA_BASE_URL"));
  return Boolean(providerConfig[name].keyEnv && readEnv(providerConfig[name].keyEnv!));
}

function getOrder(): AiProviderName[] {
  const raw = readEnv("AI_PROVIDER_ORDER");
  const requested = raw
    ? raw.split(",").map((v) => v.trim().toLowerCase() as AiProviderName)
    : DEFAULT_ORDER;
  const unique = [...new Set(requested)].filter((v): v is AiProviderName =>
    DEFAULT_ORDER.includes(v),
  );
  return unique.length ? unique : DEFAULT_ORDER;
}

function modelFor(provider: AiProviderName): string {
  return readEnv(providerConfig[provider].modelEnv) || providerConfig[provider].defaultModel;
}

function retryable(status?: number) {
  return (
    status === 408 || status === 409 || status === 429 || (status !== undefined && status >= 500)
  );
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
        /* continue */
      }
    }
    throw new AiProviderError("The AI provider returned invalid JSON.");
  }
}

function base64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

async function fetchJson(url: string, init: RequestInit, provider: AiProviderName): Promise<any> {
  let last: AiProviderError | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES_PER_PROVIDER; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      const raw = await response.text();
      let payload: any = {};
      try {
        payload = raw ? JSON.parse(raw) : {};
      } catch {
        throw new AiProviderError(
          `${provider} returned an invalid response (${response.status}).`,
          provider,
          response.status,
        );
      }
      if (!response.ok) {
        const message =
          payload?.error?.message ||
          payload?.message ||
          `${provider} request failed (${response.status}).`;
        throw new AiProviderError(message, provider, response.status);
      }
      return payload;
    } catch (error) {
      if (error instanceof AiProviderError) last = error;
      else if (error instanceof Error && error.name === "AbortError")
        last = new AiProviderError(`${provider} timed out.`, provider, 408);
      else last = new AiProviderError(`Could not reach ${provider}.`, provider);
      if (!retryable(last.status) || attempt >= MAX_RETRIES_PER_PROVIDER) throw last;
      await new Promise((resolve) =>
        setTimeout(resolve, 400 * 2 ** attempt + Math.floor(Math.random() * 250)),
      );
    } finally {
      clearTimeout(timer);
    }
  }
  throw last ?? new AiProviderError(`${provider} request failed.`, provider);
}

function extractOpenAiText(payload: any, provider: AiProviderName): string {
  const text = payload?.choices?.[0]?.message?.content;
  if (typeof text === "string" && text.trim()) return text.trim();
  if (Array.isArray(text)) {
    const joined = text
      .map((p: any) => (typeof p === "string" ? p : p?.text || ""))
      .join("\n")
      .trim();
    if (joined) return joined;
  }
  throw new AiProviderError(`${provider} returned an empty response.`, provider);
}

function usageOpenAi(payload: any): AiUsage | undefined {
  const u = payload?.usage;
  if (!u) return undefined;
  const inputTokens = u.prompt_tokens ?? u.input_tokens;
  const outputTokens = u.completion_tokens ?? u.output_tokens;
  return {
    inputTokens,
    outputTokens,
    totalTokens:
      u.total_tokens ??
      (inputTokens !== undefined && outputTokens !== undefined
        ? inputTokens + outputTokens
        : undefined),
  };
}

async function callOpenAiCompatible(
  provider: AiProviderName,
  input: {
    prompt: string;
    systemInstruction?: string;
    model: string;
    image?: { mimeType: string; bytes: Uint8Array };
  },
) {
  const endpoints: Record<AiProviderName, string> = {
    openai: "https://api.openai.com/v1/chat/completions",
    grok: "https://api.x.ai/v1/chat/completions",
    mistral: "https://api.mistral.ai/v1/chat/completions",
    deepseek: "https://api.deepseek.com/chat/completions",
    ollama: `${(readEnv("OLLAMA_BASE_URL") || "http://127.0.0.1:11434").replace(/\/$/, "")}/v1/chat/completions`,
    gemini: "",
    claude: "",
  };
  const keyEnv = providerConfig[provider].keyEnv;
  const apiKey = keyEnv ? readEnv(keyEnv) : undefined;
  if (provider !== "ollama" && !apiKey)
    throw new AiProviderError(`${provider} is not configured.`, provider);

  const userContent: any = input.image
    ? [
        { type: "text", text: input.prompt },
        {
          type: "image_url",
          image_url: { url: `data:${input.image.mimeType};base64,${base64(input.image.bytes)}` },
        },
      ]
    : input.prompt;
  const messages: any[] = [];
  if (input.systemInstruction) messages.push({ role: "system", content: input.systemInstruction });
  messages.push({ role: "user", content: userContent });
  const payload = await fetchJson(
    endpoints[provider],
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: input.model,
        messages,
        temperature: 0.2,
        max_tokens: 4096,
        response_format: { type: "json_object" },
      }),
    },
    provider,
  );
  return { text: extractOpenAiText(payload, provider), usage: usageOpenAi(payload) };
}

async function callClaude(input: {
  prompt: string;
  systemInstruction?: string;
  model: string;
  image?: { mimeType: string; bytes: Uint8Array };
}) {
  const apiKey = readEnv("ANTHROPIC_API_KEY");
  if (!apiKey) throw new AiProviderError("Claude is not configured.", "claude");
  const content: any[] = [
    { type: "text", text: `${input.prompt}\n\nReturn ONLY valid JSON. No markdown fences.` },
  ];
  if (input.image)
    content.push({
      type: "image",
      source: { type: "base64", media_type: input.image.mimeType, data: base64(input.image.bytes) },
    });
  const payload = await fetchJson(
    "https://api.anthropic.com/v1/messages",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: input.model,
        max_tokens: 4096,
        system: input.systemInstruction || "Return conservative structured JSON for TradeMall.",
        messages: [{ role: "user", content }],
      }),
    },
    "claude",
  );
  const text = (payload?.content ?? [])
    .filter((p: any) => p.type === "text")
    .map((p: any) => p.text)
    .join("\n")
    .trim();
  if (!text) throw new AiProviderError("Claude returned an empty response.", "claude");
  return {
    text,
    usage: payload?.usage
      ? {
          inputTokens: payload.usage.input_tokens,
          outputTokens: payload.usage.output_tokens,
          totalTokens: (payload.usage.input_tokens ?? 0) + (payload.usage.output_tokens ?? 0),
        }
      : undefined,
  };
}

async function callGemini(input: {
  prompt: string;
  systemInstruction?: string;
  model: string;
  schema: Record<string, unknown>;
  image?: { mimeType: string; bytes: Uint8Array };
}) {
  const apiKey = readEnv("GEMINI_API_KEY");
  if (!apiKey) throw new AiProviderError("Gemini is not configured.", "gemini");
  const parts: any[] = [{ text: input.prompt }];
  if (input.image)
    parts.push({
      inline_data: { mime_type: input.image.mimeType, data: base64(input.image.bytes) },
    });
  const body = {
    contents: [{ role: "user", parts }],
    systemInstruction: input.systemInstruction
      ? { parts: [{ text: input.systemInstruction }] }
      : undefined,
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 4096,
      responseMimeType: "application/json",
      responseSchema: input.schema,
    },
  };
  const payload = await fetchJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(input.model)}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(body),
    },
    "gemini",
  );
  const text = (payload?.candidates ?? [])
    .flatMap((c: any) => c?.content?.parts ?? [])
    .map((p: any) => p?.text || "")
    .join("\n")
    .trim();
  if (!text) throw new AiProviderError("Gemini returned an empty response.", "gemini");
  return {
    text,
    usage: payload?.usageMetadata
      ? {
          inputTokens: payload.usageMetadata.promptTokenCount,
          outputTokens: payload.usageMetadata.candidatesTokenCount,
          totalTokens: payload.usageMetadata.totalTokenCount,
        }
      : undefined,
  };
}

export async function generateStructured<T>(input: {
  prompt: string;
  schema: Record<string, unknown>;
  systemInstruction?: string;
}): Promise<AiResult<T>> {
  if (input.prompt.length > MAX_PROMPT_CHARS)
    throw new AiProviderError("The AI request is too large. Shorten the input and try again.");
  return generate<T>({ ...input });
}

export async function generateStructuredWithImage<T>(input: {
  prompt: string;
  schema: Record<string, unknown>;
  mimeType: string;
  bytes: Uint8Array;
  systemInstruction?: string;
}): Promise<AiResult<T>> {
  if (input.bytes.byteLength === 0 || input.bytes.byteLength > MAX_IMAGE_BYTES)
    throw new AiProviderError("The image is too large for AI analysis.");
  if (!/^image\/(png|jpe?g|webp|gif)$/i.test(input.mimeType))
    throw new AiProviderError("TradeMall AI supports PNG, JPEG, WebP and GIF images only.");
  return generate<T>({ ...input, image: { mimeType: input.mimeType, bytes: input.bytes } });
}

async function generate<T>(input: {
  prompt: string;
  schema: Record<string, unknown>;
  systemInstruction?: string;
  image?: { mimeType: string; bytes: Uint8Array };
}): Promise<AiResult<T>> {
  const order = getOrder().filter(configured);
  if (!order.length)
    throw new AiProviderError(
      "No AI providers are configured. Add at least one provider API key or an Ollama base URL.",
    );
  const errors: string[] = [];
  for (const provider of order) {
    const model = modelFor(provider);
    try {
      const request = {
        prompt: `${input.prompt}\n\nReturn ONLY valid JSON matching the requested structure. Do not invent facts.`,
        systemInstruction: input.systemInstruction,
        model,
        image: input.image,
      };
      let response: { text: string; usage?: AiUsage };
      if (provider === "gemini") response = await callGemini({ ...request, schema: input.schema });
      else if (provider === "claude") response = await callClaude(request);
      else response = await callOpenAiCompatible(provider, request);
      const data = parseJson<T>(response.text);
      return { data, model, provider, usage: response.usage };
    } catch (error) {
      const message = error instanceof AiProviderError ? error.message : "Unknown provider error";
      errors.push(`${provider}: ${message}`);
    }
  }
  throw new AiProviderError(`All configured AI providers failed. ${errors.join(" | ")}`);
}

export function getAiProviderStatus() {
  return getOrder().map((provider) => ({
    provider,
    configured: configured(provider),
    model: modelFor(provider),
  }));
}
