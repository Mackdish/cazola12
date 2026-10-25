import { describe, expect, it } from "vitest";

import { decodeCached } from "@/lib/cache.server";

describe("decodeCached", () => {
  it("returns an already-deserialized object unchanged (Upstash auto-deserialization)", () => {
    const zone = { zoneId: "z1", zoneStatus: "active" };
    expect(decodeCached<typeof zone>(zone)).toBe(zone);
  });

  it("parses raw JSON text", () => {
    expect(decodeCached<{ a: number }>('{"a":1}')).toEqual({ a: 1 });
  });

  it("returns plain strings that are not JSON as is instead of throwing", () => {
    expect(decodeCached<string>("not json")).toBe("not json");
  });

  it("passes numbers and null through", () => {
    expect(decodeCached<number>(7)).toBe(7);
    expect(decodeCached<null>(null)).toBeNull();
  });
});
