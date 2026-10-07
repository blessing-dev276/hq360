-- Tell an expert (bell + email, via the existing expert email dispatch)
-- whenever their role or workspace tools change, however it happened:
-- the admin Access tab, being linked to the team, etc.
create or replace function public.notify_expert_access() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  added text[];
  removed text[];
  role_label text;
  body text;
  tool_label constant jsonb := '{"scout":"Scouting","audit":"Audit","invoices":"Invoices"}';
begin
  if new.managed_by_admin or new.status <> 'approved' then
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
  body := 'Your role is now ' || role_label || '.';
  if array_length(added, 1) > 0 then
    body := body || ' You can now use: ' || array_to_string(added, ', ') || '.';
  end if;
  if array_length(removed, 1) > 0 then
    body := body || ' No longer available: ' || array_to_string(removed, ', ') || '.';
  end if;
  if coalesce(array_length(new.permissions, 1), 0) = 0 then
    body := body || ' Your profile and portfolio stay available.';
  end if;
  perform hq_notify('expert', new.id, 'access_changed', 'Your workspace access changed', body, 'dashboard');
  return new;
end $$;
revoke all on function public.notify_expert_access() from public;

create trigger notify_expert_access
  after update of role, permissions on public.expert_profiles
  for each row execute function public.notify_expert_access();
