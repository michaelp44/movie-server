-- Anonymous, one-per-device likes for approved wedding gallery photos.
create table public.photo_likes (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.photo_uploads(id) on delete cascade,
  invitation_id uuid references public.invitations(id) on delete set null,
  visitor_hash text not null check (visitor_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  unique (photo_id, visitor_hash)
);

create index photo_likes_photo_id_idx on public.photo_likes (photo_id, created_at desc);
alter table public.photo_likes enable row level security;
revoke all on public.photo_likes from anon, authenticated;
grant all privileges on public.photo_likes to service_role;
