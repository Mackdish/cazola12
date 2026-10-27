import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Reveal, RevealGroup } from "@/components/landing/reveal";
import { websiteStructuredData, organizationStructuredData } from "@/lib/seo";

const src = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Reveal — content must be visible before JavaScript runs", () => {
  it("server-renders visible (never opacity-0), so slow connections and crawlers see content", () => {
    const html = renderToStaticMarkup(
      <Reveal>
        <p>Important landing copy</p>
      </Reveal>,
    );
    expect(html).toContain("Important landing copy");
    expect(html).toContain("opacity-100");
    expect(html).not.toContain("opacity-0");
  });

  it("keeps every item of a RevealGroup visible on first render", () => {
    const html = renderToStaticMarkup(
      <RevealGroup>{[<span key="a">One</span>, <span key="b">Two</span>, <span key="c">Three</span>]}</RevealGroup>,
    );
    expect(html).not.toContain("opacity-0");
    expect((html.match(/opacity-100/g) ?? []).length).toBe(3);
  });

  it("renders as a list item when asked", () => {
    expect(renderToStaticMarkup(<Reveal as="li">x</Reveal>)).toMatch(/^<li /);
  });
});

describe("structured data", () => {
  it("does not advertise a site search that doesn't exist (/search has no route)", () => {
    expect(JSON.stringify(websiteStructuredData)).not.toContain("SearchAction");
    expect(JSON.stringify(websiteStructuredData)).not.toContain("/search");
  });

  it("still describes the organization and website", () => {
    expect(websiteStructuredData["@type"]).toBe("WebSite");
    expect(organizationStructuredData["@type"]).toBe("Organization");
  });
});

describe("public page regressions", () => {
  it("footer links to Privacy Policy, Terms of Service, Contact and Policies", () => {
    const footer = src("src/components/layout/footer.tsx");
    for (const to of ["/privacy", "/terms", "/contact", "/policies"]) {
      expect(footer).toContain(`to="${to}"`);
    }
  });

  it("footer shows the current year instead of a hard-coded one", () => {
    const footer = src("src/components/layout/footer.tsx");
    expect(footer).toContain("getFullYear()");
    expect(footer).not.toContain("© 2026");
  });

  it("layout has a skip-to-content link that targets the main landmark", () => {
    const layout = src("src/components/layout/public-layout.tsx");
    expect(layout).toContain('href="#main-content"');
    expect(layout).toContain('id="main-content"');
  });

  it("contact uses a real mailto anchor, not a router <Link>", () => {
    const contact = src("src/routes/contact.tsx");
    expect(contact).toContain('href="mailto:support@trademall.co.ke"');
    expect(contact).not.toContain('to="mailto:');
  });

  it("policies page no longer links to the unpublished publisher-policies slug", () => {
    // (the slug may still appear as a category label; only a *link* to it dead-ends)
    expect(src("src/routes/policies.index.tsx")).not.toContain('params={{ slug: "publisher-policies" }}');
    expect(src("src/routes/policies.index.tsx")).toContain('to="/policies/publisher-guidelines"');
  });

  it("password-reset request page is kept out of search results", () => {
    expect(src("src/routes/forgot-password.tsx")).toContain('"noindex"');
  });
});
