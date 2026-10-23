alter table public.message_campaigns
  add column guest_group_filter text
  check (guest_group_filter is null or char_length(guest_group_filter) <= 100);
