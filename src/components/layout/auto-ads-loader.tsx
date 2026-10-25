import { useEffect } from "react";

const SCRIPT_ID = "trademall-auto-ads-loader";

/**
 * Hosts that are the TradeMall site itself. The ad SDK is only injected here,
 * so previews, localhost and the workers.dev address never request ads for the
 * registered trademall.co.ke website.
 */
const OWN_HOSTS = new Set(["trademall.co.ke", "www.trademall.co.ke"]);

/**
 * Loads the TradeMall ad SDK on the public marketing pages so Auto Ads can place
 * ads on trademall.co.ke, the same way a publisher would embed it on their own
 * site. It is injected after hydration, so the SDK's DOM insertions can never
 * cause a React hydration mismatch. Render it only in public layouts, never in
 * the signed-in dashboards.
 */
export function AutoAdsLoader() {
  useEffect(() => {
    if (!OWN_HOSTS.has(window.location.hostname)) return;
    if (document.getElementById(SCRIPT_ID)) return;
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.src = "/ad/loader.js";
    document.head.appendChild(script);
  }, []);

  return null;
}
