-- Route KES M-PESA (and all other KES methods) through PayzaAPI and retire OptimaPayBridge.
update public.payment_methods
set provider_id = (select id from public.payment_providers where name = 'payzaapi'),
    updated_at = now()
where provider_id = (select id from public.payment_providers where name = 'optimapay');

update public.payment_providers
set active = false, updated_at = now()
where name = 'optimapay';
