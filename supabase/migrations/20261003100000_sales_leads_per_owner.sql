-- Leads & Projects per workspace: every lead has an owner -- 'hq360' for the
-- admin team, or an expert's profile id (as text, same convention as Scout).
-- An expert's own Scout prospects and visibility-check referrals now become
-- leads in that expert's workspace instead of being left out of the pipeline.

alter table public.sales_leads add column owner text not null default 'hq360';
create index sales_leads_owner_idx on public.sales_leads (owner, created_at desc);

create or replace function public.capture_sales_lead() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'project_inquiries' then
    insert into sales_leads(source_kind,source_id,name,email,agreed_service,notes,owner)
    values ('inquiry',new.id,new.name,new.email,array_to_string(new.help_with,', '),coalesce(new.message,''),'hq360')
    on conflict do nothing;
  elsif tg_table_name = 'author_audit_leads' then
    insert into sales_leads(source_kind,source_id,name,email,agreed_service,notes,owner)
    values ('visibility_check',new.id,new.author_name,new.email,'Author Visibility & Marketing',new.book_title,
      coalesce(new.expert_id::text,'hq360'))
    on conflict do nothing;
  elsif tg_table_name = 'scout_prospects' then
    if new.status <> 'excluded' and not new.do_not_contact then
      insert into sales_leads(source_kind,source_id,name,email,notes,owner)
      select 'scout',new.id,a.name,coalesce(a.contact_email,''),
        'Review Scout evidence and contact permissions before introduction.', new.owner
      from scout_authors a where a.id = new.scout_author_id on conflict do nothing;
    else
      update sales_leads set stage = 'lost', next_follow_up = null,
        notes = notes || E'\nScout marked excluded / do not contact.'
      where source_kind='scout' and source_id=new.id;
    end if;
  end if;
  return new;
end $$;
revoke all on function public.capture_sales_lead() from public;

-- Only HQ360's own leads ping the admin bell; experts' leads stay theirs.
create or replace function public.notify_sales_leads() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.source_kind <> 'manual' and new.owner = 'hq360' then
    perform hq_notify('admin', null, 'new_lead', 'New lead',
      new.name || case new.source_kind
        when 'inquiry' then ' sent an inquiry.'
        when 'visibility_check' then ' requested a visibility check.'
        else ' was saved from Scout.' end, 'projects');
  end if;
  return new;
end $$;

-- Backfill leads for experts' existing Scout prospects and referrals.
insert into public.sales_leads(created_at,source_kind,source_id,name,email,notes,owner)
select p.created_at,'scout',p.id,a.name,coalesce(a.contact_email,''),
  'Review Scout evidence and contact permissions before introduction.', p.owner
from public.scout_prospects p join public.scout_authors a on a.id = p.scout_author_id
where p.owner <> 'hq360' and p.status <> 'excluded' and not p.do_not_contact
on conflict do nothing;

insert into public.sales_leads(created_at,source_kind,source_id,name,email,agreed_service,notes,owner)
select created_at,'visibility_check',id,author_name,email,'Author Visibility & Marketing',book_title,expert_id::text
from public.author_audit_leads where expert_id is not null
on conflict do nothing;
