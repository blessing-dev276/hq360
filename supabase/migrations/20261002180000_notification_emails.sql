-- Email admin notifications to the HQ360 inbox.
--
-- When an admin notification row is written, the database pings the site's
-- dispatch endpoint (via pg_net, after the transaction commits). The endpoint
-- emails every admin notification not yet emailed and stamps emailed_at, so
-- a missed ping is caught by the next one or by the admin bell's poll.
create extension if not exists pg_net with schema extensions;

alter table public.notifications
  add column emailed_at timestamptz,
  add column email_claimed_at timestamptz;

-- Don't email the backlog that existed before this feature.
update public.notifications set emailed_at = now() where emailed_at is null;

create index notifications_unemailed_idx on public.notifications (created_at)
  where audience = 'admin' and emailed_at is null;

create or replace function public.ping_notification_email() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.audience = 'admin' then
    perform net.http_post(
      url := 'https://www.hq360.space/api/notifications/dispatch',
      body := '{}'::jsonb,
      headers := '{"content-type": "application/json"}'::jsonb
    );
  end if;
  return new;
exception when others then
  -- Email is best-effort; never block the event that raised the notification.
  return new;
end $$;
create trigger ping_notification_email
  after insert on public.notifications
  for each row execute function public.ping_notification_email();
