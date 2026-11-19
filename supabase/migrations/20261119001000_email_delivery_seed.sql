create table if not exists public.email_suppressions (
  email text primary key,
  reason text not null,
  source text not null default 'admin',
  provider_event_id text,
  created_at timestamptz not null default now()
);
create table if not exists public.email_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider_event_id text not null unique,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now()
);
alter table public.email_suppressions enable row level security;
alter table public.email_webhook_events enable row level security;
create policy email_suppressions_platform_staff_all on public.email_suppressions
  for all to authenticated using (public.is_platform_staff(auth.uid()))
  with check (public.is_platform_staff(auth.uid()));
create policy email_webhook_events_platform_staff_read on public.email_webhook_events
  for select to authenticated using (public.is_platform_staff(auth.uid()));

insert into public.email_templates (slug,name,category,subject,html_body,text_body,is_active,variables)
values
('publisher-website-approved','Publisher website approved','transactional',
 'Your website has been approved — TradeMall',
 '<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;color:#222"><h2>Your website has been approved</h2><p>Hi {{publisherName}},</p><p>{{websiteName}} ({{domain}}) has been approved on TradeMall.</p><p>You can now set up ad zones and start earning.</p><p><a href="{{dashboardUrl}}">Open publisher dashboard</a></p><p>— The TradeMall Team</p></div>',
 'Hi {{publisherName}}, {{websiteName}} ({{domain}}) has been approved. Open your dashboard: {{dashboardUrl}}',
 true,'["publisherName","websiteName","domain","dashboardUrl"]'::jsonb),
('publisher-website-rejected','Publisher website review update','transactional',
 'Update on your website submission — TradeMall',
 '<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;color:#222"><h2>Update on your website submission</h2><p>Hi {{publisherName}},</p><p>We could not approve {{websiteName}} ({{domain}}) at this time.</p><p><strong>Reviewer feedback:</strong> {{reason}}</p><p><a href="{{dashboardUrl}}">Review your website</a> and resubmit when ready.</p><p>— The TradeMall Team</p></div>',
 'Hi {{publisherName}}, we could not approve {{websiteName}} ({{domain}}). Feedback: {{reason}}. Review: {{dashboardUrl}}',
 true,'["publisherName","websiteName","domain","reason","dashboardUrl"]'::jsonb)
on conflict (slug) do nothing;
