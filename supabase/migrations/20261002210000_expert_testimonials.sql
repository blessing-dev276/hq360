-- Video testimonials experts add to their own public profile.
--
-- Same review flow as expert_portfolio_items: an expert submits, it's
-- 'pending' until an admin approves, and only approved rows show publicly.
-- Reads/writes go through server routes with the service role.

create table public.expert_testimonials (
  id uuid primary key default gen_random_uuid(),
  expert_id uuid not null references public.expert_profiles(id) on delete cascade,
  client_name text not null check (char_length(client_name) between 2 and 120),
  client_role text check (char_length(client_role) <= 120),
  quote text check (char_length(quote) <= 500),
  video_url text not null check (char_length(video_url) <= 500),
  service_slug text check (char_length(service_slug) <= 60),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_at timestamptz,
  reviewed_by text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index expert_testimonials_expert_idx on public.expert_testimonials (expert_id, created_at desc);
alter table public.expert_testimonials enable row level security;
revoke all on public.expert_testimonials from anon, authenticated;
grant all on public.expert_testimonials to service_role;

-- Public bucket for the videos; uploads use signed URLs scoped to the
-- expert's own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('expert-videos', 'expert-videos', true, 52428800,
        array['video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do nothing;
drop policy if exists "expert videos public read" on storage.objects;
create policy "expert videos public read"
  on storage.objects for select
  using (bucket_id = 'expert-videos');

-- Notifications (see 20261002160000_notifications.sql).
create or replace function public.notify_expert_testimonials() returns trigger
language plpgsql security definer set search_path = public as $$
declare who text;
begin
  if tg_op = 'INSERT' then
    if new.status = 'pending' then
      select coalesce(nullif(full_name, ''), email) into who
        from expert_profiles where id = new.expert_id;
      perform hq_notify('admin', null, 'testimonial_submitted', 'Testimonial video to review',
        coalesce(who, 'An expert') || ' added a video from ' || new.client_name || '.', 'experts');
    end if;
  elsif new.status is distinct from old.status and new.status in ('approved', 'rejected') then
    perform hq_notify('expert', new.expert_id, 'testimonial_' || new.status,
      'Testimonial video ' || new.status,
      'Your video from ' || new.client_name || ' was ' || new.status || '.', 'portfolio');
  end if;
  return new;
end $$;
create trigger notify_expert_testimonials
  after insert or update on public.expert_testimonials
  for each row execute function public.notify_expert_testimonials();
