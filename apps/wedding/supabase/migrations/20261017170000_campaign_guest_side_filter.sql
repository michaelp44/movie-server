alter table public.message_campaigns
  add column guest_side_filter text
  check (guest_side_filter is null or guest_side_filter in ('michael', 'shoval', 'unassigned'));
