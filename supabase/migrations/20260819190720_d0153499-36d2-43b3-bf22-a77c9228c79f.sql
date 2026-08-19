INSERT INTO public.supported_currencies (currency_code, currency_name, country_code, country_name, symbol, decimal_places, minimum_deposit, active) VALUES
('KES', 'Kenyan Shilling', 'KE', 'Kenya', 'KSh', 2, 10, true),
('USD', 'United States Dollar', 'US', 'United States', '$', 2, 1, true),
('NGN', 'Nigerian Naira', 'NG', 'Nigeria', '₦', 2, 100, true),
('UGX', 'Ugandan Shilling', 'UG', 'Uganda', 'USh', 2, 1000, true),
('TZS', 'Tanzanian Shilling', 'TZ', 'Tanzania', 'TSh', 2, 1000, true),
('RWF', 'Rwandan Franc', 'RW', 'Rwanda', 'RF', 0, 500, true),
('GHS', 'Ghanaian Cedi', 'GH', 'Ghana', 'GH₵', 2, 1, true),
('ZAR', 'South African Rand', 'ZA', 'South Africa', 'R', 2, 10, false)
ON CONFLICT (currency_code) DO UPDATE SET
  currency_name = EXCLUDED.currency_name,
  country_code = EXCLUDED.country_code,
  country_name = EXCLUDED.country_name,
  symbol = EXCLUDED.symbol,
  decimal_places = EXCLUDED.decimal_places,
  minimum_deposit = EXCLUDED.minimum_deposit,
  active = EXCLUDED.active;

INSERT INTO public.payment_providers (name, display_name, api_base_url, active, supported_currencies, supported_countries) VALUES
('payzaapi', 'PayzaAPI', 'https://payzaapi.co.ke', true, '["USD","NGN","UGX","TZS","RWF","GHS","KES","ZAR"]', '["US","NG","UG","TZ","RW","GH","KE","ZA"]'),
('optimapay', 'OptimaPayBridge', 'https://optimapaybridge.co.ke', true, '["KES"]', '["KE"]')
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  api_base_url = EXCLUDED.api_base_url,
  active = EXCLUDED.active,
  supported_currencies = EXCLUDED.supported_currencies,
  supported_countries = EXCLUDED.supported_countries;

-- KES M-PESA via OptimaPayBridge
INSERT INTO public.payment_methods (name, display_name, description, currency_code, country_code, provider_id, minimum_amount, maximum_amount, active)
SELECT 'mpesa', 'M-PESA', 'Pay with M-PESA STK push', 'KES', 'KE', id, 10, NULL, true
FROM public.payment_providers WHERE name = 'optimapay'
ON CONFLICT (name, currency_code, country_code) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  provider_id = EXCLUDED.provider_id,
  minimum_amount = EXCLUDED.minimum_amount,
  maximum_amount = EXCLUDED.maximum_amount,
  active = EXCLUDED.active;

-- All other currencies via PayzaAPI
INSERT INTO public.payment_methods (name, display_name, description, currency_code, country_code, provider_id, minimum_amount, maximum_amount, active)
SELECT 'mobile_money', 'Mobile Money', 'Pay with mobile money', 'USD', 'US', id, 1, NULL, true
FROM public.payment_providers WHERE name = 'payzaapi'
ON CONFLICT (name, currency_code, country_code) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  provider_id = EXCLUDED.provider_id,
  minimum_amount = EXCLUDED.minimum_amount,
  maximum_amount = EXCLUDED.maximum_amount,
  active = EXCLUDED.active;

INSERT INTO public.payment_methods (name, display_name, description, currency_code, country_code, provider_id, minimum_amount, maximum_amount, active)
SELECT 'mobile_money', 'Mobile Money', 'Pay with mobile money', 'NGN', 'NG', id, 100, NULL, true
FROM public.payment_providers WHERE name = 'payzaapi'
ON CONFLICT (name, currency_code, country_code) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  provider_id = EXCLUDED.provider_id,
  minimum_amount = EXCLUDED.minimum_amount,
  maximum_amount = EXCLUDED.maximum_amount,
  active = EXCLUDED.active;

INSERT INTO public.payment_methods (name, display_name, description, currency_code, country_code, provider_id, minimum_amount, maximum_amount, active)
SELECT 'mobile_money', 'Mobile Money', 'Pay with mobile money', 'UGX', 'UG', id, 1000, NULL, true
FROM public.payment_providers WHERE name = 'payzaapi'
ON CONFLICT (name, currency_code, country_code) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  provider_id = EXCLUDED.provider_id,
  minimum_amount = EXCLUDED.minimum_amount,
  maximum_amount = EXCLUDED.maximum_amount,
  active = EXCLUDED.active;

INSERT INTO public.payment_methods (name, display_name, description, currency_code, country_code, provider_id, minimum_amount, maximum_amount, active)
SELECT 'mobile_money', 'Mobile Money', 'Pay with mobile money', 'TZS', 'TZ', id, 1000, NULL, true
FROM public.payment_providers WHERE name = 'payzaapi'
ON CONFLICT (name, currency_code, country_code) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  provider_id = EXCLUDED.provider_id,
  minimum_amount = EXCLUDED.minimum_amount,
  maximum_amount = EXCLUDED.maximum_amount,
  active = EXCLUDED.active;

INSERT INTO public.payment_methods (name, display_name, description, currency_code, country_code, provider_id, minimum_amount, maximum_amount, active)
SELECT 'mobile_money', 'Mobile Money', 'Pay with mobile money', 'RWF', 'RW', id, 500, NULL, true
FROM public.payment_providers WHERE name = 'payzaapi'
ON CONFLICT (name, currency_code, country_code) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  provider_id = EXCLUDED.provider_id,
  minimum_amount = EXCLUDED.minimum_amount,
  maximum_amount = EXCLUDED.maximum_amount,
  active = EXCLUDED.active;

INSERT INTO public.payment_methods (name, display_name, description, currency_code, country_code, provider_id, minimum_amount, maximum_amount, active)
SELECT 'mobile_money', 'Mobile Money', 'Pay with mobile money', 'GHS', 'GH', id, 1, NULL, true
FROM public.payment_providers WHERE name = 'payzaapi'
ON CONFLICT (name, currency_code, country_code) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  provider_id = EXCLUDED.provider_id,
  minimum_amount = EXCLUDED.minimum_amount,
  maximum_amount = EXCLUDED.maximum_amount,
  active = EXCLUDED.active;

-- Alternative card/bank/crypto methods for countries without reliable mobile money
INSERT INTO public.payment_methods (name, display_name, description, currency_code, country_code, provider_id, minimum_amount, maximum_amount, active)
SELECT 'card', 'Card / Bank / Crypto', 'Pay with card, bank or crypto', 'UGX', 'UG', id, 1000, NULL, true
FROM public.payment_providers WHERE name = 'payzaapi'
ON CONFLICT (name, currency_code, country_code) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  provider_id = EXCLUDED.provider_id,
  minimum_amount = EXCLUDED.minimum_amount,
  maximum_amount = EXCLUDED.maximum_amount,
  active = EXCLUDED.active;

INSERT INTO public.payment_methods (name, display_name, description, currency_code, country_code, provider_id, minimum_amount, maximum_amount, active)
SELECT 'card', 'Card / Bank / Crypto', 'Pay with card, bank or crypto', 'RWF', 'RW', id, 500, NULL, true
FROM public.payment_providers WHERE name = 'payzaapi'
ON CONFLICT (name, currency_code, country_code) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  provider_id = EXCLUDED.provider_id,
  minimum_amount = EXCLUDED.minimum_amount,
  maximum_amount = EXCLUDED.maximum_amount,
  active = EXCLUDED.active;

INSERT INTO public.payment_methods (name, display_name, description, currency_code, country_code, provider_id, minimum_amount, maximum_amount, active)
SELECT 'card', 'Card / Bank / Crypto', 'Pay with card, bank or crypto', 'TZS', 'TZ', id, 1000, NULL, true
FROM public.payment_providers WHERE name = 'payzaapi'
ON CONFLICT (name, currency_code, country_code) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  provider_id = EXCLUDED.provider_id,
  minimum_amount = EXCLUDED.minimum_amount,
  maximum_amount = EXCLUDED.maximum_amount,
  active = EXCLUDED.active;

INSERT INTO public.payment_methods (name, display_name, description, currency_code, country_code, provider_id, minimum_amount, maximum_amount, active)
SELECT 'card', 'Card / Bank / Crypto', 'Pay with card, bank or crypto', 'GHS', 'GH', id, 1, NULL, true
FROM public.payment_providers WHERE name = 'payzaapi'
ON CONFLICT (name, currency_code, country_code) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  provider_id = EXCLUDED.provider_id,
  minimum_amount = EXCLUDED.minimum_amount,
  maximum_amount = EXCLUDED.maximum_amount,
  active = EXCLUDED.active;

GRANT SELECT ON public.supported_currencies TO authenticated;
GRANT SELECT ON public.payment_providers TO authenticated;
GRANT SELECT ON public.payment_methods TO authenticated;
GRANT ALL ON public.supported_currencies TO service_role;
GRANT ALL ON public.payment_providers TO service_role;
GRANT ALL ON public.payment_methods TO service_role;