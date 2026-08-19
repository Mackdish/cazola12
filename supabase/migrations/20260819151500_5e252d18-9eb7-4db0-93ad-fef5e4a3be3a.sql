
-- Register the OptimaPay provider row (inactive until KYC clears).
-- Intentionally does NOT touch payment_methods — KES keeps using payzaapi
-- (M-PESA) until the deliberate cutover. Idempotent: never clobber a row
-- that may later be activated manually.
INSERT INTO public.payment_providers (
  name, display_name, api_base_url, config, active,
  supported_countries, supported_currencies
)
VALUES (
  'optimapay',
  'OptimaPay',
  'https://optimapaybridge.co.ke',
  '{}'::jsonb,
  false,  -- keep inactive until KYC clears and we're ready to cut over
  '["KE"]'::jsonb,
  '["KES"]'::jsonb
)
ON CONFLICT (name) DO NOTHING;
