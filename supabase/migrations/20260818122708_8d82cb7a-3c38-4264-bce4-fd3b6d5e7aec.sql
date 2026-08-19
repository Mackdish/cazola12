
insert into public.supported_currencies (currency_code, currency_name, symbol, country_code, country_name, active, minimum_deposit, decimal_places) values
  ('XOF','West African CFA Franc','CFA','SN','Senegal',true,1000,0),
  ('XAF','Central African CFA Franc','FCFA','CM','Cameroon',true,1000,0),
  ('ZMW','Zambian Kwacha','ZK','ZM','Zambia',true,20,2),
  ('MWK','Malawian Kwacha','MK','MW','Malawi',true,2000,2),
  ('SLL','Sierra Leonean Leone','Le','SL','Sierra Leone',true,20000,2),
  ('CDF','Congolese Franc','FC','CD','DR Congo',true,5000,2),
  ('MZN','Mozambican Metical','MT','MZ','Mozambique',true,100,2)
on conflict (currency_code) do update set active = true;

insert into public.payment_methods (name, display_name, country_code, currency_code, provider_id, active, minimum_amount, description)
select 'payza_checkout_' || lower(c.country_code), 'Payza Checkout', c.country_code, c.currency_code, p.id, true, c.minimum_deposit,
       'Pay on Payza''s secure hosted page (mobile money, card and bank options).'
from public.supported_currencies c
cross join (select id from public.payment_providers where name = 'payzaapi' limit 1) p
where c.currency_code <> 'KES'
on conflict (name, country_code, currency_code) do update set active = true;

update public.payment_providers
set supported_currencies = to_jsonb(array(select currency_code from public.supported_currencies where active)),
    supported_countries = to_jsonb(array(select country_code from public.supported_currencies where active))
where name = 'payzaapi';

update public.platform_settings
set supported_currencies = array(select currency_code from public.supported_currencies where active),
    supported_countries = array(select country_code from public.supported_currencies where active);
