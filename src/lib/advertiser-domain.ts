import type { Database } from "@/integrations/supabase/types";
import type { StatusTone } from "@/components/patterns/status-badge";
import {
  AD_FORMATS,
  adFormatSpec,
  type AdFormat,
  type WebsiteCategory,
} from "@/lib/publisher-domain";

export type CampaignStatus = Database["public"]["Enums"]["campaign_status"];
export type CampaignObjective = Database["public"]["Enums"]["campaign_objective"];
export type BidType = Database["public"]["Enums"]["bid_type"];
export type DeviceType = Database["public"]["Enums"]["device_type"];
export type OsType = Database["public"]["Enums"]["os_type"];
export type BrowserType = Database["public"]["Enums"]["browser_type"];
export type MediaStatus = Database["public"]["Enums"]["media_status"];

export type Advertiser = Database["public"]["Tables"]["advertisers"]["Row"];
export type Campaign = Database["public"]["Tables"]["campaigns"]["Row"];
export type AdGroup = Database["public"]["Tables"]["ad_groups"]["Row"];
export type Ad = Database["public"]["Tables"]["ads"]["Row"];
export type MediaAsset = Database["public"]["Tables"]["media_assets"]["Row"];
export type CampaignTargeting = Database["public"]["Tables"]["campaign_targeting"]["Row"];

export { AD_FORMATS, adFormatSpec };
export type { AdFormat };

// ------------------------------------------------------------------ lifecycle

export const CAMPAIGN_STATUSES: Array<{ value: CampaignStatus; label: string }> = [
  { value: "draft", label: "Draft" },
  { value: "pending_review", label: "Pending review" },
  { value: "approved", label: "Approved" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
  { value: "rejected", label: "Rejected" },
];

export function campaignStatusLabel(status: CampaignStatus): string {
  return CAMPAIGN_STATUSES.find((entry) => entry.value === status)?.label ?? status;
}

export function campaignStatusTone(status: CampaignStatus): StatusTone {
  switch (status) {
    case "active":
    case "approved":
      return "active";
    case "pending_review":
      return "pending";
    case "rejected":
      return "suspended";
    case "paused":
      return "info";
    default:
      return "neutral";
  }
}

/** Who is allowed to move a campaign into a given state. */
export type Actor = "advertiser" | "admin";

/** Deterministic lifecycle graph. Everything not listed here is rejected. */
export const CAMPAIGN_TRANSITIONS: Record<
  CampaignStatus,
  Array<{ to: CampaignStatus; actor: Actor }>
> = {
  draft: [{ to: "pending_review", actor: "advertiser" }],
  pending_review: [
    { to: "approved", actor: "admin" },
    { to: "rejected", actor: "admin" },
    { to: "draft", actor: "advertiser" },
  ],
  approved: [
    { to: "active", actor: "advertiser" },
    { to: "active", actor: "admin" },
    { to: "paused", actor: "admin" },
    { to: "rejected", actor: "admin" },
  ],
  active: [
    { to: "paused", actor: "advertiser" },
    { to: "paused", actor: "admin" },
    { to: "completed", actor: "advertiser" },
    { to: "completed", actor: "admin" },
    { to: "rejected", actor: "admin" },
  ],
  paused: [
    { to: "active", actor: "advertiser" },
    { to: "active", actor: "admin" },
    { to: "completed", actor: "advertiser" },
    { to: "completed", actor: "admin" },
    { to: "rejected", actor: "admin" },
  ],
  completed: [],
  rejected: [{ to: "draft", actor: "advertiser" }],
};

export function canTransition(from: CampaignStatus, to: CampaignStatus, actor: Actor): boolean {
  return CAMPAIGN_TRANSITIONS[from].some((entry) => entry.to === to && entry.actor === actor);
}

export function allowedTransitions(from: CampaignStatus, actor: Actor): CampaignStatus[] {
  return Array.from(
    new Set(
      CAMPAIGN_TRANSITIONS[from].filter((entry) => entry.actor === actor).map((entry) => entry.to),
    ),
  );
}

export function assertTransition(from: CampaignStatus, to: CampaignStatus, actor: Actor): void {
  if (!canTransition(from, to, actor)) {
    throw new Error(
      `Cannot move a ${campaignStatusLabel(from).toLowerCase()} campaign to ${campaignStatusLabel(to).toLowerCase()}.`,
    );
  }
}

// ----------------------------------------------------------------- objectives

export const CAMPAIGN_OBJECTIVES: Array<{
  value: CampaignObjective;
  label: string;
  description: string;
}> = [
  { value: "awareness", label: "Awareness", description: "Maximise reach and impressions." },
  { value: "traffic", label: "Traffic", description: "Drive clicks to your landing page." },
  { value: "engagement", label: "Engagement", description: "Encourage on-site interaction." },
  { value: "conversions", label: "Conversions", description: "Optimise for sign-ups and sales." },
  {
    value: "app_installs",
    label: "App installs",
    description: "Send people to your app store listing.",
  },
];

export const BID_TYPES: Array<{ value: BidType; label: string; hint: string }> = [
  { value: "cpm", label: "CPM", hint: "Cost per 1,000 impressions." },
  { value: "cpc", label: "CPC", hint: "Cost per click." },
];

export function objectiveLabel(value: CampaignObjective): string {
  return CAMPAIGN_OBJECTIVES.find((entry) => entry.value === value)?.label ?? value;
}

// ------------------------------------------------------------------ creatives

export const ALLOWED_CREATIVE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;
export type CreativeMimeType = (typeof ALLOWED_CREATIVE_MIME_TYPES)[number];

/** Hard ceiling per creative file (bytes). */
export const MAX_CREATIVE_BYTES = 2 * 1024 * 1024;
/** GIFs compress poorly; keep them tighter so page weight stays sane. */
export const MAX_ANIMATED_CREATIVE_BYTES = 1 * 1024 * 1024;

export function isAllowedCreativeMime(mime: string): mime is CreativeMimeType {
  return (ALLOWED_CREATIVE_MIME_TYPES as readonly string[]).includes(mime);
}

export function maxBytesForMime(mime: string): number {
  return mime === "image/gif" ? MAX_ANIMATED_CREATIVE_BYTES : MAX_CREATIVE_BYTES;
}

export function validateCreativeFile(input: {
  mimeType: string;
  fileSize: number;
}): CreativeValidation {
  if (!isAllowedCreativeMime(input.mimeType)) {
    return { ok: false, message: "Creatives must be PNG, JPG, WebP or GIF images." };
  }
  if (input.fileSize <= 0) return { ok: false, message: "That file appears to be empty." };
  const max = maxBytesForMime(input.mimeType);
  if (input.fileSize > max) {
    return {
      ok: false,
      message: `That file is ${formatFileSize(input.fileSize)}. The limit is ${formatFileSize(max)}.`,
    };
  }
  return { ok: true };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export type CreativeValidation = { ok: true } | { ok: false; message: string };

/** Responsive creatives may be any sane size; fixed formats must match exactly. */
export function validateCreativeAgainstFormat(
  format: AdFormat,
  dimensions: { width: number; height: number },
): CreativeValidation {
  const spec = adFormatSpec(format);
  if (spec.width === null || spec.height === null) {
    if (dimensions.width < 50 || dimensions.height < 50) {
      return { ok: false, message: "Responsive creatives must be at least 50×50 pixels." };
    }
    if (dimensions.width > 2000 || dimensions.height > 2000) {
      return { ok: false, message: "Responsive creatives must be at most 2000×2000 pixels." };
    }
    return { ok: true };
  }
  if (dimensions.width !== spec.width || dimensions.height !== spec.height) {
    return {
      ok: false,
      message: `This creative is ${dimensions.width}×${dimensions.height}. The ${format} format needs exactly ${spec.width}×${spec.height}.`,
    };
  }
  return { ok: true };
}

export function sanitizeFilename(name: string): string {
  const cleaned = name
    .replace(/[\0\r\n]/g, "")
    .replace(/[\\/]/g, "_")
    .replace(/[<>:"|?*]/g, "_")
    .replace(/[\x00-\x1f\x7f]/g, "")
    .trim()
    .slice(0, 160);
  return cleaned || "creative";
}

/** Storage key layout: <organizationId>/<advertiserId>/<uuid>.<ext>. */
export function creativeStoragePath(input: {
  organizationId: string;
  advertiserId: string;
  assetId: string;
  mimeType: string;
}): string {
  const ext =
    input.mimeType === "image/png"
      ? "png"
      : input.mimeType === "image/jpeg"
        ? "jpg"
        : input.mimeType === "image/webp"
          ? "webp"
          : "gif";
  return `${input.organizationId}/${input.advertiserId}/${input.assetId}.${ext}`;
}

/** The organization that owns a storage key, used to enforce ownership. */
export function organizationFromStoragePath(path: string): string | null {
  const [org] = path.split("/");
  return org && org.length > 0 ? org : null;
}

// ------------------------------------------------------------------ targeting

export const DEVICE_OPTIONS: Array<{ value: DeviceType; label: string }> = [
  { value: "desktop", label: "Desktop" },
  { value: "mobile", label: "Mobile" },
  { value: "tablet", label: "Tablet" },
];

export const OS_OPTIONS: Array<{ value: OsType; label: string }> = [
  { value: "windows", label: "Windows" },
  { value: "macos", label: "macOS" },
  { value: "linux", label: "Linux" },
  { value: "android", label: "Android" },
  { value: "ios", label: "iOS" },
  { value: "other", label: "Other" },
];

export const BROWSER_OPTIONS: Array<{ value: BrowserType; label: string }> = [
  { value: "chrome", label: "Chrome" },
  { value: "firefox", label: "Firefox" },
  { value: "safari", label: "Safari" },
  { value: "edge", label: "Edge" },
  { value: "opera", label: "Opera" },
  { value: "other", label: "Other" },
];

export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** Hour ranges per weekday. Empty object = always on. */
export type TargetingSchedule = Partial<Record<Weekday, Array<{ start: number; end: number }>>>;

export type TargetingRules = {
  countries: string[];
  counties: string[];
  cities: string[];
  devices: DeviceType[];
  operatingSystems: OsType[];
  browsers: BrowserType[];
  websiteCategories: WebsiteCategory[];
  schedule: TargetingSchedule;
  frequencyCap: { impressions: number; periodHours: number } | null;
};

export const EMPTY_TARGETING: TargetingRules = {
  countries: [],
  counties: [],
  cities: [],
  devices: [],
  operatingSystems: [],
  browsers: [],
  websiteCategories: [],
  schedule: {},
  frequencyCap: null,
};

export function parseSchedule(value: unknown): TargetingSchedule {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: TargetingSchedule = {};
  for (const day of WEEKDAYS) {
    const raw = (value as Record<string, unknown>)[day];
    if (!Array.isArray(raw)) continue;
    const ranges = raw
      .filter(
        (entry): entry is { start: number; end: number } =>
          Boolean(entry) &&
          typeof entry === "object" &&
          Number.isFinite((entry as { start?: unknown }).start) &&
          Number.isFinite((entry as { end?: unknown }).end),
      )
      .map((entry) => ({
        start: Math.max(0, Math.min(23, Math.floor(entry.start))),
        end: Math.max(0, Math.min(24, Math.floor(entry.end))),
      }))
      .filter((entry) => entry.end > entry.start);
    if (ranges.length > 0) out[day] = ranges;
  }
  return out;
}

export type RequestSignals = {
  country?: string | undefined;
  county?: string | undefined;
  city?: string | undefined;
  device?: DeviceType | undefined;
  os?: OsType | undefined;
  browser?: BrowserType | undefined;
  websiteCategory?: WebsiteCategory | undefined;
  /** Local weekday + hour of the request. */
  weekday?: Weekday | undefined;
  hour?: number | undefined;
  sessionId?: string | undefined;
};

function listMatches<T extends string>(allowed: T[], value: T | undefined | null): boolean {
  if (allowed.length === 0) return true; // empty list = no restriction
  if (!value) return false;
  return allowed.some((entry) => entry.toLowerCase() === String(value).toLowerCase());
}

export function scheduleMatches(
  schedule: TargetingSchedule,
  weekday?: Weekday,
  hour?: number,
): boolean {
  const days = Object.keys(schedule) as Weekday[];
  if (days.length === 0) return true;
  if (!weekday || hour === undefined) return false;
  const ranges = schedule[weekday];
  if (!ranges || ranges.length === 0) return false;
  return ranges.some((range) => hour >= range.start && hour < range.end);
}

/**
 * Deterministic targeting evaluation. Every configured dimension must match;
 * unconfigured dimensions are treated as "any".
 */
export function targetingMatches(rules: TargetingRules, signals: RequestSignals): boolean {
  return (
    listMatches(rules.countries, signals.country) &&
    listMatches(rules.counties, signals.county) &&
    listMatches(rules.cities, signals.city) &&
    listMatches(rules.devices, signals.device) &&
    listMatches(rules.operatingSystems, signals.os) &&
    listMatches(rules.browsers, signals.browser) &&
    listMatches(rules.websiteCategories, signals.websiteCategory) &&
    scheduleMatches(rules.schedule, signals.weekday, signals.hour)
  );
}

// -------------------------------------------------------------- list helpers

export type CampaignSortKey = "created_at" | "name" | "total_budget" | "start_date";
export type SortDirection = "asc" | "desc";

export type CampaignQuery = {
  search?: string;
  status?: CampaignStatus | "all";
  from?: string | null;
  to?: string | null;
  sortBy?: CampaignSortKey;
  direction?: SortDirection;
  page?: number;
  pageSize?: number;
};

export function filterSortPaginateCampaigns<
  T extends Pick<Campaign, "name" | "status" | "created_at" | "total_budget" | "start_date">,
>(rows: T[], query: CampaignQuery): { rows: T[]; total: number; page: number; pageCount: number } {
  const search = (query.search ?? "").trim().toLowerCase();
  const status = query.status ?? "all";
  const sortBy = query.sortBy ?? "created_at";
  const direction = query.direction ?? "desc";
  const pageSize = Math.max(1, query.pageSize ?? 10);

  const filtered = rows.filter((row) => {
    if (search && !row.name.toLowerCase().includes(search)) return false;
    if (status !== "all" && row.status !== status) return false;
    if (query.from && row.created_at.slice(0, 10) < query.from) return false;
    if (query.to && row.created_at.slice(0, 10) > query.to) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const av = a[sortBy] ?? "";
    const bv = b[sortBy] ?? "";
    const cmp =
      typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv));
    return direction === "asc" ? cmp : -cmp;
  });

  const total = sorted.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, query.page ?? 1), pageCount);
  const start = (page - 1) * pageSize;
  return { rows: sorted.slice(start, start + pageSize), total, page, pageCount };
}

export function formatCurrency(
  amount: number | string | null | undefined,
  currency = "USD",
): string {
  const value = typeof amount === "string" ? Number(amount) : (amount ?? 0);
  if (!Number.isFinite(value)) return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(0);
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
}

/** Basic http(s) URL check used for landing pages and destination URLs. */
export function normalizeDestinationUrl(input: string): string | null {
  const value = input.trim();
  if (value.length === 0 || value.length > 2048) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!url.hostname.includes(".")) return null;
  return url.toString();
}
