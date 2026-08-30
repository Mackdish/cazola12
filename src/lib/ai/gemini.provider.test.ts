import { describe, expect, it, vi, beforeEach } from "vitest";

const { mockGenerateContent, MockGoogleGenAI } = vi.hoisted(() => {
  const mockGenerateContent = vi.fn();
  const MockGoogleGenAI = vi.fn().mockImplementation(function () {
    return {
      models: { generateContent: mockGenerateContent },
    };
  });
  return { mockGenerateContent, MockGoogleGenAI };
});

vi.mock("@google/genai", () => ({
  GoogleGenAI: MockGoogleGenAI,
}));

import { createGeminiProvider } from "@/lib/ai/gemini.provider";

describe("gemini.provider", () => {
  beforeEach(() => {
    mockGenerateContent.mockReset();
    MockGoogleGenAI.mockClear();
    vi.stubEnv("GEMINI_MODEL", "");
    vi.stubEnv("GEMINI_API_KEY", "test-api-key");
  });

  it("uses config, not generationConfig, in generateContent calls", async () => {
    mockGenerateContent.mockResolvedValue({ text: "OK" });

    const provider = createGeminiProvider();
    const result = await provider.generateText("system", "user", { temperature: 0.5, maxOutputTokens: 100 });

    expect(result).toBe("OK");
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    const callArgs = mockGenerateContent.mock.calls[0][0];
    expect(callArgs).toHaveProperty("config");
    expect(callArgs).not.toHaveProperty("generationConfig");
    expect(callArgs.config).toMatchObject({
      temperature: 0.5,
      maxOutputTokens: 100,
      responseMimeType: "application/json",
    });
  });

  it("uses config, not generationConfig, in diagnoseConnection calls", async () => {
    mockGenerateContent.mockResolvedValue({ text: "OK" });

    const provider = createGeminiProvider();
    const result = await provider.diagnoseConnection();

    expect(result.ok).toBe(true);
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    const callArgs = mockGenerateContent.mock.calls[0][0];
    expect(callArgs).toHaveProperty("config");
    expect(callArgs).not.toHaveProperty("generationConfig");
    expect(callArgs.config).toMatchObject({
      maxOutputTokens: 10,
      responseMimeType: "text/plain",
    });
  });

  it("falls back to gemini-2.5-flash when GEMINI_MODEL is not set", async () => {
    mockGenerateContent.mockResolvedValue({ text: "OK" });
    const provider = createGeminiProvider();
    expect(provider.model).toBe("gemini-2.5-flash");
  });
});
