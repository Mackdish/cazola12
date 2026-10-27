import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Reveal } from "@/components/landing/reveal";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

class FakeObserver {
  static instances: FakeObserver[] = [];
  constructor(private cb: (entries: { isIntersecting: boolean }[]) => void) {
    FakeObserver.instances.push(this);
  }
  observe() {}
  disconnect() {}
  unobserve() {}
  fire(isIntersecting: boolean) {
    this.cb([{ isIntersecting }]);
  }
}

let container: HTMLDivElement;
let root: Root;
let top = 0;
let reduceMotion = false;

function mount() {
  act(() => {
    root.render(
      <Reveal>
        <p>content</p>
      </Reveal>,
    );
  });
  return container.firstElementChild as HTMLElement;
}

describe("Reveal — browser behaviour", () => {
  beforeEach(() => {
    FakeObserver.instances = [];
    top = 0;
    reduceMotion = false;
    vi.stubGlobal("IntersectionObserver", FakeObserver);
    window.matchMedia = ((query: string) => ({
      matches: reduceMotion && query.includes("reduce"),
      media: query,
      addEventListener() {},
      removeEventListener() {},
    })) as unknown as typeof window.matchMedia;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      () => ({ top, bottom: top + 100, left: 0, right: 0, width: 100, height: 100, x: 0, y: top, toJSON() {} }),
    );
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("leaves content that is already on screen visible (no hide-then-show flash)", () => {
    top = 100; // inside the viewport
    const el = mount();
    expect(el.className).toContain("opacity-100");
    expect(el.className).not.toContain("opacity-0");
    expect(FakeObserver.instances).toHaveLength(0);
  });

  it("hides content below the fold, then reveals it when scrolled into view", () => {
    top = 5000; // far below the fold
    const el = mount();
    expect(el.className).toContain("opacity-0");
    expect(FakeObserver.instances).toHaveLength(1);

    act(() => FakeObserver.instances[0]!.fire(false)); // not intersecting yet
    expect(el.className).toContain("opacity-0");

    act(() => FakeObserver.instances[0]!.fire(true)); // scrolled into view
    expect(el.className).toContain("opacity-100");
    expect(el.className).not.toContain("opacity-0");
  });

  it("never hides anything for visitors who prefer reduced motion", () => {
    top = 5000;
    reduceMotion = true;
    const el = mount();
    expect(el.className).toContain("opacity-100");
    expect(FakeObserver.instances).toHaveLength(0);
  });

  it("never hides anything when IntersectionObserver is unavailable", () => {
    top = 5000;
    vi.stubGlobal("IntersectionObserver", undefined);
    const el = mount();
    expect(el.className).toContain("opacity-100");
  });
});
