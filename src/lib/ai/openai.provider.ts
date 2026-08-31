/**
 * OpenAI provider implementation.
 *
 * Server-side only. Never import this file from client/browser code.
 */

import OpenAI from "openai";
import { readEnv } from "@/lib/runtime-env.server";
import type { AIChatProvider, AIGenerationOptions } from "./ai-provider";
import { AIServiceError, classifyProviderError } from "./ai-provider";

let _openai: OpenAI | null = null;
let _cachedKey: string | undefined;

function resolveApiKey(): string | undefined {
  if (_cachedKey) return _cachedKey;
  _cachedKey = readEnv("OPENAI_API_KEY")?.trim() || undefined;
  return _cachedKey;
}

function getClient(): OpenAI {
  const apiKey = resolveApiKey();
  if (!apiKey) {
    throw new AIServiceError("OPENAI_API_KEY is not configured.", "AI_CONFIGURATION_MISSING");
  }
  if (!_openai) {
    _openai = new OpenAI({ apiKey });
  }
  return _openai;
}

export const OPENAI_MODEL = readEnv("OPENAI_MODEL") ?? "gpt-4o-mini";

export function isOpenAIConfigured(): boolean {
  return Boolean(resolveApiKey());
}

export function createOpenAIProvider(): AIChatProvider | null {
  if (!isOpenAIConfigured()) return null;

  return {
    name: "openai",
    model: OPENAI_MODEL,

    async generateText(systemPrompt: string, userPrompt: string, options?: AIGenerationOptions) {
      const client = getClient();

      console.log("[ai][openai] request start", {
        model: OPENAI_MODEL,
        systemPromptLength: systemPrompt.length,
        userPromptLength: userPrompt.length,
      });

      const startTime = Date.now();
      try {
        const response = await client.chat.completions.create({
          model: OPENAI_MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
          temperature: options?.temperature ?? 0.7,
          max_tokens: options?.maxOutputTokens ?? 2000,
        });

        const duration = Date.now() - startTime;
        const content = response.choices[0]?.message?.content?.trim();

        console.log("[ai][openai] request complete", {
          model: OPENAI_MODEL,
          durationMs: duration,
          finishReason: response.choices[0]?.finish_reason,
          hasContent: Boolean(content),
        });

        if (!content) {
          console.log("[ai][openai] provider unavailable", {
            finishReason: response.choices[0]?.finish_reason,
          });
          throw new AIServiceError("AI_PROVIDER_UNAVAILABLE", "AI_PROVIDER_UNAVAILABLE");
        }

        return content;
      } catch (error) {
        const duration = Date.now() - startTime;
        console.log("[ai][openai] request error", {
          model: OPENAI_MODEL,
          durationMs: duration,
          errorType: error instanceof Error ? error.constructor.name : String(error),
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStatus: (error as any)?.status ?? (error as any)?.response?.status,
          errorCode: (error as any)?.code ?? (error as any)?.type,
          openaiError: (error as any)?.error,
        });
        throw error;
      }
    },

    async diagnoseConnection() {
      const configured = isOpenAIConfigured();
      const model = OPENAI_MODEL;

      if (!configured) {
        return { configured: false, model, ok: false, category: "AI_CONFIGURATION_MISSING", message: "API key missing." };
      }

      try {
        const client = getClient();
        const response = await client.chat.completions.create({
          model,
          messages: [{ role: "user", content: "Return the word OK." }],
          max_tokens: 10,
        });

        const content = response.choices[0]?.message?.content?.trim();
        return {
          configured: true,
          model,
          ok: true,
          responsePreview: content ?? "(empty)",
        };
      } catch (error: any) {
        const status = error?.status ?? error?.response?.status;
        const { category, message } = classifyProviderError("openai", error);

        return {
          configured: true,
          model,
          ok: false,
          category,
          message,
          httpStatus: status,
        };
      }
    },
  };
}

export function resetOpenAICache(): void {
  _openai = null;
  _cachedKey = undefined;
}
