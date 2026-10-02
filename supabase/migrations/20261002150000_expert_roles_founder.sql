-- Expert roles: admin grants specific workspace features per expert.
-- Permissions are enforced server-side on the Scout, Audit and Invoice APIs.
alter table public.expert_profiles
  add column role text not null default 'contributor'
    check (role in ('contributor', 'scout', 'analyst', 'sales_partner', 'associate', 'custom')),
  add column permissions text[] not null default '{}'
    check (permissions <@ array['scout', 'audit', 'invoices']::text[]),
  -- The founder profile is an expert profile the admin claims and edits.
  add column is_founder boolean not null default false,
  add column managed_by_admin boolean not null default false;

create unique index expert_profiles_one_founder on public.expert_profiles (is_founder) where is_founder;
