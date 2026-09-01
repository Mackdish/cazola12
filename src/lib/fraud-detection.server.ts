/**
 * Server-only fraud detection service.
 *
 * Evaluates signals against configured rules and records fraud events.
 * Does not auto-block unless the rule explicitly requires it.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;

export class FraudError extends Error {}

export type FraudSignal = {
  type: string;
  severity: "normal" | "suspicious" | "blocked" | "review_required";
  score: number;
  metadata: Record<string, unknown>;
};

export type FraudEvaluation = {
  overallScore: number;
  status: "normal" | "suspicious" | "blocked" | "review_required";
  signals: FraudSignal[];
};

export async function evaluateClickFraud(
  client: Client,
  input: {
    ipAddress: string;
    userAgent: string;
    campaignId: string;
    publisherId: string;
    websiteId: string;
    adZoneId: string;
    requestId: string;
  },
): Promise<FraudEvaluation> {
  const signals: FraudSignal[] = [];

  const [recentClicks, recentImpressions, ipHistory] = await Promise.all([
    client
      .from("clicks")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", input.campaignId)
      .eq("publisher_id", input.publisherId)
      .gte("created_at", new Date(Date.now() - 60 * 1000).toISOString()),
    client
      .from("impressions")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", input.campaignId)
      .eq("publisher_id", input.publisherId)
      .gte("created_at", new Date(Date.now() - 60 * 1000).toISOString()),
    client
      .from("fraud_events" as never)
      .select("severity, score")
      .eq("ip_address", input.ipAddress)
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
  ]);

  const clickCount = recentClicks.count ?? 0;
  const impressionCount = recentImpressions.count ?? 0;
  const history = ipHistory.data ?? [];

  if (clickCount > 10) {
    signals.push({
      type: "rapid_clicks",
      severity: clickCount > 30 ? "blocked" : "suspicious",
      score: Math.min(1, clickCount / 50),
      metadata: { clickCount, windowMs: 60000 },
    });
  }

  if (impressionCount > 0 && clickCount / impressionCount > 0.5) {
    signals.push({
      type: "abnormal_ctr",
      severity: "review_required",
      score: 0.7,
      metadata: {
        ctr: clickCount / impressionCount,
        clicks: clickCount,
        impressions: impressionCount,
      },
    });
  }

  const repeatOffenderScore =
    history.reduce((s, e) => s + Number((e as { score?: number }).score ?? 0), 0) /
    Math.max(1, history.length);
  if (history.length > 3 && repeatOffenderScore > 0.5) {
    signals.push({
      type: "ip_repeat_offender",
      severity: "blocked",
      score: 0.9,
      metadata: { historyCount: history.length, avgScore: repeatOffenderScore },
    });
  }

  const ua = input.userAgent.toLowerCase();
  if (
    ua.includes("bot") ||
    ua.includes("crawler") ||
    ua.includes("spider") ||
    ua.includes("headless") ||
    ua.includes("phantom")
  ) {
    signals.push({
      type: "suspicious_user_agent",
      severity: "blocked",
      score: 0.95,
      metadata: { userAgent: input.userAgent },
    });
  }

  const overallScore = signals.reduce((s, sig) => s + sig.score, 0) / Math.max(1, signals.length);
  let status: FraudEvaluation["status"] = "normal";
  if (signals.some((s) => s.severity === "blocked")) status = "blocked";
  else if (signals.some((s) => s.severity === "review_required")) status = "review_required";
  else if (signals.some((s) => s.severity === "suspicious")) status = "suspicious";

  return { overallScore, status, signals };
}

export async function evaluateImpressionFraud(
  client: Client,
  input: {
    ipAddress: string;
    userAgent: string;
    campaignId: string;
    publisherId: string;
    websiteId: string;
    adZoneId: string;
    requestId: string;
  },
): Promise<FraudEvaluation> {
  const signals: FraudSignal[] = [];

  const [recentImpressions, ipHistory] = await Promise.all([
    client
      .from("impressions")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", input.campaignId)
      .eq("publisher_id", input.publisherId)
      .gte("created_at", new Date(Date.now() - 60 * 1000).toISOString()),
    client
      .from("fraud_events" as never)
      .select("severity, score")
      .eq("ip_address", input.ipAddress)
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
  ]);

  const impressionCount = recentImpressions.count ?? 0;
  const history = ipHistory.data ?? [];

  if (impressionCount > 100) {
    signals.push({
      type: "excessive_impressions",
      severity: impressionCount > 500 ? "blocked" : "suspicious",
      score: Math.min(1, impressionCount / 1000),
      metadata: { impressionCount, windowMs: 60000 },
    });
  }

  const repeatOffenderScore =
    history.reduce((s, e) => s + Number((e as { score?: number }).score ?? 0), 0) /
    Math.max(1, history.length);
  if (history.length > 3 && repeatOffenderScore > 0.5) {
    signals.push({
      type: "ip_repeat_offender",
      severity: "blocked",
      score: 0.9,
      metadata: { historyCount: history.length, avgScore: repeatOffenderScore },
    });
  }

  const ua = input.userAgent.toLowerCase();
  if (
    ua.includes("bot") ||
    ua.includes("crawler") ||
    ua.includes("spider") ||
    ua.includes("headless") ||
    ua.includes("phantom")
  ) {
    signals.push({
      type: "suspicious_user_agent",
      severity: "blocked",
      score: 0.95,
      metadata: { userAgent: input.userAgent },
    });
  }

  const overallScore = signals.reduce((s, sig) => s + sig.score, 0) / Math.max(1, signals.length);
  let status: FraudEvaluation["status"] = "normal";
  if (signals.some((s) => s.severity === "blocked")) status = "blocked";
  else if (signals.some((s) => s.severity === "review_required")) status = "review_required";
  else if (signals.some((s) => s.severity === "suspicious")) status = "suspicious";

  return { overallScore, status, signals };
}

export async function recordFraudEvent(
  client: Client,
  evaluation: FraudEvaluation,
  input: {
    eventType: string;
    actorType: string;
    actorId: string;
    targetType: string;
    targetId: string;
    ipAddress: string;
    userAgent: string;
    country: string;
  },
): Promise<void> {
  if (evaluation.status === "normal") return;

  const severity =
    evaluation.status === "blocked"
      ? "blocked"
      : evaluation.status === "review_required"
        ? "review_required"
        : "suspicious";

  await client.rpc(
    "record_fraud_event" as never,
    {
      _event_type: input.eventType,
      _severity: severity,
      _actor_type: input.actorType,
      _actor_id: input.actorId,
      _target_type: input.targetType,
      _target_id: input.targetId,
      _ip_address: input.ipAddress ?? null,
      _user_agent: input.userAgent ?? null,
      _country: input.country ?? null,
      _signals: evaluation.signals as unknown as never,
      _score: evaluation.overallScore,
    } as never,
  );
}
