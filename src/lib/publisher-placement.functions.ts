import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  listWebsitePlacements,
  setWebsitePlacement,
  placementKeySchema,
} from "@/lib/publisher-placement-service.server";

const uuid = z.string().uuid();

export const fetchWebsitePlacements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ websiteId: uuid }).parse(data))
  .handler(({ data, context }) => listWebsitePlacements(context, data.websiteId));

export const updateWebsitePlacement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({
      websiteId: uuid,
      placementKey: placementKeySchema,
      enabled: z.boolean(),
      format: z.string().optional(),
    }).parse(data),
  )
  .handler(({ data, context }) => setWebsitePlacement(context, data));
