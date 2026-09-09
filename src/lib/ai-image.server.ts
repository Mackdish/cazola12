import { readEnv } from "@/lib/runtime-env.server";
import { getWorkersAi } from "@/lib/runtime-bindings.server";

const GEMINI_INTERACTIONS_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";
const DEFAULT_GEMINI_IMAGE_MODEL = "gemini-3.1-flash-image";
const DEFAULT_CLOUDFLARE_IMAGE_MODEL = "@cf/black-forest-labs/flux-1-schnell";
const TIMEOUT_MS = 90_000;
const MAX_RETRIES = 2;

type GeneratedImage = { bytes: Uint8Array; mimeType: string; model: string; provider: "cloudflare" | "gemini" };

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
  if (typeof data !== "string" || !data) throw new AiImageError("Cloudflare did not return a generated image.");
  try {
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  } catch {
    throw new AiImageError("Cloudflare returned an unreadable image. Please try again.");
  }
}

async function generateWithCloudflare(input: { prompt: string; format: string }): Promise<GeneratedImage> {
  const ai = await getWorkersAi();
  if (!ai) throw new AiImageError("Cloudflare Workers AI is not available. Check that the AI binding is configured on this Worker.");

  const model = readEnv("CLOUDFLARE_IMAGE_MODEL") || DEFAULT_CLOUDFLARE_IMAGE_MODEL;
  let lastError: AiImageError | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const result = await ai.run(model, {
        prompt: input.prompt,
        seed: Math.floor(Math.random() * 2_147_483_647),
      }) as { image?: unknown };
      const bytes = decodeBase64Image(result.image);
      return { bytes, mimeType: "image/jpeg", model, provider: "cloudflare" };
    } catch (error) {
      lastError = error instanceof AiImageError ? error : new AiImageError("Cloudflare image generation failed. Please try again.");
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
