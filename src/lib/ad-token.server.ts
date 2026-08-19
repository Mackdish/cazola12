/**
 * Signed serving tokens.
 *
 * The ad response carries an opaque token describing what was served. Tracking
 * endpoints trust nothing from the browser: they verify the HMAC and read the
 * ids back out of the token, so a caller cannot forge impressions, attribute
 * clicks to another campaign, or redirect anywhere it likes.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export type ServedTokenPayload = {
  rid: string;
  adId: string;
  campaignId: string;
  publisherId: string;
  websiteId: string;
  zoneId: string;
  device: string;
  browser: string;
  os: string;
  country: string | null;
  /** Expiry, epoch seconds. */
  exp: number;
};

const TOKEN_TTL_SECONDS = 60 * 60 * 6;

function secret(): string {
  const value = process.env["AD_TOKEN_SECRET"] || "";
  if (!value) throw new Error("Ad serving secret is not configured");
  if (value.length < 32) throw new Error("Ad serving secret is too short");
  return value;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(body: string): string {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

export function issueServedToken(payload: Omit<ServedTokenPayload, "exp">): string {
  const full: ServedTokenPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  };
  const body = b64url(JSON.stringify(full));
  return `${body}.${sign(body)}`;
}

export function verifyServedToken(token: string | null | undefined): ServedTokenPayload | null {
  if (!token || token.length > 2048) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = sign(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as ServedTokenPayload;
    if (!payload?.rid || !payload.adId || !payload.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
