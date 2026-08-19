import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const deviceEnum = z.enum(["desktop", "mobile", "tablet"]);

export const fetchSandboxZones = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listSandboxZones } = await import("@/lib/ad-diagnostics.server");
    return { zones: await listSandboxZones(context) };
  });

export const fetchZoneDiagnostics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        zoneKey: z.string().trim().min(4).max(64),
        device: deviceEnum.optional(),
        country: z.string().trim().length(2).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { diagnoseZone } = await import("@/lib/ad-diagnostics.server");
    return diagnoseZone(context, data);
  });

export const fetchSandboxOrigin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(() => ({ origin: new URL(getRequest().url).origin }));
