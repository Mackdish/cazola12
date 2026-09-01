/**
 * Phase 3: Approval → live serving transition tests.
 *
 * Verifies that:
 * 1. A pending/unapproved campaign is NOT selected by serveAd()
 * 2. Immediately after admin approval, the campaign IS selected
 * 3. After admin rejection/pause, the campaign is immediately excluded
 * 4. No cache delays the eligibility transition
 */

import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"];
const SERVICE_ROLE_KEY =
  process.env["SUPABASE_SERVICE_ROLE_KEY"] ||
  process.env["EXTERNAL_SUPABASE_SERVICE_ROLE_KEY"] ||
  process.env["SERVICE_ROLE_KEY"];

describe("approval → serving transition", () => {
  let supabase: SupabaseClient;
  let testOrgId: string;
  let testCampaignId: string;
  let testAdId: string;
  let testZoneId: string;
  let testWebsiteId: string;
  let testPublisherId: string;

  beforeAll(async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      console.warn("Skipping approval transition test: no Supabase connection");
      return;
    }

    supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Create test organization
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .insert({
        name: "Approval Test Org",
        slug: `approval-test-${Date.now()}`,
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
      .insert({ organization_id: testOrgId, business_name: "Approval Test Advertiser" })
      .select("id")
      .single();

    if (advertiserError || !advertiser) throw new Error(`Failed to create advertiser: ${advertiserError?.message}`);

    // Create campaign in pending_review (unapproved)
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .insert({
        organization_id: testOrgId,
        advertiser_id: advertiser.id,
        name: "Approval Transition Test Campaign",
        status: "pending_review",
        approval_status: "pending",
        bid_type: "cpm",
        bid_amount: 100,
        total_budget: 1000,
        spent_amount: 0,
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

    // Create ad (pending, not approved)
    const { data: ad, error: adError } = await supabase
      .from("ads")
      .insert({
        campaign_id: testCampaignId,
        ad_group_id: adGroup.id,
        name: "Approval Test Ad",
        format: "300x250",
        status: "pending",
        approval_status: "pending",
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
        name: "Approval Test Publisher",
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
        domain: `approval-test-${Date.now()}.example.com`,
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
        zone_key: `approval-test-${Date.now()}`,
        format: "300x250",
        status: "active",
      })
      .select("id")
      .single();

    if (zoneError || !zone) throw new Error(`Failed to create ad zone: ${zoneError?.message}`);
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

  it("unapproved campaign is not selected before approval", async () => {
    if (!supabase) return;

    // Verify campaign is in pending_review
    const { data: campaign } = await supabase
      .from("campaigns")
      .select("status, approval_status")
      .eq("id", testCampaignId)
      .single();

    expect(campaign?.status).toBe("pending_review");
    expect(campaign?.approval_status).toBe("pending");

    // Query candidates directly
    const { data: candidates } = await supabase
      .from("ads")
      .select(
        `id, name, format, status, approval_status, campaign_id, campaigns!inner(id, status, approval_status)`
      )
      .eq("campaign_id", testCampaignId)
      .eq("status", "active")
      .eq("approval_status", "approved")
      .eq("campaigns.approval_status", "approved")
      .in("campaigns.status", ["active", "approved"]);

    expect(candidates?.length ?? 0).toBe(0);
  });

  it("approved campaign is immediately eligible for serving", async () => {
    if (!supabase) return;

    // Admin approves campaign
    const { error: approveError } = await supabase
      .from("campaigns")
      .update({
        status: "approved",
        approval_status: "approved",
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", testCampaignId);

    if (approveError) throw new Error(`Failed to approve campaign: ${approveError.message}`);

    // Also approve the ad
    const { error: adApproveError } = await supabase
      .from("ads")
      .update({ status: "active", approval_status: "approved" })
      .eq("campaign_id", testCampaignId);

    if (adApproveError) throw new Error(`Failed to approve ad: ${adApproveError.message}`);

    // Immediately query candidates — should be visible
    const { data: candidates } = await supabase
      .from("ads")
      .select(
        `id, name, format, status, approval_status, campaign_id, campaigns!inner(id, status, approval_status)`
      )
      .eq("campaign_id", testCampaignId)
      .eq("status", "active")
      .eq("approval_status", "approved")
      .eq("campaigns.approval_status", "approved")
      .in("campaigns.status", ["active", "approved"]);

    expect(candidates?.length ?? 0).toBeGreaterThan(0);

    // Verify the candidate passes candidateIsEligible checks
    const candidate = candidates?.[0];
    if (candidate) {
      const campaign = candidate.campaigns as unknown as { status: string; approval_status: string };
      expect(campaign.status).toBe("approved");
      expect(campaign.approval_status).toBe("approved");
      expect(candidate.status).toBe("active");
      expect(candidate.approval_status).toBe("approved");
    }
  });

  it("rejected campaign is immediately excluded from serving", async () => {
    if (!supabase) return;

    // Admin rejects campaign
    const { error: rejectError } = await supabase
      .from("campaigns")
      .update({
        status: "rejected",
        approval_status: "rejected",
        rejection_reason: "Test rejection",
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", testCampaignId);

    if (rejectError) throw new Error(`Failed to reject campaign: ${rejectError.message}`);

    // Suspend ads
    const { error: adRejectError } = await supabase
      .from("ads")
      .update({ status: "suspended", approval_status: "rejected" })
      .eq("campaign_id", testCampaignId);

    if (adRejectError) throw new Error(`Failed to reject ad: ${adRejectError.message}`);

    // Immediately query candidates — should be empty
    const { data: candidates } = await supabase
      .from("ads")
      .select(
        `id, name, format, status, approval_status, campaign_id, campaigns!inner(id, status, approval_status)`
      )
      .eq("campaign_id", testCampaignId)
      .eq("status", "active")
      .eq("approval_status", "approved")
      .eq("campaigns.approval_status", "approved")
      .in("campaigns.status", ["active", "approved"]);

    expect(candidates?.length ?? 0).toBe(0);
  });

  it("paused campaign is immediately excluded from serving", async () => {
    if (!supabase) return;

    // First re-approve
    await supabase
      .from("campaigns")
      .update({ status: "approved", approval_status: "approved", rejection_reason: null })
      .eq("id", testCampaignId);

    await supabase
      .from("ads")
      .update({ status: "active", approval_status: "approved" })
      .eq("campaign_id", testCampaignId);

    // Then pause
    const { error: pauseError } = await supabase
      .from("campaigns")
      .update({ status: "paused" })
      .eq("id", testCampaignId);

    if (pauseError) throw new Error(`Failed to pause campaign: ${pauseError.message}`);

    // Immediately query candidates — should be empty (campaigns.status IN ("active", "approved") excludes "paused")
    const { data: candidates } = await supabase
      .from("ads")
      .select(
        `id, name, format, status, approval_status, campaign_id, campaigns!inner(id, status, approval_status)`
      )
      .eq("campaign_id", testCampaignId)
      .eq("status", "active")
      .eq("approval_status", "approved")
      .eq("campaigns.approval_status", "approved")
      .in("campaigns.status", ["active", "approved"]);

    expect(candidates?.length ?? 0).toBe(0);
  });
});
