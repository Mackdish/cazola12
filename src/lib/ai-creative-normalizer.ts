export type AiCreativeOutput = {
  productFocus: string;
  productHighlights: string[];
  headlines: string[];
  longHeadline: string;
  descriptions: string[];
  ctaRecommendations: string[];
  creativeConcepts: string[];
  recommendedFormats: string[];
};

function clean(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength).trim() : "";
}

function list(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => clean(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

export function normalizeAiCreativeOutput(value: unknown): AiCreativeOutput {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    productFocus: clean(input.productFocus, 200),
    productHighlights: list(input.productHighlights, 8, 300),
    headlines: list(input.headlines, 5, 90),
    longHeadline: clean(input.longHeadline, 120),
    descriptions: list(input.descriptions, 5, 150),
    ctaRecommendations: list(input.ctaRecommendations, 6, 40),
    creativeConcepts: list(input.creativeConcepts, 6, 600),
    recommendedFormats: list(input.recommendedFormats, 6, 80),
  };
}
