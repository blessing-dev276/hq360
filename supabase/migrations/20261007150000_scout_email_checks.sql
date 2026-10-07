-- Free, automatic email verification for Scout contacts.
--
-- Whenever an author's or audience lead's contact_email is set or changed,
-- it is marked 'pending' and the site's checker endpoint is pinged (pg_net,
-- after commit). The checker runs free tests -- format, mail servers (DNS
-- MX), whether the address is still published on its source/website,
-- domain-vs-website match, role/disposable address, Gravatar -- and stores
-- a confidence label. No paid API is involved.
--
-- email_check_status:
--   pending | checking | verified_source | likely_valid | unconfirmed | invalid

alter table public.scout_authors
  add column email_check_status text check (email_check_status in
    ('pending', 'checking', 'verified_source', 'likely_valid', 'unconfirmed', 'invalid')),
  add column email_check jsonb,
  add column email_checked_at timestamptz;
alter table public.scout_audience_leads
  add column email_check_status text check (email_check_status in
    ('pending', 'checking', 'verified_source', 'likely_valid', 'unconfirmed', 'invalid')),
  add column email_check jsonb,
  add column email_checked_at timestamptz;

create index scout_authors_email_check_pending_idx on public.scout_authors (updated_at)
  where email_check_status in ('pending', 'checking');
create index scout_audience_leads_email_check_pending_idx on public.scout_audience_leads (updated_at)
  where email_check_status in ('pending', 'checking');

-- Mark a new/changed email for checking (before the row is written).
create or replace function public.scout_email_check_mark() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.contact_email is null or btrim(new.contact_email) = '' then
    new.email_check_status := null;
    new.email_check := null;
    new.email_checked_at := null;
  elsif tg_op = 'INSERT' or new.contact_email is distinct from old.contact_email then
    new.email_check_status := 'pending';
    new.email_check := null;
    new.email_checked_at := null;
  end if;
  return new;
end $$;

-- Ask the site to run pending checks (after commit; best-effort).
create or replace function public.scout_email_check_ping() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.email_check_status = 'pending' then
    perform net.http_post(
      url := 'https://www.hq360.space/api/scout/verify-emails',
      body := '{}'::jsonb,
      headers := '{"content-type": "application/json"}'::jsonb
    );
  end if;
  return new;
exception when others then
  return new;
end $$;

-- Backfill existing emails before the ping trigger exists, then ping once.
update public.scout_authors set email_check_status = 'pending'
  where contact_email is not null and btrim(contact_email) <> '';
update public.scout_audience_leads set email_check_status = 'pending'
  where contact_email is not null and btrim(contact_email) <> '';

create trigger scout_authors_email_check_mark
  before insert or update of contact_email on public.scout_authors
  for each row execute function public.scout_email_check_mark();
create trigger scout_audience_leads_email_check_mark
  before insert or update of contact_email on public.scout_audience_leads
  for each row execute function public.scout_email_check_mark();
create trigger scout_authors_email_check_ping
  after insert or update of contact_email on public.scout_authors
  for each row execute function public.scout_email_check_ping();
create trigger scout_audience_leads_email_check_ping
  after insert or update of contact_email on public.scout_audience_leads
  for each row execute function public.scout_email_check_ping();

-- Atomically claim pending (or stuck) checks so concurrent pings never
-- double-process a row.
create or replace function public.scout_claim_email_checks(p_limit integer default 20)
returns table (kind text, id uuid, email text, website_url text, source_url text)
language plpgsql security definer set search_path = public as $$
begin
  return query
  with a as (
    update scout_authors s set email_check_status = 'checking',
      email_check = jsonb_build_object('claimed_at', now())
    where s.id in (
      select x.id from scout_authors x
      where x.email_check_status = 'pending'
         or (x.email_check_status = 'checking'
             and coalesce((x.email_check->>'claimed_at')::timestamptz, 'epoch') < now() - interval '5 minutes')
      order by x.updated_at
      limit p_limit
      for update skip locked)
    returning s.id, s.contact_email, s.website_url
  )
  select 'author'::text, a.id, a.contact_email, a.website_url,
    (select n.source_url from scout_research_notes n
      where n.scout_author_id = a.id and n.source_url is not null
      order by n.created_at desc limit 1)
  from a;

  return query
  with l as (
    update scout_audience_leads s set email_check_status = 'checking',
      email_check = jsonb_build_object('claimed_at', now())
    where s.id in (
      select x.id from scout_audience_leads x
      where x.email_check_status = 'pending'
         or (x.email_check_status = 'checking'
             and coalesce((x.email_check->>'claimed_at')::timestamptz, 'epoch') < now() - interval '5 minutes')
      order by x.updated_at
      limit p_limit
      for update skip locked)
    returning s.id, s.contact_email, s.website_url, s.contact_source_url
  )
  select 'lead'::text, l.id, l.contact_email, l.website_url, l.contact_source_url from l;
end $$;
revoke all on function public.scout_claim_email_checks(integer) from public, anon, authenticated;
grant execute on function public.scout_claim_email_checks(integer) to service_role;

-- Kick off the backfill once.
do $$ begin
  perform net.http_post(
    url := 'https://www.hq360.space/api/scout/verify-emails',
    body := '{}'::jsonb,
    headers := '{"content-type": "application/json"}'::jsonb
  );
exception when others then null;
end $$;
