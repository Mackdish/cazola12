import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  assertPlatformAdmin,
  getPlatformSettings,
  updatePlatformSettings,
  type PlatformSettings,
} from "@/lib/settings-service.server";

export const fetchPlatformSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({}).parse(data))
  .handler(({ context }) => {
    assertPlatformAdmin(context);
    return getPlatformSettings(context);
  });

export const updatePlatformSettingsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        publisherRevenueShare: z.number().min(0).max(1).optional().nullable(),
        earningsHoldDays: z.number().int().min(0).max(180).optional().nullable(),
        minimumPayoutAmount: z.number().min(0).optional().nullable(),
        campaignMinimumBudget: z.number().min(0).optional().nullable(),
        maximumCreativeSizeBytes: z.number().int().min(0).optional().nullable(),
        supportedCountries: z.array(z.string().length(2)).optional().nullable(),
        supportedCurrencies: z.array(z.string().length(3)).optional().nullable(),
        platformStatus: z.enum(["active", "maintenance", "disabled"]).optional().nullable(),
      })
      .parse(data),
  )
  .handler(({ data, context }) => {
    assertPlatformAdmin(context);
    const patch: Partial<PlatformSettings> = {};
    if (data.publisherRevenueShare !== undefined && data.publisherRevenueShare !== null)
      patch.publisherRevenueShare = data.publisherRevenueShare;
    if (data.earningsHoldDays !== undefined && data.earningsHoldDays !== null)
      patch.earningsHoldDays = data.earningsHoldDays;
    if (data.minimumPayoutAmount !== undefined && data.minimumPayoutAmount !== null)
      patch.minimumPayoutAmount = data.minimumPayoutAmount;
    if (data.campaignMinimumBudget !== undefined && data.campaignMinimumBudget !== null)
      patch.campaignMinimumBudget = data.campaignMinimumBudget;
    if (data.maximumCreativeSizeBytes !== undefined && data.maximumCreativeSizeBytes !== null)
      patch.maximumCreativeSizeBytes = data.maximumCreativeSizeBytes;
    if (data.supportedCountries !== undefined && data.supportedCountries !== null)
      patch.supportedCountries = data.supportedCountries;
    if (data.supportedCurrencies !== undefined && data.supportedCurrencies !== null)
      patch.supportedCurrencies = data.supportedCurrencies;
    if (data.platformStatus !== undefined && data.platformStatus !== null)
      patch.platformStatus = data.platformStatus;
    return updatePlatformSettings(context, patch);
  });
