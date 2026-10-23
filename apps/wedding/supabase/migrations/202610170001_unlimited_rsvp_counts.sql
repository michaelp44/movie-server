-- Attendance may exceed the original invitation estimate. Keep counts nonnegative.

alter table public.invitations
  drop constraint if exists invitations_confirmed_not_above_invited,
  drop constraint if exists invitations_number_confirmed_check,
  add constraint invitations_number_confirmed_nonnegative check (number_confirmed >= 0);

alter table public.rsvp_responses
  drop constraint if exists rsvp_responses_number_confirmed_check,
  add constraint rsvp_responses_number_confirmed_nonnegative check (number_confirmed >= 0);

alter table public.call_attempts
  drop constraint if exists call_attempts_number_confirmed_check,
  add constraint call_attempts_number_confirmed_nonnegative check (number_confirmed is null or number_confirmed >= 0);
