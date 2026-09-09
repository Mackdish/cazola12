import { readEnv } from "@/lib/runtime-env.server";

const GEMINI_INTERACTIONS_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";
const DEFAULT_IMAGE_MODEL = "gemini-3.1-flash-image";
const TIMEOUT_MS = 90_000;
const MAX_RETRIES = 2;

export class AiImageError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "AiImageError";
  }
}

type ImageStep = {
  type?: string;
  content?: Array<{
    type?: string;
    data?: string;
    mime_type?: string;
  }>;
};

type GeminiImageResponse = {
  status?: string;
  model?: string;
  steps?: ImageStep[];
  error?: { message?: string };
};

function retryable(status?: number) {
  return (
    status === 408 ||
    status === 409 ||
    status === 429 ||
    (status !== undefined && status >= 500)
  );
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

function extractImage(payload: GeminiImageResponse): { bytes: Uint8Array; mimeType: string } {
  const parts = (payload.steps ?? []).flatMap((step) => step.content ?? []);
  const image = parts.find((part) => part.type === "image" && part.data);
  if (!image?.data) {
    throw new AiImageError(
      payload.error?.message || "Gemini did not return a generated image. Please try again.",
    );
  }

  try {
    const binary = atob(image.data);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return { bytes, mimeType: image.mime_type || "image/png" };
  } catch {
    throw new AiImageError("Gemini returned an unreadable image. Please try again.");
  }
}

export async function generateAdImage(input: {
  prompt: string;
  format: string;
}): Promise<{ bytes: Uint8Array; mimeType: string; model: string }> {
  const apiKey = readEnv("GEMINI_API_KEY");
  if (!apiKey) {
    throw new AiImageError(
      "Gemini image generation is not configured. Add GEMINI_API_KEY to the server environment.",
    );
  }

  const model = readEnv("GEMINI_IMAGE_MODEL") || DEFAULT_IMAGE_MODEL;
  const body = {
    model,
    input: input.prompt,
    response_format: {
      type: "image",
      mime_type: "image/png",
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
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const raw = await response.text();
      let payload: GeminiImageResponse;
      try {
        payload = JSON.parse(raw) as GeminiImageResponse;
      } catch {
        throw new AiImageError(
          `Gemini image generation returned an invalid response (${response.status}).`,
          response.status,
        );
      }

      if (!response.ok) {
        throw new AiImageError(
          payload.error?.message || `Gemini image generation failed (${response.status}).`,
          response.status,
        );
      }

      const image = extractImage(payload);
      return { ...image, model: payload.model || model };
    } catch (error) {
      if (error instanceof AiImageError) lastError = error;
      else if (error instanceof Error && error.name === "AbortError")
        lastError = new AiImageError("Gemini image generation timed out. Please try again.");
      else lastError = new AiImageError("Could not reach Gemini image generation. Please try again.");

      if (!retryable(lastError.status) || attempt >= MAX_RETRIES) throw lastError;
      await new Promise((resolve) =>
        setTimeout(resolve, 600 * 2 ** attempt + Math.floor(Math.random() * 300)),
      );
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError ?? new AiImageError("Gemini image generation failed. Please try again.");
}
