/**
 * Gemini AI provider implementation using @google/genai.
 *
 * Server-side only. Never import this file from client/browser code.
 */

import { GoogleGenAI, type GenerationResponse } from "@google/genai";
import { readEnv } from "@/lib/runtime-env.server";
import type { AIChatProvider, AIGenerationOptions } from "./ai-provider";
import { AIServiceError, classifyProviderError } from "./ai-provider";

let _client: GoogleGenAI | null = null;
let _cachedKey: string | undefined;

function resolveApiKey(): string | undefined {
  if (_cachedKey) return _cachedKey;
  _cachedKey = readEnv("GEMINI_API_KEY");
  return _cachedKey;
}

function getClient(): GoogleGenAI {
  const apiKey = resolveApiKey();
  if (!apiKey) {
    throw new AIServiceError("GEMINI_API_KEY is not configured.", "AI_CONFIGURATION_MISSING");
  }
  if (!_client) {
    _client = new GoogleGenAI({ apiKey });
  }
  return _client;
}

export const GEMINI_MODEL = readEnv("GEMINI_MODEL") ?? "gemini-2.0-flash";

export function isGeminiConfigured(): boolean {
  return Boolean(resolveApiKey());
}

export function createGeminiProvider(): AIChatProvider {
  return {
    name: "gemini",
    model: GEMINI_MODEL,

    async generateText(systemPrompt: string, userPrompt: string, options?: AIGenerationOptions) {
      const client = getClient();

      console.log("[ai][gemini] request start", {
        model: GEMINI_MODEL,
        systemPromptLength: systemPrompt.length,
        userPromptLength: userPrompt.length,
      });

      const startTime = Date.now();
      try {
        const response = await client.models.generateContent({
          model: GEMINI_MODEL,
          contents: [
            { role: "user", parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] },
          ],
          generationConfig: {
            temperature: options?.temperature ?? 0.7,
            maxOutputTokens: options?.maxOutputTokens ?? 2000,
            responseMimeType: "application/json",
          },
        });

        const duration = Date.now() - startTime;
        const content = response.text?.trim();

        console.log("[ai][gemini] request complete", {
          model: GEMINI_MODEL,
          durationMs: duration,
          finishReason: (response as any)?.finishReason,
          hasContent: Boolean(content),
        });

        if (!content) {
          console.log("[ai][gemini] provider unavailable", {
            finishReason: (response as any)?.finishReason,
          });
          throw new AIServiceError("AI_PROVIDER_UNAVAILABLE", "AI_PROVIDER_UNAVAILABLE");
        }

        return content;
      } catch (error) {
        const duration = Date.now() - startTime;
        console.log("[ai][gemini] request error", {
          model: GEMINI_MODEL,
          durationMs: duration,
          errorType: error instanceof Error ? error.constructor.name : String(error),
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStatus: (error as any)?.status ?? (error as any)?.response?.status,
          errorCode: (error as any)?.code ?? (error as any)?.type,
          providerError: (error as any)?.error,
        });
        throw error;
      }
    },

    async diagnoseConnection() {
      const configured = isGeminiConfigured();
      const model = GEMINI_MODEL;

      if (!configured) {
        return { configured: false, model, ok: false, category: "AI_CONFIGURATION_MISSING", message: "API key missing." };
      }

      try {
        const client = getClient();
        const response = await client.models.generateContent({
          model,
          contents: [{ role: "user", parts: [{ text: "Return the word OK." }] }],
          generationConfig: {
            maxOutputTokens: 10,
            responseMimeType: "text/plain",
          },
        });

        const content = response.text?.trim();
        return {
          configured: true,
          model,
          ok: true,
          responsePreview: content ?? "(empty)",
        };
      } catch (error: any) {
        const status = error?.status ?? error?.response?.status;
        const { category, message } = classifyProviderError("gemini", error);

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

export function resetGeminiCache(): void {
  _client = null;
  _cachedKey = undefined;
}
