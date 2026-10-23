-- RSVP responses and supervised invitation delivery history.

create type public.rsvp_response_source as enum ('website', 'whatsapp', 'phone', 'admin', 'google_sheet');
create type public.message_delivery_status as enum ('pending', 'sent', 'failed');
create type public.message_kind as enum ('invitation', 'reminder', 'event_details', 'table_assignment', 'thank_you');

alter table public.invitations
  add column if not exists rsvp_updated_at timestamptz,
  add column if not exists rsvp_source public.rsvp_response_source,
  add column if not exists rsvp_note text check (rsvp_note is null or char_length(rsvp_note) <= 500),
  add column if not exists contact_opt_out boolean not null default false,
  add column if not exists checked_in_at timestamptz;

create table public.rsvp_responses (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  status public.rsvp_status not null,
  number_confirmed integer not null check (number_confirmed between 0 and 30),
  source public.rsvp_response_source not null,
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now()
);

create index rsvp_responses_invitation_created_idx
  on public.rsvp_responses (invitation_id, created_at desc);

create table public.message_deliveries (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  channel text not null default 'whatsapp_web' check (channel in ('whatsapp_web', 'whatsapp_cloud')),
  message_kind public.message_kind not null,
  status public.message_delivery_status not null default 'pending',
  message_body text not null check (char_length(message_body) between 1 and 4096),
  provider_message_id text,
  error_code text,
  error_message text,
  requested_by uuid references auth.users(id) on delete set null,
  requested_at timestamptz not null default now(),
  sent_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index message_deliveries_invitation_created_idx
  on public.message_deliveries (invitation_id, created_at desc);
create index message_deliveries_status_created_idx
  on public.message_deliveries (status, created_at desc);

create table public.call_attempts (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  outcome text not null check (outcome in ('no_answer', 'confirmed', 'declined', 'callback', 'wrong_number')),
  number_confirmed integer check (number_confirmed is null or number_confirmed between 0 and 30),
  note text check (note is null or char_length(note) <= 500),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index call_attempts_invitation_created_idx on public.call_attempts (invitation_id, created_at desc);

alter table public.rsvp_responses enable row level security;
alter table public.message_deliveries enable row level security;
alter table public.call_attempts enable row level security;

-- Browser roles receive no policies. Reads and writes go through authenticated
-- server actions using the service-role client.
