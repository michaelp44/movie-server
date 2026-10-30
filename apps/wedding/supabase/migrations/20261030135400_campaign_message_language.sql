alter table public.message_campaigns
  add column message_language text not null default 'auto'
  check (message_language in ('auto', 'he', 'en'));
