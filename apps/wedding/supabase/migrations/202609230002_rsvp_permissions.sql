-- Service-role access for RSVP tables created after the initial schema grant.

revoke all on public.rsvp_responses from anon, authenticated;
revoke all on public.message_deliveries from anon, authenticated;
revoke all on public.call_attempts from anon, authenticated;

grant all privileges on public.rsvp_responses to service_role;
grant all privileges on public.message_deliveries to service_role;
grant all privileges on public.call_attempts to service_role;

create trigger message_deliveries_set_updated_at
before update on public.message_deliveries
for each row execute function public.set_updated_at();
