-- Persistent, rate-limited WhatsApp campaign queue. Campaign creation never sends;
-- a worker claims one due recipient at a time.

create type public.message_campaign_status as enum ('draft', 'queued', 'running', 'paused', 'completed', 'cancelled');
create type public.message_campaign_audience as enum ('all_contactable', 'pending_rsvp', 'confirmed', 'declined');
create type public.campaign_recipient_status as enum ('queued', 'sending', 'sent', 'failed', 'skipped');

create table public.message_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  message_kind public.message_kind not null,
  audience public.message_campaign_audience not null,
  status public.message_campaign_status not null default 'draft',
  min_delay_seconds integer not null default 55 check (min_delay_seconds between 30 and 900),
  max_delay_seconds integer not null default 110 check (max_delay_seconds between min_delay_seconds and 1800),
  scheduled_for timestamptz,
  next_run_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.message_campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.message_campaigns(id) on delete cascade,
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  status public.campaign_recipient_status not null default 'queued',
  delivery_id uuid references public.message_deliveries(id) on delete set null,
  attempt_count integer not null default 0 check (attempt_count between 0 and 10),
  last_error text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, invitation_id)
);

create index message_campaigns_due_idx on public.message_campaigns (status, next_run_at);
create index message_campaign_recipients_queue_idx on public.message_campaign_recipients (campaign_id, status, created_at);

alter table public.message_campaigns enable row level security;
alter table public.message_campaign_recipients enable row level security;
grant all on table public.message_campaigns to service_role;
grant all on table public.message_campaign_recipients to service_role;

