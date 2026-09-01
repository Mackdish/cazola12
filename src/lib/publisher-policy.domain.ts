/**
 * Publisher policy center domain types and helpers.
 */

export type PolicyStatus = "good" | "warning" | "restricted" | "suspended";
export type ViolationSeverity = "low" | "medium" | "high" | "critical";
export type ViolationStatus = "open" | "in_review" | "resolved" | "dismissed";

export const POLICY_STATUS_TONE: Record<PolicyStatus, string> = {
  good: "text-success",
  warning: "text-yellow-600",
  restricted: "text-orange-600",
  suspended: "text-destructive",
};

export const VIOLATION_SEVERITY_TONE: Record<ViolationSeverity, string> = {
  low: "text-muted-foreground",
  medium: "text-yellow-600",
  high: "text-orange-600",
  critical: "text-destructive",
};

export function policyStatusLabel(status: PolicyStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function violationSeverityLabel(severity: ViolationSeverity): string {
  return severity.charAt(0).toUpperCase() + severity.slice(1);
}

export function violationStatusLabel(status: ViolationStatus): string {
  return status.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

export function computeHealthScore(checks: { passed: boolean; score: number }[]): number {
  if (!checks.length) return 0;
  const total = checks.reduce((sum, check) => sum + check.score, 0);
  return Math.min(100, Math.round(total / checks.length));
}
