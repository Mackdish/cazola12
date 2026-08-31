/**
 * Provider-agnostic AI service abstraction.
 *
 * Each AI provider implements this interface so the rest of the
 * TradeMall AI system can switch providers without changing
 * campaign generation logic.
 */

export interface AIChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIGenerationOptions {
  temperature?: number;
  maxOutputTokens?: number;
}

export interface AIChatProvider {
  readonly name: string;
  readonly model: string;

  generateText(systemPrompt: string, userPrompt: string, options?: AIGenerationOptions): Promise<string>;

  diagnoseConnection(): Promise<{
    ok: boolean;
    category?: string;
    message?: string;
    httpStatus?: number;
    responsePreview?: string;
  }>;
}

export class AIServiceError extends Error {
  constructor(
    message: string,
    public override readonly category:
      | "AI_CONFIGURATION_MISSING"
      | "AI_AUTH_ERROR"
      | "AI_RATE_LIMIT_ERROR"
      | "AI_QUOTA_ERROR"
      | "AI_MODEL_ERROR"
      | "AI_MODEL_UNAVAILABLE"
      | "AI_REQUEST_ERROR"
      | "AI_SCHEMA_ERROR"
      | "AI_TIMEOUT"
      | "AI_PROVIDER_ERROR"
      | "AI_INTERNAL_ERROR"
      | "AI_PROVIDER_UNAVAILABLE"
      | "AI_RESPONSE_INVALID"
      | "AI_REQUEST_FAILED" = "AI_INTERNAL_ERROR",
    public override readonly cause?: unknown,
  ) {
    super(message);
  }
}

export function classifyProviderError(
  provider: string,
  error: unknown,
): { category: AIServiceError["category"]; message: string } {
  const err = error as any;
  const status = err?.status ?? err?.response?.status;
  const code = err?.code ?? err?.type;
  const message = err?.message ?? String(error);
  const providerError = err?.error;

  if (status === 401 || status === 403) {
    return { category: "AI_AUTH_ERROR", message: "Authentication failed." };
  }

  if (status === 429) {
    const errorCode = providerError?.error?.code ?? code;
    const errorMessage = providerError?.error?.message ?? message;

    if (errorCode === "insufficient_quota" || /quota|billing|credits/i.test(errorMessage)) {
      return { category: "AI_QUOTA_ERROR", message: "Quota or billing limit reached." };
    }

    return { category: "AI_RATE_LIMIT_ERROR", message: "Rate limit exceeded." };
  }

  if (status === 404) {
    return { category: "AI_MODEL_UNAVAILABLE", message: `Model not found.` };
  }

  if (status === 400) {
    return { category: "AI_REQUEST_ERROR", message };
  }

  if (status && status >= 500) {
    return { category: "AI_PROVIDER_ERROR", message: `Provider error (HTTP ${status}).` };
  }

  if (code === "ECONNREFUSED" || code === "ETIMEDOUT" || code === "ENOTFOUND" || code === "EAI_AGAIN") {
    return { category: "AI_TIMEOUT", message: "Network error reaching provider." };
  }

  return { category: "AI_INTERNAL_ERROR", message };
}
