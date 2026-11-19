insert into public.email_templates (slug,name,category,subject,html_body,text_body,is_active,variables)
values
('advertiser-welcome','Advertiser welcome','transactional',
 'Welcome to TradeMall, {{businessName}}',
 '<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;color:#222"><h1>Welcome to TradeMall</h1><p>Hello {{businessName}},</p><p>Your advertiser profile is ready. Create your first campaign, add your creatives and reach customers across our publisher network.</p><p><a href="https://trademall.co.ke/advertiser/campaigns">Create your first campaign</a></p><p>— The TradeMall Team</p></div>',
 'Welcome {{businessName}}. Your TradeMall advertiser profile is ready. Create your first campaign at https://trademall.co.ke/advertiser/campaigns',
 true,'["businessName"]'::jsonb),
('publisher-welcome','Publisher welcome','transactional',
 'Welcome to TradeMall, {{businessName}}',
 '<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;color:#222"><h1>Welcome to TradeMall</h1><p>Hello {{businessName}},</p><p>Your publisher profile is ready. Add your website, verify ownership and create ad zones to start earning from your traffic.</p><p><a href="https://trademall.co.ke/publisher/websites">Add your first website</a></p><p>— The TradeMall Team</p></div>',
 'Welcome {{businessName}}. Add your website and create ad zones at https://trademall.co.ke/publisher/websites',
 true,'["businessName"]'::jsonb)
on conflict (slug) do nothing;

insert into public.email_automations
  (slug,name,description,audience,trigger_event,category,is_enabled,settings)
values
  ('advertiser-profile-welcome','New advertiser welcome','Sent once when an advertiser profile is first created.','advertiser','advertiser.profile.created','transactional',true,'{}'::jsonb),
  ('publisher-profile-welcome','New publisher welcome','Sent once when a publisher profile is first created.','publisher','publisher.profile.created','transactional',true,'{}'::jsonb)
on conflict (slug) do nothing;

insert into public.email_automation_steps (automation_id,step_order,delay_minutes,template_id,is_enabled)
select a.id, 1, 0, t.id, true
from public.email_automations a
join public.email_templates t on t.slug = case a.slug
  when 'advertiser-profile-welcome' then 'advertiser-welcome'
  when 'publisher-profile-welcome' then 'publisher-welcome'
end
where a.slug in ('advertiser-profile-welcome','publisher-profile-welcome')
  and not exists (
    select 1 from public.email_automation_steps s
    where s.automation_id = a.id and s.step_order = 1
  );
