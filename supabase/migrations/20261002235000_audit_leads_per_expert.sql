-- Expert referral links for the free Author Visibility Check.
--
-- A request made through an expert's personal link
-- (/tools/author-visibility-audit?expert=<slug>) belongs to that expert: it
-- shows in their Audit workspace, notifies them, and the audit they start
-- from it is assigned to them. Requests without a link stay with HQ360.

alter table public.author_audit_leads
  add column expert_id uuid references public.expert_profiles(id) on delete set null;
create index author_audit_leads_expert_idx
  on public.author_audit_leads (expert_id, created_at desc);

-- Notify the expert (or the HQ360 team) when a request arrives.
create or replace function public.notify_author_audit_leads() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.expert_id is not null then
    perform hq_notify('expert', new.expert_id, 'audit_request', 'New audit request',
      new.author_name || ' requested a visibility check for "' || new.book_title
        || '" through your link.', 'audit');
  end if;
  return new;
end $$;
create trigger notify_author_audit_leads
  after insert on public.author_audit_leads
  for each row execute function public.notify_author_audit_leads();

-- An expert's referred requests stay in that expert's workspace instead of
-- feeding HQ360's own sales pipeline (same rule as expert Scout prospects).
create or replace function public.capture_sales_lead() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'project_inquiries' then
    insert into sales_leads(source_kind,source_id,name,email,agreed_service,notes)
    values ('inquiry',new.id,new.name,new.email,array_to_string(new.help_with,', '),coalesce(new.message,'')) on conflict do nothing;
  elsif tg_table_name = 'author_audit_leads' then
    if new.expert_id is not null then
      return new;
    end if;
    insert into sales_leads(source_kind,source_id,name,email,agreed_service,notes)
    values ('visibility_check',new.id,new.author_name,new.email,'Author Visibility & Marketing',new.book_title) on conflict do nothing;
  elsif tg_table_name = 'scout_prospects' then
    if new.owner <> 'hq360' then
      return new;
    end if;
    if new.status <> 'excluded' and not new.do_not_contact then
      insert into sales_leads(source_kind,source_id,name,email,notes)
      select 'scout',new.id,a.name,coalesce(a.contact_email,''),'Review Scout evidence and contact permissions before introduction.'
      from scout_authors a where a.id = new.scout_author_id on conflict do nothing;
    else
      update sales_leads set stage = 'lost', next_follow_up = null, notes = notes || E'\nScout marked excluded / do not contact.' where source_kind='scout' and source_id=new.id;
    end if;
  end if;
  return new;
end $$;
revoke all on function public.capture_sales_lead() from public;
