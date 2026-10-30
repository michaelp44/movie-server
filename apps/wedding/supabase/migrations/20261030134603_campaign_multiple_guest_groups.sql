alter table public.message_campaigns
  add column guest_group_selections text[],
  add constraint message_campaigns_guest_group_selections_check
    check (
      guest_group_selections is null
      or (
        cardinality(guest_group_selections) between 1 and 50
        and array_position(guest_group_selections, '') is null
      )
    );
