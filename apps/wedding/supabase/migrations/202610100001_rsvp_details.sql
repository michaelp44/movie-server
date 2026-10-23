-- Structured guest preferences are separate from the Google Sheet-managed guest list.
alter table public.invitations
  add column if not exists rsvp_details jsonb;

alter table public.rsvp_responses
  add column if not exists details jsonb;
