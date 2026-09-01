import { describe, expect, it } from "vitest";

import { normalizePaymentStatus } from "@/lib/payzaapi.server";

describe("Payza status normalization", () => {
  it("recognizes Payza successful status values", () => {
    expect(normalizePaymentStatus("success")).toBe("completed");
    expect(normalizePaymentStatus("successful")).toBe("completed");
    expect(normalizePaymentStatus("completed")).toBe("completed");
  });

  it("recognizes event-only successful callbacks", () => {
    const event = "payment.success";
    expect(normalizePaymentStatus(event.split(".").pop())).toBe("completed");
    expect(normalizePaymentStatus(event)).toBe("completed");
  });

  it("does not complete unknown provider status values", () => {
    expect(normalizePaymentStatus("awaiting_customer")).toBe("pending");
  });
});
