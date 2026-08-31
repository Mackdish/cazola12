/**
 * Cloudflare Workers AI provider implementation.
 *
 * The AI binding exists only in a Cloudflare Workers request context. Local
 * testing of this provider requires `wrangler dev`, not plain `vite dev`.
 */

import { getWorkersAI, isWorkersAIAvailable } from "@/lib/runtime-bindings.server";
import { readEnv } from "@/lib/runtime-env.server";
import type { AIChatProvider, AIGenerationOptions } from "./ai-provider";
import { AIServiceError, classifyProviderError } from "./ai-provider";

export const WORKERS_AI_MODEL = readEnv("WORKERS_AI_MODEL") ?? "@cf/meta/llama-3.1-8b-instruct";

export function isWorkersAIConfigured(): boolean {
  return isWorkersAIAvailable();
}

function responseText(response: unknown): string {
  const content = (response as { response?: unknown } | null)?.response;
  if (typeof content !== "string" || !content.trim()) {
    throw new AIServiceError("Workers AI returned an invalid response.", "AI_RESPONSE_INVALID");
  }
  return content.trim();
}

export function createWorkersAIProvider(): AIChatProvider | null {
  if (!isWorkersAIConfigured()) return null;

  return {
    name: "workers-ai",
    model: WORKERS_AI_MODEL,

    async generateText(systemPrompt: string, userPrompt: string, options?: AIGenerationOptions) {
      const ai = await getWorkersAI();
      if (!ai) {
        throw new AIServiceError("Cloudflare Workers AI binding is not available.", "AI_CONFIGURATION_MISSING");
      }

      const response = await ai.run(WORKERS_AI_MODEL, {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxOutputTokens ?? 2000,
      });
      return responseText(response);
    },

    async diagnoseConnection() {
      const ai = await getWorkersAI();
      if (!ai) {
        return {
          configured: false,
          model: WORKERS_AI_MODEL,
          ok: false,
          category: "AI_CONFIGURATION_MISSING",
          message: "Cloudflare Workers AI binding is not available.",
        };
      }

      try {
        const response = await ai.run(WORKERS_AI_MODEL, {
          messages: [{ role: "user", content: "Return the word OK." }],
          max_tokens: 10,
        });
        return {
          configured: true,
          model: WORKERS_AI_MODEL,
          ok: true,
          responsePreview: responseText(response),
        };
      } catch (error: any) {
        const classified =
          error instanceof AIServiceError
            ? { category: error.category, message: error.message }
            : classifyProviderError("workers-ai", error);
        return {
          configured: true,
          model: WORKERS_AI_MODEL,
          ok: false,
          category: classified.category,
          message: classified.message,
          httpStatus: error?.status ?? error?.response?.status,
        };
      }
    },
  };
}
