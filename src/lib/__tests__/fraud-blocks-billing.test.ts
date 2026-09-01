/**
 * Fix 2 test: fraud evaluation blocks billing.
 *
 * Verifies that when evaluateImpressionFraud returns status="blocked"
 * (e.g., UA containing "headless"), chargeAdEvent is NOT called
 * and no row is inserted into campaign_spend.
 */

import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"];
const SERVICE_ROLE_KEY =
  process.env["SUPABASE_SERVICE_ROLE_KEY"] ||
  process.env["EXTERNAL_SUPABASE_SERVICE_ROLE_KEY"] ||
  process.env["SERVICE_ROLE_KEY"];

describe("fraud blocks billing", () => {
  let supabase: SupabaseClient;
  let testOrgId: string;
  let testCampaignId: string;
  let testAdId: string;
  let testZoneId: string;
  let testWebsiteId: string;
  let testPublisherId: string;

  beforeAll(async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      console.warn("Skipping fraud test: no Supabase connection");
      return;
    }

    supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: org } = await supabase
      .from("organizations")
      .insert({ name: "Fraud Test Org", slug: `fraud-test-${Date.now()}`, type: "advertiser" })
      .select("id")
      .single();
    if (!org) throw new Error("Failed to create org");
    testOrgId = org.id;

    await supabase.from("wallets").insert({ organization_id: testOrgId, balance_amount: 100000, currency: "KES" });
    const { data: advertiser } = await supabase
      .from("advertisers")
      .insert({ organization_id: testOrgId, business_name: "Fraud Test" })
      .select("id")
      .single();
    if (!advertiser) throw new Error("Failed to create advertiser");

    const { data: campaign } = await supabase
      .from("campaigns")
      .insert({
        organization_id: testOrgId,
        advertiser_id: advertiser.id,
        name: "Fraud Test Campaign",
        status: "active",
        approval_status: "approved",
        bid_type: "cpm",
        bid_amount: 100,
        total_budget: 1000,
        spent_amount: 0,
        start_date: "2026-01-01",
        end_date: "2027-01-01",
      })
      .select("id")
      .single();
    if (!campaign) throw new Error("Failed to create campaign");
    testCampaignId = campaign.id;

    const { data: adGroup } = await supabase
      .from("ad_groups")
      .insert({ campaign_id: testCampaignId, name: "Default" })
      .select("id")
      .single();
    if (!adGroup) throw new Error("Failed to create ad group");

    const { data: ad } = await supabase
      .from("ads")
      .insert({
        campaign_id: testCampaignId,
        ad_group_id: adGroup.id,
        name: "Fraud Test Ad",
        format: "300x250",
        status: "active",
        approval_status: "approved",
        destination_url: "https://example.com",
      })
      .select("id")
      .single();
    if (!ad) throw new Error("Failed to create ad");
    testAdId = ad.id;

    const { data: publisher } = await supabase
      .from("publishers")
      .insert({ organization_id: testOrgId, name: "Fraud Test Pub", status: "active", approval_status: "approved" })
      .select("id")
      .single();
    if (!publisher) throw new Error("Failed to create publisher");
    testPublisherId = publisher.id;

    const { data: website } = await supabase
      .from("websites")
      .insert({
        organization_id: testOrgId,
        publisher_id: testPublisherId,
        domain: `fraud-test-${Date.now()}.example.com`,
        status: "active",
        approval_status: "approved",
        verification_status: "verified",
        category: "technology",
      })
      .select("id")
      .single();
    if (!website) throw new Error("Failed to create website");
    testWebsiteId = website.id;

    const { data: zone } = await supabase
      .from("ad_zones")
      .insert({
        website_id: testWebsiteId,
        publisher_id: testPublisherId,
        zone_key: `fraud-test-${Date.now()}`,
        format: "300x250",
        status: "active",
      })
      .select("id")
      .single();
    if (!zone) throw new Error("Failed to create zone");
    testZoneId = zone.id;
  });

  afterAll(async () => {
    if (!supabase) return;
    await supabase.from("campaigns").delete().eq("id", testCampaignId);
    await supabase.from("ads").delete().eq("campaign_id", testCampaignId);
    await supabase.from("ad_groups").delete().eq("campaign_id", testCampaignId);
    await supabase.from("ad_zones").delete().eq("id", testZoneId);
    await supabase.from("websites").delete().eq("id", testWebsiteId);
    await supabase.from("publishers").delete().eq("id", testPublisherId);
    await supabase.from("wallets").delete().eq("organization_id", testOrgId);
    await supabase.from("organizations").delete().eq("id", testOrgId);
  });

  it("blocks billing when fraud evaluation returns blocked status", async () => {
    if (!supabase) {
      console.warn("Skipping test: no Supabase connection");
      return;
    }

    const { recordImpression } = await import("@/lib/ad-serving.server");

    const payload = {
      rid: `fraud-test-${Date.now()}-${Math.random()}`,
      adId: testAdId,
      campaignId: testCampaignId,
      publisherId: testPublisherId,
      websiteId: testWebsiteId,
      zoneId: testZoneId,
      device: "desktop" as never,
      browser: "chrome" as never,
      os: "windows" as never,
      country: null,
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    // UA containing "headless" triggers blocked status in evaluateImpressionFraud
    const result = await recordImpression(
      payload,
      "127.0.0.1",
      "HeadlessChrome/120.0.0.0",
      5,
      false,
      null,
      null,
    );

    expect(result).toBe("recorded");

    // Verify no campaign_spend row was created
    const { data: spendRows } = await supabase
      .from("campaign_spend")
      .select("id")
      .eq("request_id", payload.rid);

    expect(spendRows?.length ?? 0).toBe(0);

    // Verify wallet balance was NOT decremented
    const { data: wallet } = await supabase
      .from("wallets")
      .select("balance_amount")
      .eq("organization_id", testOrgId)
      .single();

    expect(Number(wallet?.balance_amount ?? 0)).toBe(100000);
  });
});
