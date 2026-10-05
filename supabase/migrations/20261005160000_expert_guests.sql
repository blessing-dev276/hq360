-- Guests: people the admin invites to use specific expert tools (Scouting,
-- Audit, Invoices) without an expert profile. A guest never appears publicly.
alter table public.expert_profiles
  add column is_guest boolean not null default false,
  -- One-time "set your password" link from the invite email (sha256 of the token).
  add column invite_token_hash text,
  add column invite_expires_at timestamptz,
  add column invited_at timestamptz,
  add constraint expert_profiles_guest_never_public check (not (is_guest and is_public));

create unique index expert_profiles_invite_token on public.expert_profiles (invite_token_hash)
  where invite_token_hash is not null;

-- Access-change emails: skip the moment an account is first approved/invited
-- (it gets its own welcome), and don't talk about roles to guests.
create or replace function public.notify_expert_access() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  added text[];
  removed text[];
  role_label text;
  body text;
  tool_label constant jsonb := '{"scout":"Scouting","audit":"Audit","invoices":"Invoices"}';
begin
  if new.managed_by_admin or new.status <> 'approved' or old.status <> 'approved' then
    return new;
  end if;
  if new.role is not distinct from old.role and new.permissions is not distinct from old.permissions then
    return new;
  end if;
  select coalesce(array_agg(tool_label ->> p order by p), '{}') into added
    from unnest(new.permissions) p where not p = any(coalesce(old.permissions, '{}'));
  select coalesce(array_agg(tool_label ->> p order by p), '{}') into removed
    from unnest(coalesce(old.permissions, '{}')) p where not p = any(new.permissions);
  role_label := case new.role
    when 'contributor' then 'Contributor'
    when 'scout' then 'Scout'
    when 'analyst' then 'Analyst'
    when 'sales_partner' then 'Sales Partner'
    when 'associate' then 'Associate'
    else 'Custom' end;
  body := case when new.is_guest then 'HQ360 updated the tools you can use.'
    else 'Your role is now ' || role_label || '.' end;
  if array_length(added, 1) > 0 then
    body := body || ' You can now use: ' || array_to_string(added, ', ') || '.';
  end if;
  if array_length(removed, 1) > 0 then
    body := body || ' No longer available: ' || array_to_string(removed, ', ') || '.';
  end if;
  if coalesce(array_length(new.permissions, 1), 0) = 0 then
    body := body || case when new.is_guest then ' You have no tools right now.'
      else ' Your profile and portfolio stay available.' end;
  end if;
  perform hq_notify('expert', new.id, 'access_changed', 'Your workspace access changed', body, 'dashboard');
  return new;
end $$;
revoke all on function public.notify_expert_access() from public;
