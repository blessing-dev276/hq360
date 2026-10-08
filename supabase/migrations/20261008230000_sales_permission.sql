-- Invoices, Quotes and Proposals are one "Sales" tool for experts, granted by
-- the existing "invoices" permission. Anyone who had Quotes keeps access.
update public.expert_profiles
  set permissions = array(
    select distinct p from unnest(array_append(permissions, 'invoices')) p where p <> 'quotes'
  )
  where 'quotes' = any(permissions);

-- Access notifications name the merged tool.
create or replace function public.notify_expert_access() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  added text[];
  removed text[];
  role_label text;
  body text;
  tool_label constant jsonb := '{"scout":"Scouting","audit":"Audit","invoices":"Sales (Proposals, Quotes & Invoices)","contacts":"Find Author Contact"}';
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
