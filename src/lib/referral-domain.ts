/**
 * Pure helpers for the referral program: code validation, remembering a code between a
 * visitor's first visit and their signup, share links, and display formatting.
 * No network and no React here, so it is easy to test.
 */

export const REFERRAL_STORAGE_KEY = "tm_referral";
/** How long a visitor's referral code is remembered before they sign up. */
export const REFERRAL_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const CODE_PATTERN = /^[A-Z0-9]{6,12}$/;

/** Upper-cases and validates a referral code. Returns null if it can't be a real code. */
export function normalizeReferralCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toUpperCase();
  return CODE_PATTERN.test(code) ? code : null;
}

/** Reads `?ref=CODE` (or `?referral=CODE`) from a URL search string. */
export function referralCodeFromSearch(search: string): string | null {
  try {
    const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
    return normalizeReferralCode(params.get("ref") ?? params.get("referral"));
  } catch {
    return null;
  }
}

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function defaultStorage(): StorageLike | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null; // storage can throw in private mode / blocked cookies
  }
}

/** Remember a code (the most recent valid code wins). Returns false if it couldn't be saved. */
export function storeReferralCode(
  code: string,
  storage: StorageLike | null = defaultStorage(),
  now: number = Date.now(),
): boolean {
  const normalized = normalizeReferralCode(code);
  if (!normalized || !storage) return false;
  try {
    storage.setItem(REFERRAL_STORAGE_KEY, JSON.stringify({ code: normalized, at: now }));
    return true;
  } catch {
    return false;
  }
}

/** The remembered code, or null if none / expired / corrupted. Expired entries are removed. */
export function readStoredReferralCode(
  storage: StorageLike | null = defaultStorage(),
  now: number = Date.now(),
): string | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(REFERRAL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { code?: unknown; at?: unknown };
    const code = normalizeReferralCode(parsed.code);
    const at = typeof parsed.at === "number" ? parsed.at : 0;
    if (!code || now - at > REFERRAL_TTL_MS || at > now + 60_000) {
      storage.removeItem(REFERRAL_STORAGE_KEY);
      return null;
    }
    return code;
  } catch {
    try {
      storage.removeItem(REFERRAL_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    return null;
  }
}

export function clearStoredReferralCode(storage: StorageLike | null = defaultStorage()): void {
  try {
    storage?.removeItem(REFERRAL_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function buildReferralLink(origin: string, code: string): string {
  return `${origin.replace(/\/+$/, "")}/auth?ref=${encodeURIComponent(code)}`;
}

export function referralShareText(audience: "advertiser" | "publisher"): string {
  return audience === "advertiser"
    ? "I advertise on TradeMall, Kenya's ad network. Join with my link:"
    : "I earn from my website with TradeMall ads. Join with my link:";
}

export function whatsappShareUrl(link: string, text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(`${text} ${link}`)}`;
}

export function emailShareUrl(link: string, text: string): string {
  return `mailto:?subject=${encodeURIComponent("Join me on TradeMall")}&body=${encodeURIComponent(`${text} ${link}`)}`;
}

export function formatKes(amount: number | string | null | undefined): string {
  const value = Number(amount ?? 0);
  const safe = Number.isFinite(value) ? value : 0;
  return `KES ${safe.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export type ReferralStatus = "pending" | "qualified" | "void";
export type CommissionStatus = "pending" | "available" | "paid" | "void";

export const REFERRAL_STATUS_LABEL: Record<ReferralStatus, string> = {
  pending: "Signed up",
  qualified: "Qualified",
  void: "Cancelled",
};

export const COMMISSION_STATUS_LABEL: Record<CommissionStatus, string> = {
  pending: "Pending",
  available: "Ready to withdraw",
  paid: "Paid",
  void: "Cancelled",
};

/** Progress toward a milestone as 0-100 (a zero/absent target counts as reached). */
export function milestoneProgress(current: number, target: number): { percent: number; reached: boolean } {
  if (!Number.isFinite(target) || target <= 0) return { percent: 100, reached: true };
  const percent = Math.max(0, Math.min(100, (current / target) * 100));
  return { percent, reached: current >= target };
}

/** Friendly text for the (rare) reasons a code can't be applied. */
export function referralFailureMessage(reason: string | undefined): string {
  switch (reason) {
    case "program_disabled":
      return "The referral program isn't open right now.";
    case "invalid_code":
      return "That referral code isn't valid.";
    case "already_referred":
      return "Your account is already linked to a referrer.";
    case "self_referral":
      return "You can't use your own referral code.";
    case "too_late":
      return "Referral codes only work for brand-new accounts.";
    default:
      return "We couldn't apply that referral code.";
  }
}
