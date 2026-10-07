-- Expert accounts: self-signup (via Supabase Auth) gated behind admin approval,
-- scoped to Author Reports + Scout only in the /expert dashboard.
create table public.expert_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text
);
alter table public.expert_profiles enable row level security;
revoke all on public.expert_profiles from anon, authenticated;
grant all on public.expert_profiles to service_role;

-- Auto-create a pending profile when someone signs up with account_type=expert
-- in their auth metadata (set client-side by the /expert-signup form).
create function public.handle_new_expert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.raw_user_meta_data ->> 'account_type' = 'expert' then
    insert into public.expert_profiles (id, email, full_name)
    values (new.id, new.email, new.raw_user_meta_data ->> 'full_name');
  end if;
  return new;
end;
$$;
create trigger on_auth_user_created_expert
  after insert on auth.users
  for each row execute function public.handle_new_expert();
