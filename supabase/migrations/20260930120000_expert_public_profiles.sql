-- Public expert profiles: approved experts can publish a page at /experts/<slug>.
-- Only rows that are both approved and opted-in (is_public) are ever served publicly.
alter table public.expert_profiles
  add column slug text unique,
  add column headline text check (char_length(headline) <= 160),
  add column bio text check (char_length(bio) <= 4000),
  add column photo_url text,
  add column specialties text[] not null default '{}' check (cardinality(specialties) <= 12),
  add column location text check (char_length(location) <= 120),
  add column website_url text,
  add column linkedin_url text,
  add column is_public boolean not null default false,
  add column updated_at timestamptz not null default now();

create function public.expert_slug(p_name text, p_id uuid)
returns text
language sql
immutable
as $$
  select coalesce(
      nullif(trim(both '-' from regexp_replace(lower(coalesce(p_name, '')), '[^a-z0-9]+', '-', 'g')), ''),
      'expert'
    ) || '-' || substr(replace(p_id::text, '-', ''), 1, 6)
$$;

update public.expert_profiles set slug = public.expert_slug(full_name, id) where slug is null;
alter table public.expert_profiles alter column slug set not null;

create or replace function public.handle_new_expert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.raw_user_meta_data ->> 'account_type' = 'expert' then
    insert into public.expert_profiles (id, email, full_name, headline, slug)
    values (
      new.id,
      new.email,
      left(new.raw_user_meta_data ->> 'full_name', 150),
      nullif(left(new.raw_user_meta_data ->> 'headline', 160), ''),
      public.expert_slug(new.raw_user_meta_data ->> 'full_name', new.id)
    );
  end if;
  return new;
end;
$$;

-- Expert portraits (public read). Writes go through server-issued signed upload URLs only.
insert into storage.buckets (id, name, public)
values ('expert-photos', 'expert-photos', true)
on conflict (id) do nothing;

drop policy if exists "expert photos public read" on storage.objects;
create policy "expert photos public read"
  on storage.objects for select
  using (bucket_id = 'expert-photos');
