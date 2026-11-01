import { describe, expect, it } from "vitest";

import {
  REFERRAL_STORAGE_KEY,
  REFERRAL_TTL_MS,
  buildReferralLink,
  clearStoredReferralCode,
  emailShareUrl,
  formatKes,
  milestoneProgress,
  normalizeReferralCode,
  readStoredReferralCode,
  referralCodeFromSearch,
  referralFailureMessage,
  storeReferralCode,
  whatsappShareUrl,
  type StorageLike,
} from "@/lib/referral-domain";

function memoryStorage(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => (key in data ? data[key]! : null),
    setItem: (key, value) => void (data[key] = value),
    removeItem: (key) => void delete data[key],
  };
}

describe("normalizeReferralCode", () => {
  it("upper-cases and trims valid codes", () => {
    expect(normalizeReferralCode("  abcd2345 ")).toBe("ABCD2345");
    expect(normalizeReferralCode("ABC123")).toBe("ABC123");
  });
  it("rejects anything that can't be a code", () => {
    for (const bad of ["", "ABC", "TOOLONGCODE123", "AB CD2345", "ABCD-2345", "<script>", null, undefined, 42, {}]) {
      expect(normalizeReferralCode(bad)).toBeNull();
    }
  });
});

describe("referralCodeFromSearch", () => {
  it("reads ref and referral params", () => {
    expect(referralCodeFromSearch("?ref=abcd2345")).toBe("ABCD2345");
    expect(referralCodeFromSearch("ref=ABCD2345&utm=x")).toBe("ABCD2345");
    expect(referralCodeFromSearch("?referral=ZXCV6789")).toBe("ZXCV6789");
  });
  it("ignores missing or invalid values", () => {
    expect(referralCodeFromSearch("")).toBeNull();
    expect(referralCodeFromSearch("?foo=bar")).toBeNull();
    expect(referralCodeFromSearch("?ref=x")).toBeNull();
    expect(referralCodeFromSearch("?ref=<img onerror=1>")).toBeNull();
  });
});

describe("remembering a code between visit and signup", () => {
  it("stores, reads back and clears", () => {
    const storage = memoryStorage();
    expect(storeReferralCode("abcd2345", storage, 1_000)).toBe(true);
    expect(readStoredReferralCode(storage, 2_000)).toBe("ABCD2345");
    clearStoredReferralCode(storage);
    expect(readStoredReferralCode(storage, 2_000)).toBeNull();
  });

  it("the most recent valid code wins", () => {
    const storage = memoryStorage();
    storeReferralCode("AAAAAAAA", storage, 1_000);
    storeReferralCode("BBBBBBBB", storage, 2_000);
    expect(readStoredReferralCode(storage, 3_000)).toBe("BBBBBBBB");
  });

  it("forgets codes after 30 days and removes the stale entry", () => {
    const storage = memoryStorage();
    storeReferralCode("ABCD2345", storage, 0);
    expect(readStoredReferralCode(storage, REFERRAL_TTL_MS - 1)).toBe("ABCD2345");
    expect(readStoredReferralCode(storage, REFERRAL_TTL_MS + 1)).toBeNull();
    expect(storage.data[REFERRAL_STORAGE_KEY]).toBeUndefined();
  });

  it("refuses to store invalid codes", () => {
    const storage = memoryStorage();
    expect(storeReferralCode("nope", storage)).toBe(false);
    expect(storage.data[REFERRAL_STORAGE_KEY]).toBeUndefined();
  });

  it("survives corrupted or tampered storage", () => {
    expect(readStoredReferralCode(memoryStorage({ [REFERRAL_STORAGE_KEY]: "{not json" }))).toBeNull();
    expect(readStoredReferralCode(memoryStorage({ [REFERRAL_STORAGE_KEY]: JSON.stringify({ code: "<b>", at: Date.now() }) }))).toBeNull();
    expect(readStoredReferralCode(memoryStorage({ [REFERRAL_STORAGE_KEY]: JSON.stringify({ code: "ABCD2345", at: Date.now() + 10 * REFERRAL_TTL_MS }) }))).toBeNull();
  });

  it("copes with blocked storage (private mode)", () => {
    const blocked: StorageLike = {
      getItem: () => { throw new Error("denied"); },
      setItem: () => { throw new Error("denied"); },
      removeItem: () => { throw new Error("denied"); },
    };
    expect(storeReferralCode("ABCD2345", blocked)).toBe(false);
    expect(readStoredReferralCode(blocked)).toBeNull();
    expect(() => clearStoredReferralCode(blocked)).not.toThrow();
    expect(storeReferralCode("ABCD2345", null)).toBe(false);
    expect(readStoredReferralCode(null)).toBeNull();
  });
});

describe("share links", () => {
  it("builds the signup link without double slashes", () => {
    expect(buildReferralLink("https://trademall.co.ke/", "ABCD2345")).toBe("https://trademall.co.ke/auth?ref=ABCD2345");
    expect(buildReferralLink("https://trademall.co.ke", "ABCD2345")).toBe("https://trademall.co.ke/auth?ref=ABCD2345");
  });
  it("encodes WhatsApp and email shares", () => {
    const link = "https://trademall.co.ke/auth?ref=ABCD2345";
    const wa = whatsappShareUrl(link, "Join me:");
    expect(wa.startsWith("https://wa.me/?text=")).toBe(true);
    expect(decodeURIComponent(wa.split("text=")[1]!)).toBe(`Join me: ${link}`);
    const mail = emailShareUrl(link, "Join me:");
    expect(mail.startsWith("mailto:?subject=")).toBe(true);
    expect(decodeURIComponent(mail.split("body=")[1]!)).toContain(link);
  });
});

describe("display helpers", () => {
  it("formats KES with two decimals and survives bad input", () => {
    expect(formatKes(1234.5)).toBe("KES 1,234.50");
    expect(formatKes("15")).toBe("KES 15.00");
    expect(formatKes(null)).toBe("KES 0.00");
    expect(formatKes(Number.NaN)).toBe("KES 0.00");
  });
  it("computes milestone progress", () => {
    expect(milestoneProgress(250, 1000)).toEqual({ percent: 25, reached: false });
    expect(milestoneProgress(1500, 1000)).toEqual({ percent: 100, reached: true });
    expect(milestoneProgress(0, 0)).toEqual({ percent: 100, reached: true });
    expect(milestoneProgress(-5, 100).percent).toBe(0);
  });
  it("has a message for every failure reason", () => {
    for (const reason of ["program_disabled", "invalid_code", "already_referred", "self_referral", "too_late", "weird", undefined]) {
      expect(referralFailureMessage(reason).length).toBeGreaterThan(10);
    }
  });
});
