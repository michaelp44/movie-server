alter table public.invitations
  drop constraint if exists invitations_normalized_phone_check,
  add constraint invitations_normalized_phone_check
    check (normalized_phone is null or normalized_phone ~ '^\+[1-9][0-9]{7,14}$');

alter table public.guests
  drop constraint if exists guests_normalized_phone_check,
  add constraint guests_normalized_phone_check
    check (normalized_phone is null or normalized_phone ~ '^\+[1-9][0-9]{7,14}$');
