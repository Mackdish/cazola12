
-- Providers
INSERT INTO public.payment_providers (name, display_name, api_base_url, active, supported_countries, supported_currencies)
SELECT 'optimapay','OptimaPayBridge','https://optimapaybridge.co.ke', true, '["KE"]'::jsonb, '["KES"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.payment_providers WHERE name='optimapay');

INSERT INTO public.payment_providers (name, display_name, api_base_url, active, supported_countries, supported_currencies)
SELECT 'payzaapi','PayzaAPI','https://payzaapi.co.ke', true,
  '["KE","NG","UG","TZ","RW","GH","ZM","ZA","US","EU","GB"]'::jsonb,
  '["KES","NGN","UGX","TZS","RWF","GHS","ZMW","ZAR","USD","EUR","GBP"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.payment_providers WHERE name='payzaapi');

UPDATE public.payment_providers SET active = true,
  supported_countries = '["KE","NG","UG","TZ","RW","GH","ZM","ZA","US","EU","GB"]'::jsonb,
  supported_currencies = '["KES","NGN","UGX","TZS","RWF","GHS","ZMW","ZAR","USD","EUR","GBP"]'::jsonb
WHERE name = 'payzaapi';

-- Currencies
WITH c(currency_code, currency_name, symbol, country_code, country_name, minimum_deposit, decimal_places) AS (
  VALUES
    ('KES','Kenyan Shilling','KSh','KE','Kenya',100,0),
    ('NGN','Nigerian Naira','₦','NG','Nigeria',1000,2),
    ('UGX','Ugandan Shilling','USh','UG','Uganda',5000,0),
    ('TZS','Tanzanian Shilling','TSh','TZ','Tanzania',3000,0),
    ('RWF','Rwandan Franc','FRw','RW','Rwanda',1500,0),
    ('GHS','Ghanaian Cedi','GH₵','GH','Ghana',20,2),
    ('ZMW','Zambian Kwacha','ZK','ZM','Zambia',30,2),
    ('ZAR','South African Rand','R','ZA','South Africa',30,2),
    ('USD','US Dollar','$','US','United States',5,2),
    ('EUR','Euro','€','EU','European Union',5,2),
    ('GBP','British Pound','£','GB','United Kingdom',5,2)
)
INSERT INTO public.supported_currencies (currency_code, currency_name, symbol, country_code, country_name, active, minimum_deposit, decimal_places)
SELECT c.currency_code, c.currency_name, c.symbol, c.country_code, c.country_name, true, c.minimum_deposit, c.decimal_places
FROM c
WHERE NOT EXISTS (SELECT 1 FROM public.supported_currencies s WHERE s.currency_code = c.currency_code);

UPDATE public.supported_currencies SET active = true;

-- Payment methods
WITH m(name, display_name, country_code, currency_code, provider_name, minimum_amount, description) AS (
  VALUES
    ('mpesa','M-PESA','KE','KES','optimapay',10,'Pay instantly with an M-PESA STK push'),
    ('card','Card','KE','KES','payzaapi',100,'Visa or Mastercard checkout'),
    ('mtn_momo','MTN Mobile Money','UG','UGX','payzaapi',1000,'Mobile money checkout'),
    ('airtel_money','Airtel Money','UG','UGX','payzaapi',1000,'Mobile money checkout'),
    ('card','Card','UG','UGX','payzaapi',5000,'Visa or Mastercard checkout'),
    ('mobile_money','Mobile Money','TZ','TZS','payzaapi',1000,'Mobile money checkout'),
    ('card','Card','TZ','TZS','payzaapi',3000,'Visa or Mastercard checkout'),
    ('mobile_money','Mobile Money','RW','RWF','payzaapi',500,'Mobile money checkout'),
    ('card','Card','RW','RWF','payzaapi',1500,'Visa or Mastercard checkout'),
    ('mobile_money','Mobile Money','GH','GHS','payzaapi',5,'Mobile money checkout'),
    ('card','Card','GH','GHS','payzaapi',20,'Visa or Mastercard checkout'),
    ('bank_transfer','Bank Transfer','NG','NGN','payzaapi',500,'Pay from your bank account'),
    ('card','Card','NG','NGN','payzaapi',1000,'Visa or Mastercard checkout'),
    ('mobile_money','Mobile Money','ZM','ZMW','payzaapi',10,'Mobile money checkout'),
    ('card','Card','ZM','ZMW','payzaapi',30,'Visa or Mastercard checkout'),
    ('card','Card','ZA','ZAR','payzaapi',30,'Visa or Mastercard checkout'),
    ('card','Card','US','USD','payzaapi',5,'Visa or Mastercard checkout'),
    ('card','Card','EU','EUR','payzaapi',5,'Visa or Mastercard checkout'),
    ('card','Card','GB','GBP','payzaapi',5,'Visa or Mastercard checkout')
)
INSERT INTO public.payment_methods (name, display_name, country_code, currency_code, provider_id, active, minimum_amount, description)
SELECT m.name, m.display_name, m.country_code, m.currency_code, p.id, true, m.minimum_amount, m.description
FROM m JOIN public.payment_providers p ON p.name = m.provider_name
WHERE NOT EXISTS (
  SELECT 1 FROM public.payment_methods pm
  WHERE pm.name = m.name AND pm.country_code = m.country_code AND pm.currency_code = m.currency_code
);
