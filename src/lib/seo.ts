const SITE_URL = "https://trademall.co.ke";

export const siteUrl = (path: string) => {
  const normalized = path.replace(/\/+$/, "") || "/";
  return `${SITE_URL}${normalized === "/" ? "" : normalized}`;
};

export const seoDefaults = {
  siteName: "TradeMall",
  siteUrl: SITE_URL,
  twitterHandle: "@trademallco_ke",
  defaultTitle: "TradeMall — Digital Advertising Platform for Africa",
  defaultDescription:
    "TradeMall connects advertisers and publishers in a transparent, auditable digital advertising network built for Africa.",
  defaultImage: "/trademall-logo.png",
  organizationName: "TradeMall",
  organizationLogo: "/trademall-logo.png",
  contactEmail: "support@trademall.co.ke",
  contactPhone: "+254705186502",
} as const;

export type SeoDefaults = typeof seoDefaults;

export const organizationStructuredData = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: seoDefaults.organizationName,
  url: SITE_URL,
  logo: `${SITE_URL}${seoDefaults.organizationLogo}`,
  contactPoint: {
    "@type": "ContactPoint",
    email: seoDefaults.contactEmail,
    telephone: seoDefaults.contactPhone,
    contactType: "customer support",
  },
  sameAs: [] as string[],
};

export const websiteStructuredData = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: seoDefaults.siteName,
  url: SITE_URL,
  description: seoDefaults.defaultDescription,
  inLanguage: "en",
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

export const webPageStructuredData = (data: {
  title: string;
  description: string;
  path: string;
}) => ({
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: data.title,
  description: data.description,
  url: siteUrl(data.path),
  inLanguage: "en",
  isPartOf: {
    "@type": "WebSite",
    url: SITE_URL,
    name: seoDefaults.siteName,
  },
});

export const breadcrumbStructuredData = (items: { name: string; path: string }[]) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((item, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: item.name,
    item: siteUrl(item.path),
  })),
});

export const pageMetadata = (data: {
  title: string;
  description: string;
  path: string;
  image?: string;
  noIndex?: boolean;
}) => {
  const canonical = siteUrl(data.path);
  const image = data.image ? `${siteUrl(data.image)}` : `${seoDefaults.siteUrl}${seoDefaults.defaultImage}`;

  return {
    meta: [
      // Without this, every page inherits the root default <title>.
      { title: data.title },
      { name: "description", content: data.description },
      { name: "author", content: seoDefaults.siteName },
      { rel: "canonical", href: canonical },
      { name: "robots", content: data.noIndex ? "noindex, nofollow" : "index, follow" },
      { property: "og:title", content: data.title },
      { property: "og:description", content: data.description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: canonical },
      { property: "og:image", content: image },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:site_name", content: seoDefaults.siteName },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: seoDefaults.twitterHandle },
      { name: "twitter:title", content: data.title },
      { name: "twitter:description", content: data.description },
      { name: "twitter:image", content: image },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(webPageStructuredData({ title: data.title, description: data.description, path: data.path })),
      },
    ],
  };
};
