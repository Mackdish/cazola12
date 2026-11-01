import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ReferralCapture, ReferralApplier, ReferralSignupNotice } from "@/components/referral/referral-capture";
import {
  HowItWorksCard,
  ReferralDashboard,
  ReferralLinkCard,
  referralRewardCopy,
} from "@/components/referral/referral-dashboard";
import { REFERRAL_STORAGE_KEY, storeReferralCode } from "@/lib/referral-domain";
import type { ReferralOverview, ReferralSettingsView } from "@/lib/referral.functions";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// ---- hook mocks (the hooks need a router/server-fn context we don't have in unit tests) ----
const overviewState: { value: { isLoading: boolean; error: Error | null; data?: ReferralOverview; refetch: () => void } } = {
  value: { isLoading: false, error: null, refetch: () => {} },
};
const applyMock = vi.fn<(code: string) => Promise<{ ok: boolean; reason?: string }>>();
vi.mock("@/hooks/use-referral", () => ({
  useReferralOverview: () => overviewState.value,
  useApplyReferralCode: () => ({ mutateAsync: applyMock }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const settings: ReferralSettingsView = {
  enabled: true,
  commissionPercent: 10,
  windowMonths: 12,
  advertiserMilestone: 1000,
  publisherMilestone: 500,
};

const overview = (over: Partial<ReferralOverview> = {}): ReferralOverview => ({
  code: "ABCD2345",
  settings,
  summary: {
    referrals: { total: 3, pending: 1, qualified: 2, void: 0 },
    commissions: { pending: 12.5, available: 40, paid: 100 },
  },
  referrals: [
    { id: "r1", status: "qualified", createdAt: "2026-10-01T00:00:00Z", qualifiedAt: "2026-10-05T00:00:00Z", maskedName: "Ac•••", kind: "advertiser", earned: 100, pending: 0 },
  ],
  commissions: [
    { id: "c1", amount: 15, status: "paid", sourceRole: "advertiser", createdAt: "2026-10-06T00:00:00Z", availableAt: "2026-10-07T00:00:00Z", paidAt: "2026-10-08T00:00:00Z" },
  ],
  ...over,
});

describe("reward wording depends on who is referring", () => {
  it("advertisers are paid in ad credit, publishers in cash", () => {
    expect(referralRewardCopy("advertiser").paidAs).toContain("ad credit");
    expect(referralRewardCopy("publisher").paidAs).toContain("cash");
    expect(referralRewardCopy("publisher").paidAs).toContain("payouts");
  });

  it("the how-it-works card states the live numbers", () => {
    const html = renderToStaticMarkup(<HowItWorksCard audience="advertiser" settings={settings} />);
    expect(html).toContain("10%");
    expect(html).toContain("12 months");
    expect(html).toContain("KES 1,000.00");
    expect(html).toContain("KES 500.00");
    expect(html).toContain("ad credit");
    expect(html).toContain("never reduces what they earn or spend");
  });

  it("describes an unlimited period and singular month correctly", () => {
    expect(renderToStaticMarkup(<HowItWorksCard audience="publisher" settings={{ ...settings, windowMonths: 0 }} />)).toContain("no time limit");
    expect(renderToStaticMarkup(<HowItWorksCard audience="publisher" settings={{ ...settings, windowMonths: 1 }} />)).toContain("1 month");
  });
});

describe("ReferralLinkCard", () => {
  it("shows the link, the code and one-tap share options", () => {
    const html = renderToStaticMarkup(<ReferralLinkCard code="ABCD2345" link="https://trademall.co.ke/auth?ref=ABCD2345" audience="publisher" />);
    expect(html).toContain("https://trademall.co.ke/auth?ref=ABCD2345");
    expect(html).toContain("ABCD2345");
    expect(html).toContain("https://wa.me/?text=");
    expect(html).toContain("mailto:?subject=");
    expect(html).toContain('rel="noopener noreferrer"');
  });
});

describe("ReferralDashboard states", () => {
  it("shows a loading state while the organization or data loads", () => {
    overviewState.value = { isLoading: true, error: null, refetch: () => {} };
    expect(renderToStaticMarkup(<ReferralDashboard audience="advertiser" organizationId="org" loadingOrganization={false} />)).toContain("Loading referrals");
    overviewState.value = { isLoading: false, error: null, refetch: () => {} };
    expect(renderToStaticMarkup(<ReferralDashboard audience="advertiser" organizationId={null} loadingOrganization />)).toContain("Loading referrals");
  });

  it("asks for account setup when there is no organization", () => {
    expect(renderToStaticMarkup(<ReferralDashboard audience="publisher" organizationId={null} loadingOrganization={false} />)).toContain("Set up your account first");
  });

  it("shows the error and a retry", () => {
    overviewState.value = { isLoading: false, error: new Error("Boom"), refetch: () => {} };
    const html = renderToStaticMarkup(<ReferralDashboard audience="advertiser" organizationId="org" loadingOrganization={false} />);
    expect(html).toContain("Couldn&#x27;t load referrals");
    expect(html).toContain("Boom");
  });

  it("does not show a link while the program is switched off", () => {
    overviewState.value = { isLoading: false, error: null, refetch: () => {}, data: overview({ settings: { ...settings, enabled: false } }) };
    const html = renderToStaticMarkup(<ReferralDashboard audience="advertiser" organizationId="org" loadingOrganization={false} />);
    expect(html).toContain("opens soon");
    expect(html).not.toContain("ABCD2345");
  });

  it("shows the link, numbers and masked names when the program is on", () => {
    overviewState.value = { isLoading: false, error: null, refetch: () => {}, data: overview() };
    const html = renderToStaticMarkup(<ReferralDashboard audience="publisher" organizationId="org" loadingOrganization={false} />);
    expect(html).toContain("ABCD2345");
    expect(html).toContain("KES 140.00"); // earned = paid 100 + available 40
    expect(html).toContain("KES 12.50"); // pending
    expect(html).toContain("KES 40.00 ready to withdraw");
    expect(html).toContain("Ac•••"); // masked, never a full name
    expect(html).toContain("Qualified");
    expect(html).toContain("Ad spend");
  });

  it("explains the empty state for a brand-new referrer", () => {
    overviewState.value = {
      isLoading: false, error: null, refetch: () => {},
      data: overview({ referrals: [], commissions: [], summary: { referrals: { total: 0, pending: 0, qualified: 0, void: 0 }, commissions: { pending: 0, available: 0, paid: 0 } } }),
    };
    const html = renderToStaticMarkup(<ReferralDashboard audience="advertiser" organizationId="org" loadingOrganization={false} />);
    expect(html).toContain("No referrals yet");
    expect(html).toContain("No rewards yet");
  });
});

describe("capturing and applying a referral code", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    localStorage.clear();
    applyMock.mockReset();
    window.history.pushState({}, "", "/");
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });
  const flush = () => act(async () => void (await Promise.resolve()));

  it("remembers a valid ?ref= code from the landing URL", () => {
    window.history.pushState({}, "", "/?ref=abcd2345&utm_source=whatsapp");
    act(() => root.render(<ReferralCapture />));
    expect(JSON.parse(localStorage.getItem(REFERRAL_STORAGE_KEY)!).code).toBe("ABCD2345");
  });

  it("ignores junk codes", () => {
    window.history.pushState({}, "", "/?ref=<script>");
    act(() => root.render(<ReferralCapture />));
    expect(localStorage.getItem(REFERRAL_STORAGE_KEY)).toBeNull();
  });

  it("applies the remembered code once and forgets it on success", async () => {
    storeReferralCode("ABCD2345");
    applyMock.mockResolvedValue({ ok: true });
    act(() => root.render(<ReferralApplier />));
    await flush();
    expect(applyMock).toHaveBeenCalledTimes(1);
    expect(applyMock).toHaveBeenCalledWith("ABCD2345");
    expect(localStorage.getItem(REFERRAL_STORAGE_KEY)).toBeNull();
  });

  it("does nothing when there is no remembered code", async () => {
    act(() => root.render(<ReferralApplier />));
    await flush();
    expect(applyMock).not.toHaveBeenCalled();
  });

  it("drops codes that can never work (invalid / already referred / existing account)", async () => {
    for (const reason of ["invalid_code", "already_referred", "too_late", "self_referral"]) {
      localStorage.clear();
      storeReferralCode("ABCD2345");
      applyMock.mockResolvedValue({ ok: false, reason });
      act(() => root.render(<ReferralApplier key={reason} />));
      await flush();
      expect(localStorage.getItem(REFERRAL_STORAGE_KEY), reason).toBeNull();
    }
  });

  it("keeps the code when the program is off or the network fails, to retry later", async () => {
    storeReferralCode("ABCD2345");
    applyMock.mockResolvedValue({ ok: false, reason: "program_disabled" });
    act(() => root.render(<ReferralApplier key="a" />));
    await flush();
    expect(localStorage.getItem(REFERRAL_STORAGE_KEY)).not.toBeNull();

    applyMock.mockRejectedValue(new Error("offline"));
    act(() => root.render(<ReferralApplier key="b" />));
    await flush();
    expect(localStorage.getItem(REFERRAL_STORAGE_KEY)).not.toBeNull();
  });

  it("the sign-up notice appears only for a remembered code, after mount", async () => {
    expect(renderToStaticMarkup(<ReferralSignupNotice />)).toBe(""); // server render: nothing (no mismatch)
    act(() => root.render(<ReferralSignupNotice />));
    expect(container.textContent).not.toContain("referral link");
    storeReferralCode("ABCD2345");
    act(() => root.render(<ReferralSignupNotice key="x" />));
    expect(container.textContent).toContain("joining through a referral link");
    expect(container.textContent).toContain("ABCD2345");
  });
});

describe("wiring", () => {
  it("adds Refer & Earn / Referrals to the right dashboards", () => {
    const nav = read("src/lib/navigation.ts");
    expect(nav).toContain('to: "/advertiser/referrals"');
    expect(nav).toContain('to: "/publisher/referrals"');
    expect(nav).toContain('to: "/admin/referrals"');
  });

  it("each page is wrapped in the right workspace guard", () => {
    expect(read("src/routes/_authenticated/advertiser.referrals.tsx")).toContain('<WorkspaceGuard workspace="advertiser">');
    expect(read("src/routes/_authenticated/publisher.referrals.tsx")).toContain('<WorkspaceGuard workspace="publisher">');
    expect(read("src/routes/_authenticated/admin.referrals.tsx")).toContain('<WorkspaceGuard workspace="admin">');
  });

  it("captures at the root, applies after sign-in, and shows the notice on the sign-up form", () => {
    expect(read("src/routes/__root.tsx")).toContain("<ReferralCapture />");
    expect(read("src/routes/_authenticated/route.tsx")).toContain("<ReferralApplier />");
    expect(read("src/routes/auth.tsx")).toContain("<ReferralSignupNotice />");
  });

  it("processes referrals on the server's schedule", () => {
    const server = read("src/server.ts");
    expect(server).toContain('rpc("process_referrals")');
    expect(server).toMatch(/getUTCMinutes\(\) % 5 === 0/);
  });

  it("every server function requires a signed-in user, and admin ones check for admin", () => {
    const source = read("src/lib/referral.functions.ts");
    const declarations = source.match(/export const \w+ = createServerFn/g) ?? [];
    expect(declarations.length).toBe(6);
    expect((source.match(/\.middleware\(\[requireSupabaseAuth\]\)/g) ?? []).length).toBe(declarations.length);
    for (const name of ["adminFetchReferralOverview", "adminUpdateReferralSettings", "adminVoidReferral", "adminProcessReferrals"]) {
      const body = source.slice(source.indexOf(`export const ${name}`));
      expect(body.slice(0, body.indexOf("});") + 3), name).toContain("assertPlatformAdmin(context)");
    }
  });

  it("the referral migration never leaves a function open to anonymous callers", () => {
    const sql = read("supabase/migrations/20261027000000_referral_program.sql");
    const definers = (sql.match(/security definer/gi) ?? []).length;
    expect(definers).toBeGreaterThan(0);
    expect(sql).toMatch(/revoke all on function public\.process_referrals\(\) from public, anon, authenticated/);
    for (const fn of ["get_or_create_referral_code", "apply_referral", "admin_void_referral", "get_referral_summary", "get_referral_list", "admin_referral_overview"]) {
      expect(sql, fn).toMatch(new RegExp(`revoke all on function public\\.${fn}\\([^)]*\\) from public, anon`));
    }
    expect(sql).toContain("enabled boolean not null default false"); // ships switched off
    expect(sql).toContain("commission_percent <= 40");
  });
});
