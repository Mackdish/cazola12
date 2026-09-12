import { readEnv } from "@/lib/runtime-env.server";
import { getWorkersAi } from "@/lib/runtime-bindings.server";

const GEMINI_INTERACTIONS_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";
const DEFAULT_GEMINI_IMAGE_MODEL = "gemini-3.1-flash-image";
const DEFAULT_CLOUDFLARE_IMAGE_MODEL = "@cf/black-forest-labs/flux-1-schnell";
const TIMEOUT_MS = 90_000;
const MAX_RETRIES = 2;
// Cloudflare validates the prompt at the API boundary. Keep a generous margin below
// the documented 2048-character limit because non-ASCII input can occupy multiple bytes.
const CLOUDFLARE_MAX_PROMPT_BYTES = 1800;

type GeneratedImage = {
  bytes: Uint8Array;
  mimeType: string;
  model: string;
  provider: "cloudflare" | "gemini";
};

type ImageStep = {
  type?: string;
  content?: Array<{ type?: string; data?: string; mime_type?: string }>;
};

type GeminiImageResponse = {
  status?: string;
  model?: string;
  steps?: ImageStep[];
  error?: { message?: string };
};

export class AiImageError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "AiImageError";
  }
}

function retryable(status?: number) {
  return status === 408 || status === 409 || status === 429 || (status !== undefined && status >= 500);
}

function aspectRatioForFormat(format: string): string {
  switch (format) {
    case "728x90":
    case "320x50":
      return "8:1";
    case "970x250":
    case "320x100":
      return "4:1";
    case "300x250":
    case "336x280":
      return "5:4";
    case "responsive":
    default:
      return "1:1";
  }
}

function extractGeminiImage(payload: GeminiImageResponse): { bytes: Uint8Array; mimeType: string } {
  const parts = (payload.steps ?? []).flatMap((step) => step.content ?? []);
  const image = parts.find((part) => part.type === "image" && part.data);
  if (!image?.data) {
    throw new AiImageError(payload.error?.message || "Gemini did not return a generated image. Please try again.");
  }

  try {
    const binary = atob(image.data);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return { bytes, mimeType: image.mime_type || "image/jpeg" };
  } catch {
    throw new AiImageError("Gemini returned an unreadable image. Please try again.");
  }
}

function decodeBase64Image(data: unknown): Uint8Array {
  if (typeof data !== "string" || !data) {
    throw new AiImageError("Cloudflare Workers AI returned an empty image response. Please try again.");
  }

  try {
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    if (bytes.byteLength === 0) throw new Error("empty image");
    return bytes;
  } catch {
    throw new AiImageError("Cloudflare Workers AI returned an invalid image response. Please try again.");
  }
}

async function extractCloudflareImage(result: unknown): Promise<{ bytes: Uint8Array; mimeType: string }> {
  if (result instanceof Response) {
    if (!result.ok) {
      throw new AiImageError(`Cloudflare Workers AI image request failed (${result.status}).`, result.status);
    }
    const bytes = new Uint8Array(await result.arrayBuffer());
    if (bytes.byteLength === 0) {
      throw new AiImageError("Cloudflare Workers AI returned an empty image response.");
    }
    return { bytes, mimeType: result.headers.get("content-type") || "image/png" };
  }

  if (result && typeof result === "object" && "image" in result) {
    const image = (result as { image?: unknown }).image;
    if (typeof image === "string" && image.length > 0) {
      return { bytes: decodeBase64Image(image), mimeType: "image/png" };
    }
    if (image instanceof Uint8Array && image.byteLength > 0) {
      return { bytes: image, mimeType: "image/png" };
    }
    if (image instanceof ArrayBuffer && image.byteLength > 0) {
      return { bytes: new Uint8Array(image), mimeType: "image/png" };
    }
  }

  if (result instanceof ReadableStream) {
    const bytes = new Uint8Array(await new Response(result).arrayBuffer());
    if (bytes.byteLength > 0) return { bytes, mimeType: "image/png" };
  }

  if (result instanceof Uint8Array && result.byteLength > 0) {
    return { bytes: result, mimeType: "image/png" };
  }
  if (result instanceof ArrayBuffer && result.byteLength > 0) {
    return { bytes: new Uint8Array(result), mimeType: "image/png" };
  }
  if (typeof result === "string" && result.length > 0) {
    return { bytes: decodeBase64Image(result), mimeType: "image/png" };
  }

  let shape = "unknown";
  if (result && typeof result === "object") {
    try {
      shape = Object.keys(result as Record<string, unknown>).join(", ") || "object";
    } catch {
      shape = "object";
    }
  } else if (result === null) {
    shape = "null";
  } else {
    shape = typeof result;
  }

  throw new AiImageError(`Cloudflare Workers AI returned an empty image response (response shape: ${shape}). Please try again.`);
}

function describeCloudflareError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  try {
    const serialized = JSON.stringify(error);
    if (serialized && serialized !== "{}") return serialized;
  } catch {
    // Ignore serialization failures.
  }
  return "Cloudflare image generation failed. Please try again.";
}

function fitCloudflarePrompt(prompt: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(prompt);
  if (bytes.byteLength <= CLOUDFLARE_MAX_PROMPT_BYTES) return prompt;

  // Truncate by UTF-8 bytes, not JavaScript characters. This prevents API-side
  // length checks from rejecting prompts containing emojis or other Unicode text.
  const truncated = new TextDecoder().decode(bytes.slice(0, CLOUDFLARE_MAX_PROMPT_BYTES));
  return truncated.slice(0, Math.max(0, truncated.length - 40)).trimEnd() + "\nEnglish text only; use supplied facts.";
}

async function generateWithCloudflare(input: { prompt: string; format: string }): Promise<GeneratedImage> {
  const ai = await getWorkersAi();
  if (!ai) {
    throw new AiImageError(
      "Cloudflare Workers AI is not available. Confirm the Worker has an AI binding named AI and redeploy it.",
    );
  }

  const model = readEnv("CLOUDFLARE_IMAGE_MODEL") || DEFAULT_CLOUDFLARE_IMAGE_MODEL;
  const prompt = fitCloudflarePrompt(input.prompt);
  let lastError: AiImageError | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const result = await ai.run(model, { prompt });
      const image = await extractCloudflareImage(result);
      return { ...image, model, provider: "cloudflare" };
    } catch (error) {
      lastError = error instanceof AiImageError
        ? error
        : new AiImageError(`Cloudflare image generation failed: ${describeCloudflareError(error)}`);

      if (attempt >= MAX_RETRIES) throw lastError;
      await new Promise((resolve) => setTimeout(resolve, 600 * 2 ** attempt + Math.floor(Math.random() * 300)));
    }
  }

  throw lastError ?? new AiImageError("Cloudflare image generation failed. Please try again.");
}

async function generateWithGemini(input: { prompt: string; format: string }): Promise<GeneratedImage> {
  const apiKey = readEnv("GEMINI_API_KEY");
  if (!apiKey) throw new AiImageError("Gemini image generation is not configured. Add GEMINI_API_KEY to the server environment.");

  const model = readEnv("GEMINI_IMAGE_MODEL") || DEFAULT_GEMINI_IMAGE_MODEL;
  const body = {
    model,
    input: input.prompt,
    response_format: {
      type: "image",
      mime_type: "image/jpeg",
      aspect_ratio: aspectRatioForFormat(input.format),
      image_size: "1K",
    },
  };

  let lastError: AiImageError | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(GEMINI_INTERACTIONS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const raw = await response.text();
      let payload: GeminiImageResponse;
      try {
        payload = JSON.parse(raw) as GeminiImageResponse;
      } catch {
        throw new AiImageError(`Gemini image generation returned an invalid response (${response.status}).`, response.status);
      }
      if (!response.ok) {
        throw new AiImageError(payload.error?.message || `Gemini image generation failed (${response.status}).`, response.status);
      }
      const image = extractGeminiImage(payload);
      return { ...image, model: payload.model || model, provider: "gemini" };
    } catch (error) {
      if (error instanceof AiImageError) lastError = error;
      else if (error instanceof Error && error.name === "AbortError") lastError = new AiImageError("Gemini image generation timed out. Please try again.");
      else lastError = new AiImageError("Could not reach Gemini image generation. Please try again.");
      if (!retryable(lastError.status) || attempt >= MAX_RETRIES) throw lastError;
      await new Promise((resolve) => setTimeout(resolve, 600 * 2 ** attempt + Math.floor(Math.random() * 300)));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError ?? new AiImageError("Gemini image generation failed. Please try again.");
}

export async function generateAdImage(input: { prompt: string; format: string }): Promise<GeneratedImage> {
  const provider = (readEnv("AI_IMAGE_PROVIDER") || "cloudflare").toLowerCase();

  if (provider === "gemini") return generateWithGemini(input);
  if (provider === "cloudflare") {
    try {
      return await generateWithCloudflare(input);
    } catch (cloudflareError) {
      const fallback = (readEnv("AI_IMAGE_FALLBACK_PROVIDER") || "").toLowerCase();
      if (fallback === "gemini" && readEnv("GEMINI_API_KEY")) return generateWithGemini(input);
      throw cloudflareError;
    }
  }

  throw new AiImageError(`Unsupported AI image provider: ${provider}. Use cloudflare or gemini.`);
}
