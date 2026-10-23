-- Private activity history for personalized invitation links and RSVP interactions.
create table if not exists public.invitation_activity (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  event_type text not null check (event_type in (
    'link_opened', 'rsvp_page_viewed', 'interaction', 'rsvp_saved', 'rsvp_failed'
  )),
  target text check (target is null or char_length(target) <= 80),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists invitation_activity_invitation_created_idx
  on public.invitation_activity (invitation_id, created_at desc);
create index if not exists invitation_activity_created_idx
  on public.invitation_activity (created_at desc);

alter table public.invitation_activity enable row level security;
-- No browser-role policies. Server-side service role is the only writer/reader.
revoke all on public.invitation_activity from anon, authenticated;
grant all privileges on public.invitation_activity to service_role;
