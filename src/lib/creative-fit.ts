import { FORMAT_SIZES, type AdFormat } from "@/lib/ad-serving-domain";

/**
 * Auto-sizing for served creatives.
 *
 * Advertisers upload one image, but it can be served into many slot sizes
 * (728x90, 300x250, 320x50, responsive, ...). Without this, a 1024x1024 upload
 * was drawn as a 1024px square in a 728x90 leaderboard slot. This works out the
 * exact box the creative should occupy and how the image should fill it:
 *
 *  - "cover"   the image's shape is close to the box, so fill edge to edge
 *              (crops at most ~10%, never distorts)
 *  - "contain" the shapes differ a lot, so show the whole image inside the box
 *              (the SDK paints a blurred copy behind it so there are no bare bars)
 */

export type CreativeFit = "cover" | "contain";

export type CreativeDisplay = {
  /** Box width in CSS px (the SDK still shrinks it with max-width:100%). */
  width: number;
  /** Box height in CSS px. */
  height: number;
  fit: CreativeFit;
};

/** Largest box a responsive slot will grow to. */
export const RESPONSIVE_MAX_WIDTH = 728;
export const RESPONSIVE_MAX_HEIGHT = 400;
/** Used when a responsive slot gets a creative whose size we don't know. */
export const DEFAULT_RESPONSIVE_BOX = { width: 300, height: 250 } as const;
/** Max aspect-ratio difference (10%) that is still filled edge-to-edge. */
export const COVER_TOLERANCE = 0.1;

type Size = { width: number; height: number };

function validSize(width: number | null | undefined, height: number | null | undefined): Size | null {
  if (typeof width !== "number" || typeof height !== "number") return null;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return { width, height };
}

function fixedSize(format: AdFormat): Size | null {
  const { width, height } = FORMAT_SIZES[format];
  return validSize(width, height);
}

function chooseFit(natural: Size | null, box: Size): CreativeFit {
  if (!natural) return "contain"; // unknown shape: never crop
  const ratio = natural.width / natural.height / (box.width / box.height);
  return Math.abs(ratio - 1) <= COVER_TOLERANCE ? "cover" : "contain";
}

export function computeCreativeDisplay(input: {
  zoneFormat: AdFormat;
  adFormat: AdFormat;
  naturalWidth: number | null | undefined;
  naturalHeight: number | null | undefined;
}): CreativeDisplay {
  const natural = validSize(input.naturalWidth, input.naturalHeight);

  // 1) A fixed-size slot (or fixed-size ad) decides the box exactly.
  const fixed = fixedSize(input.zoneFormat) ?? fixedSize(input.adFormat);
  if (fixed) {
    return { width: fixed.width, height: fixed.height, fit: chooseFit(natural, fixed) };
  }

  // 2) Responsive slot + responsive ad: keep the creative's own shape, scaled
  //    down to fit a sensible maximum and never scaled up past its real size.
  if (!natural) {
    return { ...DEFAULT_RESPONSIVE_BOX, fit: "contain" };
  }
  const scale = Math.min(
    1,
    RESPONSIVE_MAX_WIDTH / natural.width,
    RESPONSIVE_MAX_HEIGHT / natural.height,
  );
  const box = {
    width: Math.max(1, Math.round(natural.width * scale)),
    height: Math.max(1, Math.round(natural.height * scale)),
  };
  return { ...box, fit: chooseFit(natural, box) };
}
