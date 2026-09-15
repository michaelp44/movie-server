-- Live Wedding Wall: additive moderation metadata, controls, and reactions.

create type public.moderation_status as enum ('PENDING', 'APPROVED', 'NEEDS_REVIEW', 'BLOCKED');

alter table public.photo_uploads
  add column message text check (message is null or char_length(trim(message)) between 1 and 600),
  add column moderation_status public.moderation_status not null default 'PENDING',
  add column moderation_reason text,
  add column moderation_categories jsonb not null default '[]'::jsonb,
  add column moderation_confidence real check (moderation_confidence is null or moderation_confidence between 0 and 1),
  add column approved_at timestamptz,
  add column hidden_at timestamptz;

alter table public.guestbook_messages
  add column moderation_status public.moderation_status not null default 'PENDING',
  add column moderation_reason text,
  add column moderation_categories jsonb not null default '[]'::jsonb,
  add column moderation_confidence real check (moderation_confidence is null or moderation_confidence between 0 and 1),
  add column approved_at timestamptz,
  add column hidden_at timestamptz;

update public.photo_uploads set
  moderation_status = case when approved then 'APPROVED'::public.moderation_status when rejected then 'BLOCKED'::public.moderation_status else 'PENDING'::public.moderation_status end,
  approved_at = case when approved then coalesce(moderated_at, updated_at) else null end;

update public.guestbook_messages set
  moderation_status = case when approved then 'APPROVED'::public.moderation_status when rejected then 'BLOCKED'::public.moderation_status else 'PENDING'::public.moderation_status end,
  approved_at = case when approved then coalesce(moderated_at, updated_at) else null end;

create index photo_uploads_live_wall_idx
  on public.photo_uploads (moderation_status, approved_at desc)
  where upload_completed and hidden_at is null;
create index guestbook_messages_live_wall_idx
  on public.guestbook_messages (moderation_status, approved_at desc)
  where hidden_at is null;

create table public.live_wall_reactions (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid references public.invitations(id) on delete set null,
  session_hash text not null check (session_hash ~ '^[a-f0-9]{64}$'),
  emoji text not null check (emoji in ('❤️', '🔥', '😂', '🥂')),
  created_at timestamptz not null default now()
);

create index live_wall_reactions_created_idx on public.live_wall_reactions (created_at desc);
alter table public.live_wall_reactions enable row level security;
revoke all on public.live_wall_reactions from anon, authenticated;
grant all privileges on public.live_wall_reactions to service_role;

insert into public.site_settings (key, value, description) values
  ('live_wall_enabled', 'true'::jsonb, 'Allows the venue screen to display approved content.'),
  ('live_wall_paused', 'false'::jsonb, 'Pauses automatic rotation.'),
  ('live_wall_blank', 'false'::jsonb, 'Immediately blanks the venue screen.')
on conflict (key) do nothing;
