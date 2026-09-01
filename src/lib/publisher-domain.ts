import type { Database } from "@/integrations/supabase/types";
import type { StatusTone } from "@/components/patterns/status-badge";

export type ApprovalStatus = Database["public"]["Enums"]["approval_status"];
export type VerificationStatus = Database["public"]["Enums"]["verification_status"];
export type VerificationMethod = Database["public"]["Enums"]["verification_method"];
export type AdFormat = Database["public"]["Enums"]["ad_format"];
export type WebsiteCategory = Database["public"]["Enums"]["website_category"];

export type Publisher = Database["public"]["Tables"]["publishers"]["Row"];
export type Website = Database["public"]["Tables"]["websites"]["Row"];
export type AdZone = Database["public"]["Tables"]["ad_zones"]["Row"];
export type DomainVerification = Database["public"]["Tables"]["domain_verifications"]["Row"];

/** Public token key used for meta-tag / DNS / file verification. */
export const VERIFICATION_KEY = "trademall-verification";

export const AD_FORMATS: Array<{
  format: AdFormat;
  label: string;
  width: number | null;
  height: number | null;
  description: string;
}> = [
  {
    format: "300x250",
    label: "Medium rectangle",
    width: 300,
    height: 250,
    description: "In-content and sidebar workhorse.",
  },
  {
    format: "336x280",
    label: "Large rectangle",
    width: 336,
    height: 280,
    description: "Higher-impact in-article unit.",
  },
  {
    format: "728x90",
    label: "Leaderboard",
    width: 728,
    height: 90,
    description: "Above-the-fold desktop banner.",
  },
  {
    format: "970x250",
    label: "Billboard",
    width: 970,
    height: 250,
    description: "Premium desktop header unit.",
  },
  {
    format: "320x50",
    label: "Mobile banner",
    width: 320,
    height: 50,
    description: "Sticky mobile banner.",
  },
  {
    format: "320x100",
    label: "Large mobile banner",
    width: 320,
    height: 100,
    description: "Taller mobile unit.",
  },
  {
    format: "responsive",
    label: "Responsive",
    width: null,
    height: null,
    description: "Fills its container width.",
  },
];

export function adFormatSpec(format: AdFormat) {
  const spec = AD_FORMATS.find((entry) => entry.format === format);
  if (!spec) throw new Error(`Unknown ad format: ${format}`);
  return spec;
}

export function formatDimensions(
  zone: Pick<AdZone, "format" | "width" | "height" | "responsive">,
): string {
  if (zone.responsive || zone.format === "responsive") return "Responsive";
  if (zone.width && zone.height) return `${zone.width} × ${zone.height}`;
  return "—";
}

export const WEBSITE_CATEGORIES: Array<{ value: WebsiteCategory; label: string }> = [
  { value: "news", label: "News" },
  { value: "technology", label: "Technology" },
  { value: "business", label: "Business" },
  { value: "finance", label: "Finance" },
  { value: "entertainment", label: "Entertainment" },
  { value: "sports", label: "Sports" },
  { value: "lifestyle", label: "Lifestyle" },
  { value: "health", label: "Health" },
  { value: "education", label: "Education" },
  { value: "travel", label: "Travel" },
  { value: "gaming", label: "Gaming" },
  { value: "automotive", label: "Automotive" },
  { value: "food", label: "Food & drink" },
  { value: "science", label: "Science" },
  { value: "other", label: "Other" },
];

export function categoryLabel(category: WebsiteCategory): string {
  return WEBSITE_CATEGORIES.find((entry) => entry.value === category)?.label ?? "Other";
}

export const VERIFICATION_METHODS: Array<{
  method: VerificationMethod;
  label: string;
  summary: string;
}> = [
  {
    method: "dns_txt",
    label: "DNS TXT record",
    summary: "Add a TXT record to your domain's DNS zone. Most robust, works without site changes.",
  },
  {
    method: "meta_tag",
    label: "Meta tag",
    summary: "Add a meta tag to the <head> of your homepage.",
  },
  {
    method: "html_file",
    label: "HTML file",
    summary: "Upload a small verification file to your web root.",
  },
];

export function verificationMethodLabel(method: VerificationMethod): string {
  return VERIFICATION_METHODS.find((entry) => entry.method === method)?.label ?? method;
}

/**
 * Normalizes user input into a bare registrable hostname.
 * Accepts "https://WWW.Example.com/blog?x=1" → "example.com".
 * Returns null when the value cannot be a hostname.
 */
export function normalizeDomain(input: string): string | null {
  let value = input.trim().toLowerCase();
  if (value.length === 0) return null;
  value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  value = value.replace(/^www\./, "");
  const [hostPart] = value.split(/[/?#]/);
  if (!hostPart) return null;
  const host = hostPart.split("@").pop() ?? "";
  const withoutPort = host.split(":")[0] ?? "";
  const cleaned = withoutPort.replace(/\.+$/, "");
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(cleaned))
    return null;
  if (cleaned.length > 253) return null;
  const tld = cleaned.split(".").pop() ?? "";
  if (tld.length < 2 || /^[0-9]+$/.test(tld)) return null;
  return cleaned;
}

export function approvalTone(status: ApprovalStatus): StatusTone {
  if (status === "approved") return "active";
  if (status === "rejected") return "suspended";
  return "pending";
}

export function verificationTone(status: VerificationStatus): StatusTone {
  if (status === "verified") return "active";
  if (status === "failed") return "suspended";
  if (status === "pending") return "pending";
  return "neutral";
}

export function approvalLabel(status: ApprovalStatus): string {
  return status === "approved" ? "Approved" : status === "rejected" ? "Rejected" : "Pending review";
}

export function verificationLabel(status: VerificationStatus): string {
  return status === "verified"
    ? "Verified"
    : status === "failed"
      ? "Failed"
      : status === "pending"
        ? "Awaiting check"
        : "Unverified";
}

/** DNS record name publishers must create for TXT verification. */
export function dnsRecordName(domain: string): string {
  return `_${VERIFICATION_KEY}.${domain}`;
}

export function verificationFileName(token: string): string {
  return `${VERIFICATION_KEY}-${token}.txt`;
}

export type VerificationInstruction = {
  title: string;
  steps: string[];
  snippet: string;
  snippetLabel: string;
};

export function verificationInstructions(
  method: VerificationMethod,
  domain: string,
  token: string,
): VerificationInstruction {
  if (method === "dns_txt") {
    return {
      title: "Add a DNS TXT record",
      steps: [
        `Open your DNS provider for ${domain}.`,
        `Create a TXT record with host "_${VERIFICATION_KEY}" (full name ${dnsRecordName(domain)}).`,
        "Paste the value below, save, then run the check. DNS propagation can take a few minutes.",
      ],
      snippetLabel: "TXT value",
      snippet: `${VERIFICATION_KEY}=${token}`,
    };
  }
  if (method === "meta_tag") {
    return {
      title: "Add a meta tag to your homepage",
      steps: [
        `Edit the HTML <head> of https://${domain}/.`,
        "Paste the tag below anywhere inside <head>.",
        "Publish the change, then run the check.",
      ],
      snippetLabel: "Meta tag",
      snippet: `<meta name="${VERIFICATION_KEY}" content="${token}" />`,
    };
  }
  return {
    title: "Upload a verification file",
    steps: [
      `Create a file named ${verificationFileName(token)}.`,
      "Its only content should be the token below.",
      `Upload it to your web root so it is reachable at https://${domain}/${verificationFileName(token)}, then run the check.`,
    ],
    snippetLabel: "File content",
    snippet: token,
  };
}

/** Publisher-facing embed snippet. Origin always comes from server config. */
export function buildEmbedCode(input: {
  origin: string;
  zoneKey: string;
  format: AdFormat;
  width: number | null;
  height: number | null;
  responsive: boolean;
}): string {
  const origin = input.origin.replace(/\/+$/, "");
  const sizeAttrs = input.responsive
    ? ` data-responsive="true"`
    : ` data-width="${input.width ?? ""}" data-height="${input.height ?? ""}"`;
  const styleAttr = input.responsive
    ? `width:100%;display:block`
    : `width:${input.width}px;height:${input.height}px;display:block`;

  return `<!-- TradeMall ad zone: ${input.zoneKey} (${input.format}) -->
<div class="trademall-zone" data-trademall-zone="${input.zoneKey}"${sizeAttrs} style="${styleAttr}"></div>
<script async src="${origin}/ad/loader.js"></script>`;
}

export function embedInstallSteps(domain: string): string[] {
  return [
    "Copy the snippet above.",
    `Paste the <div> where the ad should appear on https://${domain}/.`,
    "Include the <script> tag once per page — usually just before </body>.",
    "Ad delivery starts once your website is verified and approved.",
  ];
}
