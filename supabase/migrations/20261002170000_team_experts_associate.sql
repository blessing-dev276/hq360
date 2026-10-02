-- Experts linked to a team member are Associates (all expert tools).
update public.expert_profiles
set role = 'associate', permissions = array['scout', 'audit', 'invoices']
where claimed_team_member_id is not null
  and (role <> 'associate' or not permissions @> array['scout', 'audit', 'invoices']);
