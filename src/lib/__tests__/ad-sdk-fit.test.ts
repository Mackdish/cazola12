import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AD_SDK_SOURCE } from "../ad-sdk-source";

/**
 * Runs the real publisher SDK in jsdom against fake /api/public/ad responses and
 * inspects what it draws. The SDK uses a *closed* shadow root, so attachShadow is
 * patched to open it for inspection only.
 */
const API = "https://trademall.co.ke";
const ZONE = "zn_5e48e41d60a192bf046d";

let roots: ShadowRoot[] = [];
const realAttachShadow = Element.prototype.attachShadow;

function payload(ad: Record<string, unknown>) {
  return {
    ok: true,
    requestId: "r1",
    ad: {
      format: "responsive",
      width: 1024,
      height: 1024,
      imageUrl: "https://cdn.example.com/creative.jpg",
      alt: "Test ad",
      clickUrl: `${API}/api/public/click?t=x`,
      ...ad,
    },
  };
}

async function runSdk(body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => body })),
  );
  document.body.innerHTML = `<div data-trademall-zone="${ZONE}"></div>`;
  const source = AD_SDK_SOURCE.replaceAll("__ORIGIN__", API).replaceAll("__API_ORIGIN__", API);
  new Function(source)();
  await new Promise((r) => setTimeout(r, 30));
  const root = roots[roots.length - 1]!;
  return {
    root,
    box: root.querySelector(".tm a") as HTMLAnchorElement | null,
    imgs: Array.from(root.querySelectorAll(".tm img")) as HTMLImageElement[],
  };
}

describe("publisher SDK — creative auto-sizing", () => {
  beforeEach(() => {
    roots = [];
    Element.prototype.attachShadow = function (init: ShadowRootInit) {
      const root = realAttachShadow.call(this, { ...init, mode: "open" });
      roots.push(root);
      return root;
    };
    // Browser APIs the SDK touches that jsdom lacks.
    vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} unobserve() {} });
    Object.defineProperty(navigator, "sendBeacon", { value: () => true, configurable: true });
  });

  afterEach(() => {
    Element.prototype.attachShadow = realAttachShadow;
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("draws a 1024x1024 square in a 728x90 box with the whole image visible + blurred backdrop", async () => {
    const { box, imgs } = await runSdk(
      payload({ display: { width: 728, height: 90, fit: "contain" } }),
    );
    expect(box?.className).toBe("s");
    expect(box?.style.width).toBe("728px");
    expect(box?.style.aspectRatio ?? box?.getAttribute("style")).toContain("728");
    // backdrop (blurred) first, sharp image on top
    expect(imgs.map((i) => i.className)).toEqual(["b", "c"]);
    expect(imgs[0]!.getAttribute("aria-hidden")).toBe("true");
    expect(imgs[0]!.alt).toBe("");
    expect(imgs[1]!.alt).toBe("Test ad");
  });

  it("fills the box edge-to-edge (no backdrop) when the fit is cover", async () => {
    const { box, imgs } = await runSdk(
      payload({ width: 728, height: 90, display: { width: 728, height: 90, fit: "cover" } }),
    );
    expect(box?.className).toBe("s");
    expect(imgs).toHaveLength(1);
    expect(imgs[0]!.className).toBe("");
  });

  it("includes the sized-box CSS (cover/contain/blur) in the shadow root", async () => {
    const { root } = await runSdk(payload({ display: { width: 300, height: 250, fit: "contain" } }));
    const css = root.querySelector("style")?.textContent ?? "";
    expect(css).toContain("object-fit:cover");
    expect(css).toContain("object-fit:contain");
    expect(css).toContain("blur(");
    expect(css).toContain("overflow:hidden");
  });

  it("still renders old-style responses that have no display field (house ads, cached payloads)", async () => {
    const { box, imgs } = await runSdk(payload({ width: 300, height: 250 }));
    expect(box?.className).toBe("");
    expect(imgs).toHaveLength(1);
    expect(imgs[0]!.getAttribute("width")).toBe("300");
    expect(imgs[0]!.getAttribute("height")).toBe("250");
  });

  it("ignores a nonsense display box and falls back safely", async () => {
    const { box, imgs } = await runSdk(
      payload({ display: { width: 99999, height: -4, fit: "contain" } }),
    );
    expect(box?.className).toBe("");
    expect(imgs).toHaveLength(1);
  });

  it("keeps the click target and rel attributes on the box", async () => {
    const { box } = await runSdk(payload({ display: { width: 728, height: 90, fit: "contain" } }));
    expect(box?.href).toContain("/api/public/click");
    expect(box?.rel).toContain("sponsored");
    expect(box?.target).toBe("_blank");
  });
});
