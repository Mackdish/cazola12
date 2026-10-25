/**
 * Auto Ads domain logic: pure and dependency-free, so it is unit-testable and
 * safe to import from both server routes and tests.
 */

// ------------------------------------------------------------- placement keys

export type AutoAdsToggles = {
  responsive_ads_enabled?: boolean | null | undefined;
  banner_ads_enabled?: boolean | null | undefined;
  mobile_ads_enabled?: boolean | null | undefined;
};

export const AUTO_ADS_PLACEMENT_KEYS = [
  "top_page",
  "article_top",
  "bottom_article",
  "mobile_sticky",
] as const;

/**
 * Which automatic placements should be live for a website.
 *
 * `config` is the auto_ads_config ROW, so its fields are snake_case. The
 * previous implementation read camelCase names (`bannerAdsEnabled`, ...) off the
 * row, which are always undefined, so the banner / responsive / mobile switches
 * were silently ignored. A toggle is "off" only when it is explicitly false;
 * null / undefined keep the default (on).
 */
export function autoAdsPlacementKeys(
  enabled: boolean,
  config: AutoAdsToggles,
): Array<(typeof AUTO_ADS_PLACEMENT_KEYS)[number]> {
  if (!enabled) return [];
  const desktop = config.banner_ads_enabled !== false && config.responsive_ads_enabled !== false;
  const mobile = config.mobile_ads_enabled !== false;
  return [
    ...(desktop ? (["top_page", "article_top", "bottom_article"] as const) : []),
    ...(mobile ? (["mobile_sticky"] as const) : []),
  ];
}

// ----------------------------------------------------------- excluded pages

const MAX_EXCLUDED_PAGES = 100;
const MAX_EXCLUDED_PAGE_LENGTH = 200;

/**
 * Normalizes the publisher's "Excluded Pages" setting (a JSON array of path
 * prefixes such as "/checkout") into a clean list of absolute paths. Anything
 * that is not a string, is empty, or is a full URL is reduced to its path.
 */
export function sanitizeExcludedPages(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    let path = entry.trim();
    if (!path) continue;
    path = path.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]+/i, "");
    path = path.split(/[?#]/)[0] ?? "";
    if (!path) continue;
    if (!path.startsWith("/")) path = `/${path}`;
    if (path.length > MAX_EXCLUDED_PAGE_LENGTH) continue;
    if (!out.includes(path)) out.push(path);
    if (out.length >= MAX_EXCLUDED_PAGES) break;
  }
  return out;
}

// --------------------------------------------------------- request origin

export type PlacementOriginInput = {
  /** `Origin` request header. Absent on same-origin GET requests. */
  origin: string | null;
  /** `Sec-Fetch-Site` request header (set by modern browsers). */
  secFetchSite: string | null;
  /** `Referer` request header. */
  referer: string | null;
  /** The URL the Worker received, e.g. https://trademall.co.ke/api/public/placements. */
  requestUrl: string;
};

/**
 * Works out which website page is asking for placements.
 *
 * Browsers attach `Origin` to cross-origin requests, but NOT to same-origin GET
 * requests. TradeMall serves the SDK and the API from the same host
 * (trademall.co.ke), so a page on trademall.co.ke itself calls the API
 * same-origin and arrives with no `Origin` header, which used to be rejected
 * with `origin_required`.
 *
 * Trust order:
 *   1. an explicit `Origin` header (cross-origin publisher pages);
 *   2. `Sec-Fetch-Site: same-origin`, meaning the page is on this host;
 *   3. a `Referer` whose origin equals this host (browsers without Sec-Fetch-*).
 *
 * Only same-origin signals are accepted when `Origin` is missing, so a
 * cross-site caller cannot claim to be another site by omitting it.
 */
export function resolvePlacementOrigin(
  input: PlacementOriginInput,
): { origin: string; sameOrigin: boolean } | null {
  const origin = input.origin?.trim();
  if (origin && origin !== "null") return { origin, sameOrigin: false };

  let own: string;
  try {
    own = new URL(input.requestUrl).origin;
  } catch {
    return null;
  }

  if (input.secFetchSite === "same-origin") return { origin: own, sameOrigin: true };

  if (input.referer) {
    try {
      if (new URL(input.referer).origin === own) return { origin: own, sameOrigin: true };
    } catch {
      /* fall through */
    }
  }
  return null;
}
