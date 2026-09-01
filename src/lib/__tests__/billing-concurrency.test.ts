/**
 * Concurrency test for charge_campaign_event RPC.
 *
 * This test verifies that the budget race condition is actually fixed by the
 * database RPC, not just by application-level checks.
 *
 * Prerequisites:
 * - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in the environment
 * - The test database must have the charge_campaign_event RPC deployed
 *
 * Run with: npm test -- --run src/lib/__tests__/billing-concurrency.test.ts
 */

import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"];
const SERVICE_ROLE_KEY =
  process.env["SUPABASE_SERVICE_ROLE_KEY"] ||
  process.env["EXTERNAL_SUPABASE_SERVICE_ROLE_KEY"] ||
  process.env["SERVICE_ROLE_KEY"];

describe("charge_campaign_event concurrency", () => {
  let supabase: SupabaseClient;
  let testOrgId: string;
  let testCampaignId: string;
  let testAdId: string;
  let testZoneId: string;
  let testWebsiteId: string;
  let testPublisherId: string;
  const TEST_REQUEST_PREFIX = `concurrency-test-${Date.now()}-`;

  beforeAll(async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      console.warn("Skipping concurrency test: SUPABASE_URL or SERVICE_ROLE_KEY not set");
      return;
    }

    supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Create test organization
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .insert({
        name: "Concurrency Test Org",
        slug: `concurrency-test-${Date.now()}`,
        type: "advertiser",
      })
      .select("id")
      .single();

    if (orgError || !org) {
      throw new Error(`Failed to create test organization: ${orgError?.message}`);
    }
    testOrgId = org.id;

    // Create wallet with sufficient balance
    const { error: walletError } = await supabase
      .from("wallets")
      .insert({
        organization_id: testOrgId,
        balance_amount: 100000,
        currency: "KES",
      });

    if (walletError) {
      throw new Error(`Failed to create wallet: ${walletError.message}`);
    }

    // Create advertiser
    const { data: advertiser, error: advertiserError } = await supabase
      .from("advertisers")
      .insert({
        organization_id: testOrgId,
        business_name: "Concurrency Test Advertiser",
      })
      .select("id")
      .single();

    if (advertiserError || !advertiser) {
      throw new Error(`Failed to create advertiser: ${advertiserError?.message}`);
    }

    // Create campaign with budget for exactly 10 events at 100 KES each
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .insert({
        organization_id: testOrgId,
        advertiser_id: advertiser.id,
        name: "Concurrency Test Campaign",
        status: "active",
        approval_status: "approved",
        bid_type: "cpm",
        bid_amount: 100, // 100 KES per 1000 impressions = 0.1 KES per impression
        total_budget: 1000, // 1000 KES total
        spent_amount: 0,
        start_date: "2026-01-01",
        end_date: "2027-01-01",
      })
      .select("id")
      .single();

    if (campaignError || !campaign) {
      throw new Error(`Failed to create campaign: ${campaignError?.message}`);
    }
    testCampaignId = campaign.id;

    // Create ad group
    const { data: adGroup, error: adGroupError } = await supabase
      .from("ad_groups")
      .insert({
        campaign_id: testCampaignId,
        name: "Default Ad Group",
      })
      .select("id")
      .single();

    if (adGroupError || !adGroup) {
      throw new Error(`Failed to create ad group: ${adGroupError?.message}`);
    }

    // Create ad
    const { data: ad, error: adError } = await supabase
      .from("ads")
      .insert({
        campaign_id: testCampaignId,
        ad_group_id: adGroup.id,
        name: "Concurrency Test Ad",
        format: "300x250",
        status: "active",
        approval_status: "approved",
        destination_url: "https://example.com",
      })
      .select("id")
      .single();

    if (adError || !ad) {
      throw new Error(`Failed to create ad: ${adError?.message}`);
    }
    testAdId = ad.id;

    // Create publisher
    const { data: publisher, error: publisherError } = await supabase
      .from("publishers")
      .insert({
        organization_id: testOrgId,
        name: "Concurrency Test Publisher",
        status: "active",
        approval_status: "approved",
      })
      .select("id")
      .single();

    if (publisherError || !publisher) {
      throw new Error(`Failed to create publisher: ${publisherError?.message}`);
    }
    testPublisherId = publisher.id;

    // Create website
    const { data: website, error: websiteError } = await supabase
      .from("websites")
      .insert({
        organization_id: testOrgId,
        publisher_id: testPublisherId,
        domain: `concurrency-test-${Date.now()}.example.com`,
        status: "active",
        approval_status: "approved",
        verification_status: "verified",
        category: "technology",
      })
      .select("id")
      .single();

    if (websiteError || !website) {
      throw new Error(`Failed to create website: ${websiteError?.message}`);
    }
    testWebsiteId = website.id;

    // Create ad zone
    const { data: zone, error: zoneError } = await supabase
      .from("ad_zones")
      .insert({
        website_id: testWebsiteId,
        publisher_id: testPublisherId,
        zone_key: `concurrency-test-${Date.now()}`,
        format: "300x250",
        status: "active",
      })
      .select("id")
      .single();

    if (zoneError || !zone) {
      throw new Error(`Failed to create ad zone: ${zoneError?.message}`);
    }
    testZoneId = zone.id;
  });

  afterAll(async () => {
    if (!supabase) return;

    // Cleanup test data
    const { error: deleteError } = await supabase
      .from("campaigns")
      .delete()
      .eq("id", testCampaignId);

    if (deleteError) {
      console.warn("Cleanup warning:", deleteError.message);
    }
  });

  it("should not overspend under 50 concurrent impression charges", async () => {
    if (!supabase) {
      console.warn("Skipping test: no Supabase connection");
      return;
    }

    const CONCURRENT_REQUESTS = 50;
    const EXPECTED_SUCCESSFUL_CHARGES = 10; // budget 1000 / cost per event ~100

    // Fire 50 concurrent charge requests
    const promises = Array.from({ length: CONCURRENT_REQUESTS }, (_, i) => {
      const requestId = `${TEST_REQUEST_PREFIX}${i}`;
      return supabase.rpc("charge_campaign_event", {
        _event_type: "impression",
        _request_id: requestId,
        _campaign_id: testCampaignId,
        _ad_id: testAdId,
        _publisher_id: testPublisherId,
        _website_id: testWebsiteId,
        _ad_zone_id: testZoneId,
      });
    });

    const results = await Promise.all(promises);

    // Analyze results
    let successfulCharges = 0;
    let budgetExhaustedCount = 0;
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
        if (reason === "budget_exhausted" || reason === "insufficient_funds") {
          budgetExhaustedCount++;
        } else {
          otherFailures++;
        }
        continue;
      }

      successfulCharges++;
      totalBilledAmount += Number(data.amount ?? 0);
    }

    // Fetch final campaign state
    const { data: finalCampaign, error: fetchError } = await supabase
      .from("campaigns")
      .select("spent_amount, total_budget")
      .eq("id", testCampaignId)
      .single();

    if (fetchError || !finalCampaign) {
      throw new Error(`Failed to fetch final campaign state: ${fetchError?.message}`);
    }

    const spentAmount = Number(finalCampaign.spent_amount ?? 0);
    const totalBudget = Number(finalCampaign.total_budget ?? 0);
    const overspend = spentAmount - totalBudget;

    console.log("\n[concurrency-test] Results:");
    console.log(`  Total requests:           ${CONCURRENT_REQUESTS}`);
    console.log(`  Successful charges:       ${successfulCharges}`);
    console.log(`  Budget exhausted:         ${budgetExhaustedCount}`);
    console.log(`  Other failures:           ${otherFailures}`);
    console.log(`  Total billed (RPC sum):   ${totalBilledAmount}`);
    console.log(`  Final spent_amount:       ${spentAmount}`);
    console.log(`  Total budget:             ${totalBudget}`);
    console.log(`  Overspend:                ${overspend > 0 ? `+${overspend}` : overspend}`);

    // Assertions
    expect(spentAmount).toBeLessThanOrEqual(totalBudget);
    expect(overspend).toBeLessThanOrEqual(0);
    expect(successfulCharges).toBeLessThanOrEqual(EXPECTED_SUCCESSFUL_CHARGES);
    expect(budgetExhaustedCount + successfulCharges).toBe(CONCURRENT_REQUESTS - otherFailures);
  });
});
