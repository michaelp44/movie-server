-- Optional, pre-generated editorial illustrations for occasional Live Wall reveals.

alter table public.photo_uploads
  add column illustration_path text,
  add column illustration_status text not null default 'PENDING'
    check (illustration_status in ('PENDING', 'GENERATING', 'READY', 'SKIPPED', 'FAILED', 'BLOCKED')),
  add column illustration_created_at timestamptz;

update public.photo_uploads
set illustration_status = 'SKIPPED'
where media_kind <> 'image';

create index photo_uploads_illustration_queue_idx
  on public.photo_uploads (illustration_status, approved_at)
  where upload_completed and moderation_status = 'APPROVED' and media_kind = 'image';

insert into public.site_settings (key, value, description) values
  ('live_wall_ai_art', 'true'::jsonb, 'Pre-generates occasional editorial illustrations for the Live Wall.')
on conflict (key) do nothing;
