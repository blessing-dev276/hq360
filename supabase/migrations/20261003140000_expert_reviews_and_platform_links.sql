-- Fiverr/Upwork profile links and screenshot-backed client reviews for experts.

alter table public.expert_profiles
  add column fiverr_url text check (char_length(fiverr_url) <= 300),
  add column upwork_url text check (char_length(upwork_url) <= 300);

-- Client reviews an expert adds with a screenshot of the original. Same
-- review flow as expert_testimonials: pending until an admin approves.
create table public.expert_reviews (
  id uuid primary key default gen_random_uuid(),
  expert_id uuid not null references public.expert_profiles(id) on delete cascade,
  client_name text not null check (char_length(client_name) between 2 and 120),
  platform text not null default 'direct' check (platform in ('fiverr', 'upwork', 'direct', 'other')),
  rating integer check (rating between 1 and 5),
  review_text text not null check (char_length(review_text) between 2 and 1500),
  review_date date,
  screenshot_url text not null check (char_length(screenshot_url) <= 500),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_at timestamptz,
  reviewed_by text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index expert_reviews_expert_idx on public.expert_reviews (expert_id, created_at desc);
alter table public.expert_reviews enable row level security;
revoke all on public.expert_reviews from anon, authenticated;
grant all on public.expert_reviews to service_role;

-- Notifications (see 20261002160000_notifications.sql).
create or replace function public.notify_expert_reviews() returns trigger
language plpgsql security definer set search_path = public as $$
declare who text;
begin
  if tg_op = 'INSERT' then
    if new.status = 'pending' then
      select coalesce(nullif(full_name, ''), email) into who
        from expert_profiles where id = new.expert_id;
      perform hq_notify('admin', null, 'review_submitted', 'Client review to verify',
        coalesce(who, 'An expert') || ' added a review from ' || new.client_name || '.', 'experts');
    end if;
  elsif new.status is distinct from old.status and new.status in ('approved', 'rejected') then
    perform hq_notify('expert', new.expert_id, 'review_' || new.status,
      'Client review ' || new.status,
      'Your review from ' || new.client_name || ' was ' || new.status || '.', 'portfolio');
  end if;
  return new;
end $$;
create trigger notify_expert_reviews
  after insert or update on public.expert_reviews
  for each row execute function public.notify_expert_reviews();
