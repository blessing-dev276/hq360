-- Expert profile publishing is admin-controlled: experts submit for review,
-- admin previews content and publishes/unpublishes. Experts can also submit
-- portfolio items (tagged with services/audiences from the static site data)
-- that go through the same admin approval before showing publicly. Admin can
-- also let a newly-approved expert "claim" an existing manually-added
-- team_members row, pre-filling their profile from it.

alter table public.expert_profiles
  add column profile_status text not null default 'draft'
    check (profile_status in ('draft', 'submitted', 'approved', 'changes_requested')),
  add column profile_submitted_at timestamptz,
  add column profile_reviewed_at timestamptz,
  add column profile_reviewed_by text,
  add column profile_review_note text check (char_length(profile_review_note) <= 1000),
  add column claimed_team_member_id uuid references public.team_members(id) on delete set null;

alter table public.team_members
  add column claimed_by_expert_id uuid unique references public.expert_profiles(id) on delete set null;

create table public.expert_portfolio_items (
  id uuid primary key default gen_random_uuid(),
  expert_id uuid not null references public.expert_profiles(id) on delete cascade,
  title text not null check (char_length(title) <= 150),
  description text check (char_length(description) <= 2000),
  image_url text,
  external_link text,
  service_slugs text[] not null default '{}',
  audience_slugs text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_at timestamptz,
  reviewed_by text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index expert_portfolio_items_expert_id_idx on public.expert_portfolio_items(expert_id);
alter table public.expert_portfolio_items enable row level security;
revoke all on public.expert_portfolio_items from anon, authenticated;
grant all on public.expert_portfolio_items to service_role;
