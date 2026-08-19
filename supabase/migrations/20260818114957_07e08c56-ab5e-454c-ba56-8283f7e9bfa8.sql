
-- Ensure uniqueness for idempotent seeding
CREATE UNIQUE INDEX IF NOT EXISTS supported_currencies_currency_code_key ON public.supported_currencies (currency_code);
CREATE UNIQUE INDEX IF NOT EXISTS payment_providers_name_key ON public.payment_providers (name);
CREATE UNIQUE INDEX IF NOT EXISTS payment_methods_name_country_currency_key ON public.payment_methods (name, country_code, currency_code);

INSERT INTO public.supported_currencies (currency_code, currency_name, symbol, country_code, country_name, decimal_places, minimum_deposit, active) VALUES
  ('KES','Kenyan Shilling','KSh','KE','Kenya',2,100,true),
  ('UGX','Ugandan Shilling','USh','UG','Uganda',0,3000,true),
  ('TZS','Tanzanian Shilling','TSh','TZ','Tanzania',0,2000,true),
  ('RWF','Rwandan Franc','FRw','RW','Rwanda',0,1000,true),
  ('GHS','Ghanaian Cedi','GH₵','GH','Ghana',2,10,true),
  ('NGN','Nigerian Naira','₦','NG','Nigeria',2,1000,true),
  ('ZAR','South African Rand','R','ZA','South Africa',2,20,true),
  ('USD','US Dollar','$','US','United States',2,5,true)
ON CONFLICT (currency_code) DO UPDATE SET
  currency_name = EXCLUDED.currency_name,
  symbol = EXCLUDED.symbol,
  country_code = EXCLUDED.country_code,
  country_name = EXCLUDED.country_name,
  decimal_places = EXCLUDED.decimal_places,
  minimum_deposit = EXCLUDED.minimum_deposit,
  active = true;

INSERT INTO public.payment_providers (name, display_name, api_base_url, active, supported_countries, supported_currencies)
VALUES (
  'payzaapi','PayzaAPI','https://api.payzaapi.com', true,
  '["KE","UG","TZ","RW","GH","NG","ZA","US"]'::jsonb,
  '["KES","UGX","TZS","RWF","GHS","NGN","ZAR","USD"]'::jsonb
)
ON CONFLICT (name) DO UPDATE SET
  active = true,
  supported_countries = EXCLUDED.supported_countries,
  supported_currencies = EXCLUDED.supported_currencies;

INSERT INTO public.payment_methods (provider_id, name, display_name, country_code, currency_code, minimum_amount, maximum_amount, description, active)
SELECT pp.id, m.name, m.display_name, m.country_code, m.currency_code, m.minimum_amount, m.maximum_amount, m.description, true
FROM public.payment_providers pp,
(VALUES
  ('mpesa_ke','M-PESA','KE','KES',100::numeric,150000::numeric,'Pay via M-PESA STK push'),
  ('card_ke','Card','KE','KES',100,1000000,'Visa or Mastercard'),
  ('mtn_momo_ug','MTN Mobile Money','UG','UGX',3000,5000000,'Pay via MTN Mobile Money'),
  ('airtel_money_ug','Airtel Money','UG','UGX',3000,5000000,'Pay via Airtel Money'),
  ('mobile_money_tz','Mobile Money','TZ','TZS',2000,5000000,'Pay via mobile money'),
  ('mobile_money_rw','Mobile Money','RW','RWF',1000,3000000,'Pay via mobile money'),
  ('mobile_money_gh','Mobile Money','GH','GHS',10,50000,'Pay via mobile money'),
  ('card_ng','Card','NG','NGN',1000,5000000,'Visa, Mastercard or Verve'),
  ('bank_transfer_ng','Bank Transfer','NG','NGN',1000,10000000,'Pay via bank transfer'),
  ('card_za','Card','ZA','ZAR',20,200000,'Visa or Mastercard'),
  ('card_us','Card','US','USD',5,50000,'Visa, Mastercard or Amex')
) AS m(name, display_name, country_code, currency_code, minimum_amount, maximum_amount, description)
WHERE pp.name = 'payzaapi'
ON CONFLICT (name, country_code, currency_code) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  minimum_amount = EXCLUDED.minimum_amount,
  maximum_amount = EXCLUDED.maximum_amount,
  description = EXCLUDED.description,
  active = true;

UPDATE public.platform_settings
SET supported_currencies = ARRAY['KES','UGX','TZS','RWF','GHS','NGN','ZAR','USD'],
    supported_countries = ARRAY['KE','UG','TZ','RW','GH','NG','ZA','US'];
