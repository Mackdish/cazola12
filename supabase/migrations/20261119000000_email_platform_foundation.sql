-- TradeMall email platform foundation.
-- Delivery is performed by a server-side worker using the service role and Resend.

create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text not null check (category in ('transactional', 'marketing')),
  subject text not null,
  html_body text not null,
  text_body text,
  variables jsonb not null default '[]'::jsonb,
  version integer not null default 1 check (version > 0),
  is_active boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.email_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  marketing_enabled boolean not null default false,
  product_updates_enabled boolean not null default false,
  unsubscribed_at timestamptz,
  unsubscribe_reason text,
  updated_at timestamptz not null default now()
);

create table if not exists public.email_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  event_name text not null,
  user_id uuid references auth.users(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  audience text check (audience in ('advertiser', 'publisher', 'both')),
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.email_automations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  audience text not null check (audience in ('advertiser', 'publisher', 'both')),
  trigger_event text not null,
  category text not null default 'marketing' check (category in ('transactional', 'marketing')),
  is_enabled boolean not null default false,
  settings jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.email_automation_steps (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid not null references public.email_automations(id) on delete cascade,
  step_order integer not null check (step_order > 0),
  delay_minutes integer not null default 0 check (delay_minutes >= 0),
  template_id uuid not null references public.email_templates(id) on delete restrict,
  conditions jsonb not null default '{}'::jsonb,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (automation_id, step_order)
);

create table if not exists public.email_queue (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.email_events(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  recipient_email text not null,
  template_id uuid references public.email_templates(id) on delete set null,
  category text not null check (category in ('transactional', 'marketing')),
  subject_override text,
  payload jsonb not null default '{}'::jsonb,
  idempotency_key text not null unique,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'sent', 'failed', 'cancelled')),
  scheduled_at timestamptz not null default now(),
  claimed_at timestamptz,
  sent_at timestamptz,
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 5 check (max_attempts > 0),
  resend_id text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.email_logs (
  id uuid primary key default gen_random_uuid(),
  queue_id uuid references public.email_queue(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  recipient_email text not null,
  category text not null check (category in ('transactional', 'marketing')),
  provider text not null default 'resend',
  provider_message_id text,
  event_type text not null default 'queued',
  event_payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create table if not exists public.email_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject text not null,
  html_body text not null,
  text_body text,
  audience text not null check (audience in ('advertiser', 'publisher', 'both')),
  segment jsonb not null default '{}'::jsonb,
  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled')),
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.email_campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.email_campaigns(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  recipient_email text not null,
  queue_id uuid references public.email_queue(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'queued', 'sent', 'delivered', 'bounced', 'complained', 'failed', 'unsubscribed', 'skipped')),
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, recipient_email)
);

create index if not exists email_events_unprocessed_idx
  on public.email_events (occurred_at) where processed_at is null;
create index if not exists email_queue_due_idx
  on public.email_queue (scheduled_at, created_at)
  where status = 'queued';
create index if not exists email_queue_user_idx
  on public.email_queue (user_id, created_at desc);
create index if not exists email_logs_provider_id_idx
  on public.email_logs (provider_message_id) where provider_message_id is not null;
create index if not exists email_campaign_recipients_status_idx
  on public.email_campaign_recipients (campaign_id, status);
create index if not exists email_automation_trigger_idx
  on public.email_automations (trigger_event) where is_enabled;

-- Queue workers claim batches atomically. The service role is the only caller.
create or replace function public.claim_email_queue(_limit integer default 25)
returns setof public.email_queue
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidates as (
    select id
    from public.email_queue
    where ((status = 'queued' and scheduled_at <= now())
        or (status = 'processing' and claimed_at < now() - interval '10 minutes'))
      and attempts < max_attempts
    order by scheduled_at asc, created_at asc
    limit greatest(1, least(coalesce(_limit, 25), 100))
    for update skip locked
  )
  update public.email_queue q
  set status = 'processing',
      claimed_at = now(),
      attempts = q.attempts + 1,
      updated_at = now()
  from candidates c
  where q.id = c.id
  returning q.*;
end;
$$;

revoke all on function public.claim_email_queue(integer) from public, anon, authenticated;
grant execute on function public.claim_email_queue(integer) to service_role;

alter table public.email_templates enable row level security;
alter table public.email_preferences enable row level security;
alter table public.email_events enable row level security;
alter table public.email_automations enable row level security;
alter table public.email_automation_steps enable row level security;
alter table public.email_queue enable row level security;
alter table public.email_logs enable row level security;
alter table public.email_campaigns enable row level security;
alter table public.email_campaign_recipients enable row level security;

-- Platform staff can use the admin workspace. Trusted server workers use service_role.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'email_templates',
    'email_events',
    'email_automations',
    'email_automation_steps',
    'email_queue',
    'email_logs',
    'email_campaigns',
    'email_campaign_recipients'
  ]
  loop
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_platform_staff(auth.uid())) with check (public.is_platform_staff(auth.uid()))',
      table_name || '_platform_staff_all',
      table_name
    );
  end loop;
end;
$$;

create policy email_preferences_select_own
  on public.email_preferences for select to authenticated
  using (user_id = auth.uid() or public.is_platform_staff(auth.uid()));
create policy email_preferences_insert_own
  on public.email_preferences for insert to authenticated
  with check (user_id = auth.uid());
create policy email_preferences_update_own
  on public.email_preferences for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
