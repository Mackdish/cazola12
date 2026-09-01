/**
 * Daily budget race condition test for charge_campaign_event RPC.
 *
 * Verifies that when no campaign_daily_stats row exists for today,
 * concurrent requests cannot collectively exceed the daily_budget.
 *
 * Prerequisites:
 * - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set
 * - The test database must have the charge_campaign_event RPC deployed
 *
 * Run with: npm test -- --run src/lib/__tests__/daily-budget-race.test.ts
 */

import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"];
const SERVICE_ROLE_KEY =
  process.env["SUPABASE_SERVICE_ROLE_KEY"] ||
  process.env["EXTERNAL_SUPABASE_SERVICE_ROLE_KEY"] ||
  process.env["SERVICE_ROLE_KEY"];

describe("daily budget race condition", () => {
  let supabase: SupabaseClient;
  let testOrgId: string;
  let testCampaignId: string;
  let testAdId: string;
  let testZoneId: string;
  let testWebsiteId: string;
  let testPublisherId: string;
  const TEST_REQUEST_PREFIX = `daily-race-${Date.now()}-`;

  beforeAll(async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      console.warn("Skipping daily budget race test: no Supabase connection");
      return;
    }

    supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Create test organization
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .insert({
        name: "Daily Race Test Org",
        slug: `daily-race-${Date.now()}`,
        type: "advertiser",
      })
      .select("id")
      .single();

    if (orgError || !org) throw new Error(`Failed to create org: ${orgError?.message}`);
    testOrgId = org.id;

    // Create wallet
    const { error: walletError } = await supabase
      .from("wallets")
      .insert({ organization_id: testOrgId, balance_amount: 100000, currency: "KES" });

    if (walletError) throw new Error(`Failed to create wallet: ${walletError.message}`);

    // Create advertiser
    const { data: advertiser, error: advertiserError } = await supabase
      .from("advertisers")
      .insert({ organization_id: testOrgId, business_name: "Daily Race Test Advertiser" })
      .select("id")
      .single();

    if (advertiserError || !advertiser) throw new Error(`Failed to create advertiser: ${advertiserError?.message}`);

    // Create campaign with tight daily_budget
    // daily_budget = 0.15, event_cost = 0.1 (cpm 100 / 1000)
    // Should allow exactly 1 event, reject the second
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .insert({
        organization_id: testOrgId,
        advertiser_id: advertiser.id,
        name: "Daily Budget Race Test",
        status: "active",
        approval_status: "approved",
        bid_type: "cpm",
        bid_amount: 100, // 0.1 KES per impression
        total_budget: 1000,
        spent_amount: 0,
        daily_budget: 0.15,
        start_date: "2026-01-01",
        end_date: "2027-01-01",
      })
      .select("id")
      .single();

    if (campaignError || !campaign) throw new Error(`Failed to create campaign: ${campaignError?.message}`);
    testCampaignId = campaign.id;

    // Create ad group
    const { data: adGroup, error: adGroupError } = await supabase
      .from("ad_groups")
      .insert({ campaign_id: testCampaignId, name: "Default Ad Group" })
      .select("id")
      .single();

    if (adGroupError || !adGroup) throw new Error(`Failed to create ad group: ${adGroupError?.message}`);

    // Create ad
    const { data: ad, error: adError } = await supabase
      .from("ads")
      .insert({
        campaign_id: testCampaignId,
        ad_group_id: adGroup.id,
        name: "Daily Race Test Ad",
        format: "300x250",
        status: "active",
        approval_status: "approved",
        destination_url: "https://example.com",
      })
      .select("id")
      .single();

    if (adError || !ad) throw new Error(`Failed to create ad: ${adError?.message}`);
    testAdId = ad.id;

    // Create publisher
    const { data: publisher, error: publisherError } = await supabase
      .from("publishers")
      .insert({
        organization_id: testOrgId,
        name: "Daily Race Test Publisher",
        status: "active",
        approval_status: "approved",
      })
      .select("id")
      .single();

    if (publisherError || !publisher) throw new Error(`Failed to create publisher: ${publisherError?.message}`);
    testPublisherId = publisher.id;

    // Create website
    const { data: website, error: websiteError } = await supabase
      .from("websites")
      .insert({
        organization_id: testOrgId,
        publisher_id: testPublisherId,
        domain: `daily-race-${Date.now()}.example.com`,
        status: "active",
        approval_status: "approved",
        verification_status: "verified",
        category: "technology",
      })
      .select("id")
      .single();

    if (websiteError || !website) throw new Error(`Failed to create website: ${websiteError?.message}`);
    testWebsiteId = website.id;

    // Create ad zone
    const { data: zone, error: zoneError } = await supabase
      .from("ad_zones")
      .insert({
        website_id: testWebsiteId,
        publisher_id: testPublisherId,
        zone_key: `daily-race-${Date.now()}`,
        format: "300x250",
        status: "active",
      })
      .select("id")
      .single();

    if (zoneError || !zone) throw new Error(`Failed to create ad zone: ${zoneError?.message}`);
    testZoneId = zone.id;

    // Ensure NO campaign_daily_stats row exists for today (simulates first event of day)
    const today = new Date().toISOString().slice(0, 10);
    const { error: deleteError } = await supabase
      .from("campaign_daily_stats")
      .delete()
      .eq("campaign_id", testCampaignId)
      .eq("date", today);

    if (deleteError) {
      console.warn("Cleanup warning:", deleteError.message);
    }
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

  it("should not exceed daily_budget on first event of day under concurrency", async () => {
    if (!supabase) {
      console.warn("Skipping test: no Supabase connection");
      return;
    }

    const CONCURRENT_REQUESTS = 50;
    const DAILY_BUDGET = 0.15;
    const EVENT_COST = 0.1; // cpm 100 / 1000
    const EXPECTED_MAX_SUCCESSFUL = 1; // floor(0.15 / 0.1) = 1

    // Fire 50 concurrent charge requests
    const promises = Array.from({ length: CONCURRENT_REQUESTS }, (_, i) => {
      const requestId = `${TEST_REQUEST_PREFIX}${i}`;
      return supabase.rpc("charge_campaign_event", {
        _campaign_id: testCampaignId,
        _ad_id: testAdId,
        _ad_zone_id: testZoneId,
        _event_type: "impression",
        _publisher_id: testPublisherId,
        _request_id: requestId,
        _website_id: testWebsiteId,
      });
    });

    const results = await Promise.all(promises);

    // Analyze results
    let successfulCharges = 0;
    let dailyExhaustedCount = 0;
    let otherFailures = 0;
    let totalBilledAmount = 0;

    for (const result of results) {
      if (result.error) {
        otherFailures++;
        continue;
      }

      const data = result.data as
        | { ok?: boolean; reason?: string; amount?: number | string }
        | null;
      if (!data || data.ok !== true) {
        const reason = data?.reason ?? "unknown";
        if (reason === "daily_budget_exhausted" || reason === "budget_exhausted") {
          dailyExhaustedCount++;
        } else {
          otherFailures++;
        }
        continue;
      }

      successfulCharges++;
      totalBilledAmount += Number(data.amount ?? 0);
    }

    // Fetch final daily stats
    const today = new Date().toISOString().slice(0, 10);
    const { data: dailyStats, error: fetchError } = await supabase
      .from("campaign_daily_stats")
      .select("spend")
      .eq("campaign_id", testCampaignId)
      .eq("date", today)
      .maybeSingle();

    const dailySpend = Number(dailyStats?.spend ?? 0);
    const overspend = dailySpend - DAILY_BUDGET;

    console.log("\n[daily-budget-race-test] Results:");
    console.log(`  Total requests:           ${CONCURRENT_REQUESTS}`);
    console.log(`  Successful charges:       ${successfulCharges}`);
    console.log(`  Daily budget exhausted:   ${dailyExhaustedCount}`);
    console.log(`  Other failures:           ${otherFailures}`);
    console.log(`  Total billed (RPC sum):   ${totalBilledAmount}`);
    console.log(`  Final daily_spend:        ${dailySpend}`);
    console.log(`  Daily budget:             ${DAILY_BUDGET}`);
    console.log(`  Overspend:                ${overspend > 0 ? `+${overspend}` : overspend}`);

    // Assertions
    expect(dailySpend).toBeLessThanOrEqual(DAILY_BUDGET);
    expect(overspend).toBeLessThanOrEqual(0);
    expect(successfulCharges).toBeLessThanOrEqual(EXPECTED_MAX_SUCCESSFUL);
    expect(dailyExhaustedCount + successfulCharges).toBe(CONCURRENT_REQUESTS - otherFailures);
  });
});
