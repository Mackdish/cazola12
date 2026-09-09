import { readEnv } from "@/lib/runtime-env.server";
import { getWorkersAi } from "@/lib/runtime-bindings.server";

/** TradeMall text AI: Cloudflare Workers AI is the sole provider. */
export type AiProviderName = "cloudflare";
export type AiUsage = { inputTokens?: number; outputTokens?: number; totalTokens?: number };
export type AiResult<T> = { data: T; model: string; provider: AiProviderName; usage?: AiUsage };

const MAX_RETRIES = 2;
const TEXT_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";
const VISION_MODEL = "@cf/meta/llama-3.2-11b-vision-instruct";
const MAX_PROMPT_CHARS = 50_000;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

export class AiProviderError extends Error {
  constructor(message: string, public readonly provider: AiProviderName = "cloudflare", public readonly status?: number) {
    super(message);
    this.name = "AiProviderError";
  }
}

function modelFor(hasImage: boolean): string {
  return readEnv(hasImage ? "CLOUDFLARE_AI_VISION_MODEL" : "CLOUDFLARE_AI_MODEL") || (hasImage ? VISION_MODEL : TEXT_MODEL);
}

function base64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

function responseToText(result: unknown): string {
  if (typeof result === "string") return result.trim();
  if (!result || typeof result !== "object") return "";

  const candidate = result as { response?: unknown; result?: unknown };
  const response = candidate.response;

  // Workers AI JSON Mode returns the structured object directly under `response`.
  // Normal text generation returns a string under the same property.
  if (typeof response === "string") return response.trim();
  if (response !== undefined && response !== null) return JSON.stringify(response);

  // Be tolerant of wrappers returned by other Workers AI runtimes.
  if (candidate.result !== undefined && candidate.result !== null) {
    if (typeof candidate.result === "string") return candidate.result.trim();
    return JSON.stringify(candidate.result);
  }

  return "";
}

function parseJson<T>(text: string): T {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try { return JSON.parse(cleaned) as T; } catch {
    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");
    if (first >= 0 && last > first) {
      try { return JSON.parse(cleaned.slice(first, last + 1)) as T; } catch { /* fall through */ }
    }
    throw new AiProviderError("Cloudflare Workers AI returned invalid JSON.");
  }
}

async function runCloudflare(input: {
  prompt: string;
  systemInstruction?: string;
  schema: Record<string, unknown>;
  image?: { mimeType: string; bytes: Uint8Array };
}) {
  const ai = await getWorkersAi();
  if (!ai) throw new AiProviderError("Cloudflare Workers AI is unavailable. Confirm the Worker has an AI binding named AI and redeploy with Wrangler.");

  const hasImage = Boolean(input.image);
  const model = modelFor(hasImage);
  const messages = [
    { role: "system" as const, content: `${input.systemInstruction || "You are a conservative AI assistant for TradeMall."}\nReturn ONLY valid JSON matching the requested schema. Do not invent facts.` },
    { role: "user" as const, content: input.prompt },
  ];
  const request: Record<string, unknown> = {
    messages,
    temperature: 0.2,
    max_tokens: 4096,
    response_format: { type: "json_schema", json_schema: input.schema },
  };
  if (input.image) request.image = `data:${input.image.mimeType};base64,${base64(input.image.bytes)}`;

  let lastError: AiProviderError | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const result = await ai.run(model, request) as {
        response?: unknown;
        result?: unknown;
        usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
      };
      const text = responseToText(result);
      if (!text) {
        const keys = result && typeof result === "object" ? Object.keys(result) : [];
        console.error("Workers AI returned no usable response", { model, keys, responseType: typeof result?.response });
        throw new AiProviderError("Cloudflare Workers AI returned an empty response.");
      }
      return {
        text,
        model,
        usage: result.usage ? { inputTokens: result.usage.prompt_tokens, outputTokens: result.usage.completion_tokens, totalTokens: result.usage.total_tokens } : undefined,
      };
    } catch (error) {
      lastError = error instanceof AiProviderError
        ? error
        : new AiProviderError(`Cloudflare Workers AI failed: ${error instanceof Error ? error.message : String(error)}`);
      if (attempt >= MAX_RETRIES) throw lastError;
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
    }
  }
  throw lastError ?? new AiProviderError("Cloudflare Workers AI failed.");
}

export async function generateStructured<T>(input: { prompt: string; schema: Record<string, unknown>; systemInstruction?: string }): Promise<AiResult<T>> {
  if (input.prompt.length > MAX_PROMPT_CHARS) throw new AiProviderError("The AI request is too large. Shorten the input and try again.");
  const response = await runCloudflare(input);
  return { data: parseJson<T>(response.text), model: response.model, provider: "cloudflare", usage: response.usage };
}

export async function generateStructuredWithImage<T>(input: { prompt: string; schema: Record<string, unknown>; mimeType: string; bytes: Uint8Array; systemInstruction?: string }): Promise<AiResult<T>> {
  if (input.bytes.byteLength === 0 || input.bytes.byteLength > MAX_IMAGE_BYTES) throw new AiProviderError("The image is too large for AI analysis.");
  if (!/^image\/(png|jpe?g|webp|gif)$/i.test(input.mimeType)) throw new AiProviderError("TradeMall AI supports PNG, JPEG, WebP and GIF images only.");
  if (input.prompt.length > MAX_PROMPT_CHARS) throw new AiProviderError("The AI request is too large. Shorten the input and try again.");
  const response = await runCloudflare({ ...input, image: { mimeType: input.mimeType, bytes: input.bytes } });
  return { data: parseJson<T>(response.text), model: response.model, provider: "cloudflare", usage: response.usage };
}

export function getAiProviderStatus() {
  return [{ provider: "cloudflare" as const, configured: true, model: readEnv("CLOUDFLARE_AI_MODEL") || TEXT_MODEL }];
}
