UPDATE public.payment_providers
SET api_base_url = 'https://payzaapi.co.ke',
    supported_countries = '["KE","UG","TZ","RW","GH","NG","US"]'::jsonb,
    supported_currencies = '["KES","UGX","TZS","RWF","GHS","NGN","USD"]'::jsonb,
    active = true,
    updated_at = now()
WHERE name = 'payzaapi';

UPDATE public.supported_currencies SET active = false, updated_at = now() WHERE currency_code = 'ZAR';
UPDATE public.payment_methods SET active = false, updated_at = now() WHERE currency_code = 'ZAR';

INSERT INTO public.payment_methods
  (provider_id, name, display_name, description, country_code, currency_code, active, minimum_amount, maximum_amount)
SELECT p.id, v.name, v.display_name, v.description, v.country_code, v.currency_code, true, v.min_amount, v.max_amount
FROM public.payment_providers p
CROSS JOIN (VALUES
  ('card_gh','Card / Bank / Crypto','Pay by card, bank transfer or crypto on a secure checkout page','GH','GHS',10::numeric,500000::numeric),
  ('card_rw','Card / Bank / Crypto','Pay by card, bank transfer or crypto on a secure checkout page','RW','RWF',1000::numeric,3000000::numeric),
  ('card_tz','Card / Bank / Crypto','Pay by card, bank transfer or crypto on a secure checkout page','TZ','TZS',2000::numeric,5000000::numeric),
  ('card_ug','Card / Bank / Crypto','Pay by card, bank transfer or crypto on a secure checkout page','UG','UGX',3000::numeric,5000000::numeric)
) AS v(name, display_name, description, country_code, currency_code, min_amount, max_amount)
WHERE p.name = 'payzaapi'
  AND NOT EXISTS (SELECT 1 FROM public.payment_methods m WHERE m.name = v.name);