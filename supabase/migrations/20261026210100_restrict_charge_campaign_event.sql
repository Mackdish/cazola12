-- Restrict the billing RPC to the server.
--
-- charge_campaign_event moves money (campaign spend, wallet balance, publisher
-- earnings). It is only ever called from the server with the service-role key
-- (src/lib/billing-charge.server.ts), but it was granted to `authenticated`, so
-- any signed-in user could call it through PostgREST. Row-level security on the
-- tables it touches is the only thing that protected it, and the function is
-- SECURITY INVOKER. Remove the exposure entirely.

REVOKE ALL ON FUNCTION public.charge_campaign_event(uuid, uuid, uuid, text, uuid, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.charge_campaign_event(uuid, uuid, uuid, text, uuid, text, uuid)
  TO service_role;

-- Rollback:
--   GRANT EXECUTE ON FUNCTION public.charge_campaign_event(uuid, uuid, uuid, text, uuid, text, uuid) TO authenticated;
