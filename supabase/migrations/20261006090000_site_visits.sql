-- Privacy-light page-view log for the admin Visitors tab. No IP addresses are stored;
-- country comes from the hosting edge's geo header, the visitor id is a per-tab random value.
create table public.site_visits (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  visitor_id text not null check (char_length(visitor_id) <= 64),
  path text not null check (char_length(path) <= 300),
  referrer_host text check (char_length(referrer_host) <= 200),
  country text check (char_length(country) <= 2),
  device text check (device in ('mobile', 'tablet', 'desktop'))
);
create index site_visits_created_at_idx on public.site_visits (created_at desc);
alter table public.site_visits enable row level security;
revoke all on public.site_visits from anon, authenticated;
grant all on public.site_visits to service_role;
