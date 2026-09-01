/**
 * Server-only SSRF-safe fetch helper for Cloudflare Workers.
 *
 * Cloudflare Workers with `nodejs_compat` does not expose `dns.promises.lookup`,
 * so this module resolves hostnames via Cloudflare DoH over HTTPS, checks the
 * returned addresses against private/loopback/link-local ranges, and then
 * performs the actual fetch with manual redirect validation (max 3 hops).
 */

const SAFE_FETCH_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;
const MAX_BODY_BYTES = 512 * 1024;

const BLOCKED_IPV4_RANGES: Array<{ start: number; end: number }> = [
  { start: 0x0A000000, end: 0x0AFFFFFF }, // 10.0.0.0/8
  { start: 0xAC100000, end: 0xAC1FFFFF }, // 172.16.0.0/12
  { start: 0xC0A80000, end: 0xC0A8FFFF }, // 192.168.0.0/16
  { start: 0x7F000000, end: 0x7FFFFFFF }, // 127.0.0.0/8
  { start: 0xA9FE0000, end: 0xA9FEFFFF }, // 169.254.0.0/16
];

function ipv4ToInt(ip: string): number | undefined {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return undefined;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function isBlockedIPv4(ip: string): boolean {
  const value = ipv4ToInt(ip);
  if (value === undefined) return false;
  return BLOCKED_IPV4_RANGES.some((range) => value >= range.start && value <= range.end);
}

function isBlockedIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1") return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
  const firstSegment = lower.split(":")[0] ?? "";
  if (firstSegment.startsWith("fe8")) return true;
  return false;
}

export function isBlockedIp(ip: string): boolean {
  if (ip.includes(":")) return isBlockedIPv6(ip);
  return isBlockedIPv4(ip);
}

export type SafeFetchOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: string | ArrayBuffer | Uint8Array;
  timeoutMs?: number;
  maxRedirects?: number;
};

async function dohResolve(hostname: string): Promise<string[]> {
  const ips: string[] = [];
  const types = ["A", "AAAA"] as const;

  for (const type of types) {
    try {
      const response = await fetch(
        `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=${type}`,
        {
          headers: { Accept: "application/dns-json" },
          signal: AbortSignal.timeout(5000),
        },
      );
      if (!response.ok) continue;
      const payload = (await response.json()) as { Answer?: Array<{ type: number; data: string }> };
      for (const answer of payload.Answer ?? []) {
        if (type === "A" && answer.type === 1) ips.push(answer.data);
        if (type === "AAAA" && answer.type === 28) ips.push(answer.data);
      }
    } catch {
      // continue to next record type
    }
  }

  return ips;
}

export async function resolveHostname(hostname: string): Promise<string[]> {
  return dohResolve(hostname);
}

export class SafeFetchError extends Error {
  constructor(message: string, public readonly statusCode?: number) {
    super(message);
  }
}

export async function safeFetch(url: string, options: SafeFetchOptions = {}): Promise<Response> {
  const method = options.method ?? "GET";
  const headers = options.headers ?? {};
  const body = options.body;
  const timeoutMs = options.timeoutMs ?? SAFE_FETCH_TIMEOUT_MS;
  const maxRedirects = options.maxRedirects ?? MAX_REDIRECTS;

  let currentUrl = url;
  let redirects = 0;

  while (true) {
    const parsed = new URL(currentUrl);
    const hostname = parsed.hostname;

    const ips = await resolveHostname(hostname);
    if (ips.length === 0) {
      throw new SafeFetchError(`DNS resolution returned no addresses for ${hostname}`, 502);
    }
    const blocked = ips.filter((ip) => isBlockedIp(ip));
    if (blocked.length > 0) {
      throw new SafeFetchError(`Blocked IP address for hostname ${hostname}: ${blocked.join(", ")}`, 403);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(currentUrl, {
        method,
        headers,
        body,
        signal: controller.signal,
        redirect: "manual",
      });
    } finally {
      clearTimeout(timer);
    }

    if (response.status === 204 || response.status < 300 || response.status >= 400 || redirects >= maxRedirects) {
      if (body !== undefined) {
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        });
      }
      return response;
    }

    const location = response.headers.get("location");
    if (!location) {
      return response;
    }

    try {
      currentUrl = new URL(location, currentUrl).toString();
    } catch {
      return response;
    }
    redirects += 1;
  }
}
