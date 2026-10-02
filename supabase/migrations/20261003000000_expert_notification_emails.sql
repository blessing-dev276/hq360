-- Email expert notifications too (admin ones already are; see
-- 20261002180000_notification_emails.sql). The dispatch endpoint now
-- emails each expert their own unsent notifications.

-- Don't email experts the backlog from before this feature.
update public.notifications set emailed_at = now()
  where audience = 'expert' and emailed_at is null;

create index notifications_expert_unemailed_idx on public.notifications (created_at)
  where audience = 'expert' and emailed_at is null;

create or replace function public.ping_notification_email() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform net.http_post(
    url := 'https://www.hq360.space/api/notifications/dispatch',
    body := '{}'::jsonb,
    headers := '{"content-type": "application/json"}'::jsonb
  );
  return new;
exception when others then
  -- Email is best-effort; never block the event that raised the notification.
  return new;
end $$;

-- Portfolio decisions now open the expert's Portfolio tab (it used to live
-- under Profile).
create or replace function public.notify_expert_portfolio() returns trigger
language plpgsql security definer set search_path = public as $$
declare who text;
begin
  if tg_op = 'INSERT' then
    if new.status = 'pending' then
      select coalesce(nullif(full_name, ''), email) into who
        from expert_profiles where id = new.expert_id;
      perform hq_notify('admin', null, 'portfolio_submitted', 'Portfolio item to review',
        coalesce(who, 'An expert') || ' submitted "' || new.title || '".', 'experts');
    end if;
  elsif new.status is distinct from old.status and new.status in ('approved', 'rejected') then
    perform hq_notify('expert', new.expert_id, 'portfolio_' || new.status,
      'Portfolio item ' || new.status,
      '"' || new.title || '" was ' || new.status || '.', 'portfolio');
  end if;
  return new;
end $$;
