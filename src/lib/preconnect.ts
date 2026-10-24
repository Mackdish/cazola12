/**
 * <link rel="preconnect"> for the Supabase API host. Opening the TCP+TLS
 * connection early saves a few hundred ms on slow/high-latency networks for the
 * pages that talk to Supabase straight from the browser (sign-in, dashboards).
 * Not used on public marketing pages, where it would be wasted.
 */
export function supabasePreconnectLinks() {
  const url = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
  if (!url) return [];
  try {
    return [{ rel: "preconnect", href: new URL(url).origin, crossOrigin: "anonymous" as const }];
  } catch {
    return [];
  }
}
