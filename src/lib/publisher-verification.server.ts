/**
 * Server-only domain ownership checks.
 *
 * Every check performs a real network lookup against the publisher's domain.
 * Nothing here trusts client input beyond the domain + method selection; the
 * token is generated server-side and compared server-side.
 */
import { VERIFICATION_KEY, verificationFileName } from "@/lib/publisher-domain";
import type { VerificationMethod } from "@/lib/publisher-domain";
import { safeFetch } from "@/lib/safe-fetch.server";

export type VerificationOutcome = { ok: true } | { ok: false; reason: string };

const MAX_BODY_BYTES = 512 * 1024;

export function createVerificationToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function readBody(response: Response): Promise<string> {
  const text = await response.text();
  return text.slice(0, MAX_BODY_BYTES);
}

async function checkDnsTxt(domain: string, token: string): Promise<VerificationOutcome> {
  const names = [`_${VERIFICATION_KEY}.${domain}`, domain];
  const found: string[] = [];

  for (const name of names) {
    try {
      const response = await safeFetch(
        `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=TXT`,
      );
      if (!response.ok) continue;
      const payload = (await response.json()) as { Answer?: Array<{ data?: string }> };
      for (const answer of payload.Answer ?? []) {
        const value = (answer.data ?? "").replace(/^"|"$/g, "").replace(/"\s+"/g, "");
        if (value) found.push(value);
      }
    } catch {
      // Try the next candidate name.
    }
  }

  if (found.some((value) => value.includes(token))) return { ok: true };
  if (found.length === 0) {
    return {
      ok: false,
      reason: "No TXT record was found yet. DNS changes can take a few minutes to propagate.",
    };
  }
  return {
    ok: false,
    reason: "A TXT record exists but its value doesn't match your verification token.",
  };
}

async function checkMetaTag(domain: string, token: string): Promise<VerificationOutcome> {
  for (const url of [`https://${domain}/`, `https://www.${domain}/`]) {
    try {
      const response = await safeFetch(url, {
        headers: { "user-agent": "TradeMallVerifier/1.0 (+domain-verification)", accept: "*/*" },
      });
      if (!response.ok) continue;
      const html = await readBody(response);
      const pattern = new RegExp(
        `<meta[^>]+name=["']${VERIFICATION_KEY}["'][^>]*content=["']([^"']+)["']`,
        "i",
      );
      const alt = new RegExp(
        `<meta[^>]+content=["']([^"']+)["'][^>]*name=["']${VERIFICATION_KEY}["']`,
        "i",
      );
      const match = pattern.exec(html) ?? alt.exec(html);
      if (match?.[1]?.trim() === token) return { ok: true };
      if (match) {
        return {
          ok: false,
          reason: "The meta tag was found but its content doesn't match your verification token.",
        };
      }
    } catch {
      // Try the www variant / fall through to the failure message.
    }
  }
  return {
    ok: false,
    reason:
      "We couldn't find the verification meta tag on your homepage. Make sure the change is published and publicly reachable over HTTPS.",
  };
}

async function checkHtmlFile(domain: string, token: string): Promise<VerificationOutcome> {
  const path = verificationFileName(token);
  for (const url of [`https://${domain}/${path}`, `https://www.${domain}/${path}`]) {
    try {
      const response = await safeFetch(url, {
        headers: { "user-agent": "TradeMallVerifier/1.0 (+domain-verification)", accept: "*/*" },
      });
      if (!response.ok) continue;
      const body = await readBody(response);
      if (body.includes(token)) return { ok: true };
      return {
        ok: false,
        reason: "The verification file was found but its content doesn't match your token.",
      };
    } catch {
      // Try the www variant.
    }
  }
  return {
    ok: false,
    reason: `We couldn't fetch https://${domain}/${path}. Make sure the file is uploaded to your web root and publicly reachable.`,
  };
}

export async function verifyDomainOwnership(
  method: VerificationMethod,
  domain: string,
  token: string,
): Promise<VerificationOutcome> {
  if (method === "dns_txt") return checkDnsTxt(domain, token);
  if (method === "meta_tag") return checkMetaTag(domain, token);
  return checkHtmlFile(domain, token);
}
