import { describe, expect, it, vi, beforeEach } from "vitest";
import { isBlockedIp, safeFetch, SafeFetchError } from "@/lib/safe-fetch.server";

describe("isBlockedIp", () => {
  const blockedIPv4 = [
    "10.0.0.1",
    "10.255.255.255",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "192.168.255.255",
    "127.0.0.1",
    "127.255.255.255",
    "169.254.1.1",
    "169.254.255.255",
  ];

  const allowedIPv4 = [
    "8.8.8.8",
    "1.1.1.1",
    "93.184.216.34",
    "172.32.0.1",
    "192.169.1.1",
  ];

  for (const ip of blockedIPv4) {
    it(`blocks IPv4 ${ip}`, () => {
      expect(isBlockedIp(ip)).toBe(true);
    });
  }

  for (const ip of allowedIPv4) {
    it(`allows IPv4 ${ip}`, () => {
      expect(isBlockedIp(ip)).toBe(false);
    });
  }

  it("blocks IPv6 loopback ::1", () => {
    expect(isBlockedIp("::1")).toBe(true);
  });

  it("blocks IPv6 fc00::/7", () => {
    expect(isBlockedIp("fc00::1")).toBe(true);
    expect(isBlockedIp("fd00::1")).toBe(true);
  });

  it("blocks IPv6 fe80::/10", () => {
    expect(isBlockedIp("fe80::1")).toBe(true);
    expect(isBlockedIp("fe8f::1")).toBe(true);
  });

  it("allows public IPv6", () => {
    expect(isBlockedIp("2001:db8::1")).toBe(false);
    expect(isBlockedIp("2606:4700:4700::1111")).toBe(false);
  });
});

describe("safeFetch", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  function createDohResponse(ips: string[]) {
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers({ "Content-Type": "application/dns-json" }),
      json: async () => ({ Answer: ips.map((ip) => ({ type: ip.includes(":") ? 28 : 1, data: ip })) }),
    };
  }

  it("allows fetching a public hostname", async () => {
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(async (_input: RequestInfo | URL, _init?: any) => {
      callCount += 1;
      if (callCount <= 2) {
        return createDohResponse(["93.184.216.34"]);
      }
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers(),
        body: new ReadableStream(),
        text: async () => "hello",
      };
    });
    vi.stubGlobal("fetch", mockFetch);

    const { safeFetch: localSafeFetch } = await import("@/lib/safe-fetch.server");
    const response = await localSafeFetch("https://example.com/", { timeoutMs: 5_000 });
    expect(response.status).toBe(200);
    expect(callCount).toBe(3); // 2 DoH + 1 actual fetch
  });

  it("rejects a hostname that resolves to a private IP", async () => {
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(async (_input: RequestInfo | URL, _init?: any) => {
      callCount += 1;
      return createDohResponse(["10.0.0.1"]);
    });
    vi.stubGlobal("fetch", mockFetch);

    const { safeFetch: localSafeFetch, SafeFetchError: LocalSafeFetchError } = await import("@/lib/safe-fetch.server");
    await expect(localSafeFetch("https://10.0.0.1/")).rejects.toThrow(LocalSafeFetchError);
    expect(callCount).toBe(2); // 2 DoH calls (A and AAAA)
  });

  it("rejects a redirect chain that leads to a blocked IP", async () => {
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(async (_input: RequestInfo | URL, _init?: any) => {
      callCount += 1;
      if (callCount <= 2) {
        return createDohResponse(["93.184.216.34"]);
      }
      if (callCount === 3) {
        return {
          ok: true,
          status: 302,
          statusText: "Found",
          headers: new Headers({ Location: "https://10.0.0.1/secret" }),
          body: new ReadableStream(),
          text: async () => "",
        };
      }
      return createDohResponse(["10.0.0.1"]);
    });
    vi.stubGlobal("fetch", mockFetch);

    const { safeFetch: localSafeFetch, SafeFetchError: LocalSafeFetchError } = await import("@/lib/safe-fetch.server");
    await expect(localSafeFetch("https://example.com/", { timeoutMs: 5_000 })).rejects.toThrow(LocalSafeFetchError);
    expect(callCount).toBe(5); // 2 DoH for example.com + 1 actual fetch + 2 DoH for 10.0.0.1
  });
});
