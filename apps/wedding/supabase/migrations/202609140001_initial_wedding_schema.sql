-- Shoval & Michael wedding website: private guest data, moderation, and sync schema.
-- Apply with `supabase db push` or paste this migration into the Supabase SQL editor.

create extension if not exists pgcrypto with schema extensions;

create type public.rsvp_status as enum ('pending', 'confirmed', 'declined', 'maybe');
create type public.sync_mode as enum ('preview', 'apply');
create type public.sync_status as enum ('running', 'completed', 'completed_with_errors', 'failed');
create type public.sync_item_action as enum ('addition', 'update', 'unchanged', 'conflict', 'error', 'missing');

create or replace function public.generate_urlsafe_token(byte_count integer default 32)
returns text
language sql
volatile
set search_path = ''
as $$
  select translate(encode(extensions.gen_random_bytes(byte_count), 'base64'), '+/=', '-_');
$$;

create table public.wedding_tables (
  id uuid primary key default gen_random_uuid(),
  table_number text not null unique check (char_length(trim(table_number)) between 1 and 24),
  name text check (name is null or char_length(name) <= 100),
  capacity integer check (capacity is null or capacity > 0),
  notes text check (notes is null or char_length(notes) <= 1000),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (char_length(trim(display_name)) between 1 and 160),
  primary_phone text,
  normalized_phone text not null unique check (normalized_phone ~ '^\+972[0-9]{8,9}$'),
  number_invited integer not null default 1 check (number_invited between 1 and 30),
  number_confirmed integer not null default 0 check (number_confirmed between 0 and 30),
  rsvp_status public.rsvp_status not null default 'pending',
  table_number text references public.wedding_tables(table_number) on update cascade on delete set null,
  guest_group text check (guest_group is null or char_length(guest_group) <= 100),
  secure_token text not null unique default public.generate_urlsafe_token(32) check (char_length(secure_token) >= 40),
  source_row_id text,
  source_tab text,
  source_payload jsonb not null default '{}'::jsonb,
  source_hash text,
  missing_from_source boolean not null default false,
  last_synced_at timestamptz,
  sync_managed boolean not null default false,
  admin_notes text check (admin_notes is null or char_length(admin_notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invitations_confirmed_not_above_invited check (number_confirmed <= number_invited),
  constraint invitations_source_identity_complete check (
    (source_row_id is null and source_tab is null) or
    (source_row_id is not null and source_tab is not null)
  )
);

create unique index invitations_source_row_unique
  on public.invitations (source_tab, source_row_id)
  where source_row_id is not null;
create index invitations_rsvp_status_idx on public.invitations (rsvp_status);
create index invitations_table_number_idx on public.invitations (table_number);
create index invitations_missing_from_source_idx on public.invitations (missing_from_source) where missing_from_source;

create table public.guests (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  first_name text not null check (char_length(trim(first_name)) between 1 and 100),
  last_name text check (last_name is null or char_length(last_name) <= 100),
  phone text,
  normalized_phone text check (normalized_phone is null or normalized_phone ~ '^\+972[0-9]{8,9}$'),
  relationship_category text check (relationship_category is null or char_length(relationship_category) <= 100),
  guest_order integer not null default 0 check (guest_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index guests_invitation_id_idx on public.guests (invitation_id, guest_order);
create unique index guests_invitation_order_unique on public.guests (invitation_id, guest_order);
create unique index guests_normalized_phone_unique on public.guests (normalized_phone) where normalized_phone is not null;

create table public.photo_uploads (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid references public.invitations(id) on delete set null,
  uploader_name text check (uploader_name is null or char_length(uploader_name) <= 160),
  table_number text references public.wedding_tables(table_number) on update cascade on delete set null,
  storage_path text not null unique check (storage_path ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}/[0-9a-f-]{36}\.[a-z0-9]{2,5}$'),
  mime_type text not null,
  media_kind text not null check (media_kind in ('image', 'video')),
  file_size bigint not null check (file_size > 0 and file_size <= 157286400),
  upload_completed boolean not null default false,
  upload_token_hash text check (upload_token_hash is null or upload_token_hash ~ '^[a-f0-9]{64}$'),
  approved boolean not null default false,
  rejected boolean not null default false,
  moderated_at timestamptz,
  moderated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint photo_uploads_one_moderation_state check (not (approved and rejected))
);

create index photo_uploads_moderation_idx on public.photo_uploads (approved, rejected, created_at desc);
create index photo_uploads_invitation_id_idx on public.photo_uploads (invitation_id);

create table public.guestbook_messages (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid references public.invitations(id) on delete set null,
  display_name text not null check (char_length(trim(display_name)) between 2 and 80),
  message text not null check (char_length(trim(message)) between 3 and 1200),
  approved boolean not null default false,
  rejected boolean not null default false,
  moderated_at timestamptz,
  moderated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guestbook_messages_one_moderation_state check (not (approved and rejected))
);

create index guestbook_messages_moderation_idx on public.guestbook_messages (approved, rejected, created_at desc);
create index guestbook_messages_invitation_id_idx on public.guestbook_messages (invitation_id);

create table public.song_requests (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid references public.invitations(id) on delete set null,
  display_name text check (display_name is null or char_length(display_name) <= 80),
  song text not null check (char_length(trim(song)) between 1 and 160),
  artist text not null check (char_length(trim(artist)) between 1 and 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index song_requests_created_at_idx on public.song_requests (created_at desc);
create unique index song_requests_invitation_song_unique
  on public.song_requests (invitation_id, lower(song), lower(artist))
  where invitation_id is not null;
create unique index song_requests_anonymous_song_unique
  on public.song_requests (lower(display_name), lower(song), lower(artist))
  where invitation_id is null and display_name is not null;

create table public.site_settings (
  key text primary key check (key ~ '^[a-z][a-z0-9_]{1,63}$'),
  value jsonb not null,
  description text check (description is null or char_length(description) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.site_settings (key, value, description) values
  ('seating_published', 'false'::jsonb, 'Controls whether guests can see table assignments.'),
  ('gallery_published', 'false'::jsonb, 'Controls whether approved guest media is visible.');

create table public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  status public.sync_status not null default 'running',
  mode public.sync_mode not null,
  source_sheet_id text not null,
  source_tab text not null,
  initiated_by uuid references auth.users(id) on delete set null,
  processed_count integer not null default 0,
  addition_count integer not null default 0,
  update_count integer not null default 0,
  unchanged_count integer not null default 0,
  conflict_count integer not null default 0,
  missing_count integer not null default 0,
  error_count integer not null default 0,
  report jsonb not null default '{}'::jsonb,
  error text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index sync_runs_started_at_idx on public.sync_runs (started_at desc);

create table public.sync_run_items (
  id uuid primary key default gen_random_uuid(),
  sync_run_id uuid not null references public.sync_runs(id) on delete cascade,
  invitation_id uuid references public.invitations(id) on delete set null,
  source_row_id text,
  action public.sync_item_action not null,
  display_name text,
  changes jsonb not null default '{}'::jsonb,
  source_payload jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now()
);

create index sync_run_items_run_idx on public.sync_run_items (sync_run_id, action);

create table public.rate_limits (
  action text not null,
  identifier_hash text not null check (identifier_hash ~ '^[a-f0-9]{64}$'),
  bucket_start timestamptz not null,
  request_count integer not null default 1 check (request_count > 0),
  expires_at timestamptz not null,
  primary key (action, identifier_hash, bucket_start)
);

create index rate_limits_expires_at_idx on public.rate_limits (expires_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger wedding_tables_set_updated_at before update on public.wedding_tables
  for each row execute function public.set_updated_at();
create trigger invitations_set_updated_at before update on public.invitations
  for each row execute function public.set_updated_at();
create trigger guests_set_updated_at before update on public.guests
  for each row execute function public.set_updated_at();
create trigger photo_uploads_set_updated_at before update on public.photo_uploads
  for each row execute function public.set_updated_at();
create trigger guestbook_messages_set_updated_at before update on public.guestbook_messages
  for each row execute function public.set_updated_at();
create trigger song_requests_set_updated_at before update on public.song_requests
  for each row execute function public.set_updated_at();
create trigger site_settings_set_updated_at before update on public.site_settings
  for each row execute function public.set_updated_at();

create or replace function public.consume_rate_limit(
  p_action text,
  p_identifier_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns table (allowed boolean, remaining integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bucket_start timestamptz;
  v_reset_at timestamptz;
  v_count integer;
begin
  if p_action !~ '^[a-z0-9][a-z0-9:_-]{0,63}$'
     or p_identifier_hash !~ '^[a-f0-9]{64}$'
     or p_limit < 1 or p_limit > 10000
     or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'Invalid rate limit parameters';
  end if;

  v_bucket_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_reset_at := v_bucket_start + make_interval(secs => p_window_seconds);

  insert into public.rate_limits (action, identifier_hash, bucket_start, request_count, expires_at)
  values (p_action, p_identifier_hash, v_bucket_start, 1, v_reset_at + interval '5 minutes')
  on conflict (action, identifier_hash, bucket_start)
  do update set request_count = public.rate_limits.request_count + 1
  returning request_count into v_count;

  return query select v_count <= p_limit, greatest(0, p_limit - v_count), v_reset_at;
end;
$$;

alter table public.wedding_tables enable row level security;
alter table public.invitations enable row level security;
alter table public.guests enable row level security;
alter table public.photo_uploads enable row level security;
alter table public.guestbook_messages enable row level security;
alter table public.song_requests enable row level security;
alter table public.site_settings enable row level security;
alter table public.sync_runs enable row level security;
alter table public.sync_run_items enable row level security;
alter table public.rate_limits enable row level security;

-- The browser anon/authenticated roles receive no direct table access. All guest
-- reads/writes go through authorized server code. The service role bypasses RLS.
revoke all on all tables in schema public from anon, authenticated;
revoke all on function public.generate_urlsafe_token(integer) from public, anon, authenticated;
revoke all on function public.consume_rate_limit(text, text, integer, integer) from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;

grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant execute on function public.generate_urlsafe_token(integer) to service_role;
grant execute on function public.consume_rate_limit(text, text, integer, integer) to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'wedding-media',
  'wedding-media',
  false,
  157286400,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'video/mp4', 'video/quicktime', 'video/webm']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Deliberately no anon/authenticated storage policies: signed upload URLs are
-- minted by the server and approved reads use short-lived server-signed URLs.
