import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { updateAdvertiserAd } from "@/lib/ad-edit.service.server";

const uuid = z.string().uuid();
const formatEnum = z.enum(["300x250", "336x280", "728x90", "970x250", "320x50", "320x100", "responsive"]);
const adTypeEnum = z.enum(["static_image", "responsive_display", "native", "html5"]);

export const updateAd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({
      adId: uuid,
      name: z.string().trim().min(2).max(120),
      format: formatEnum,
      destinationUrl: z.string().trim().min(4).max(2048),
      mediaAssetId: uuid,
      brandName: z.string().trim().max(120).optional().nullable(),
      logoMediaAssetId: uuid.optional().nullable(),
      headlines: z.array(z.string().trim().min(1).max(90)).min(1).max(5),
      longHeadline: z.string().trim().max(120).optional().nullable(),
      descriptions: z.array(z.string().trim().min(1).max(150)).min(1).max(5),
      cta: z.string().trim().max(40).optional().nullable(),
      trackingUrl: z.string().trim().max(2048).optional().nullable(),
      optimization: z.string().trim().max(40).optional().nullable(),
    }).parse(data),
  )
  .handler(({ data, context }) => updateAdvertiserAd(context, data));
