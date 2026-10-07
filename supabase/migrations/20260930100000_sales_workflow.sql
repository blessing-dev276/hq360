-- A small shared record for daily follow-ups and delivery. Existing source records remain intact.
create table public.sales_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source_kind text not null check (source_kind in ('inquiry','visibility_check','scout','manual')),
  source_id uuid,
  name text not null,
  email text not null default '',
  assigned_to text not null default '',
  stage text not null default 'needs_review' check (stage in ('needs_review','qualified','introduced','discussion','proposal','invoiced','won','lost')),
  check_completed_at date,
  last_contact date,
  next_follow_up date,
  report_url text not null default '',
  proposal_url text not null default '',
  invoice_id uuid references public.payment_invoices(id) on delete set null,
  agreed_service text not null default '',
  project_status text not null default 'not_started' check (project_status in ('not_started','scoping','in_progress','client_review','delivered','ongoing','on_hold')),
  notes text not null default '',
  unique(source_kind, source_id)
);
alter table public.sales_leads enable row level security;
create index on public.sales_leads(next_follow_up);
create index on public.sales_leads(stage);
create table public.sales_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  lead_id uuid not null references public.sales_leads(id) on delete cascade,
  event text not null,
  detail text not null default ''
);
alter table public.sales_events enable row level security;
create index on public.sales_events(lead_id, created_at);

create function public.track_sales_lead() returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into sales_events(lead_id,event,detail) values (new.id,'lead_created',new.source_kind);
    if new.stage <> 'needs_review' then
      insert into sales_events(lead_id,event,detail) values (new.id,'stage_changed',new.stage);
    end if;
  else
    if new.stage is distinct from old.stage then
      insert into sales_events(lead_id,event,detail) values (new.id,'stage_changed',new.stage);
    end if;
    if new.project_status is distinct from old.project_status then
      insert into sales_events(lead_id,event,detail) values (new.id,'project_status_changed',new.project_status);
    end if;
  end if;
  return new;
end $$;
create trigger sales_lead_events after insert or update on public.sales_leads for each row execute function public.track_sales_lead();

create function public.capture_sales_lead() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'project_inquiries' then
    insert into sales_leads(source_kind,source_id,name,email,agreed_service,notes)
    values ('inquiry',new.id,new.name,new.email,array_to_string(new.help_with,', '),coalesce(new.message,'')) on conflict do nothing;
  elsif tg_table_name = 'author_audit_leads' then
    insert into sales_leads(source_kind,source_id,name,email,agreed_service,notes)
    values ('visibility_check',new.id,new.author_name,new.email,'Author Visibility & Marketing',new.book_title) on conflict do nothing;
  elsif tg_table_name = 'scout_prospects' then
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
create trigger inquiry_sales_lead after insert on public.project_inquiries for each row execute function public.capture_sales_lead();
create trigger visibility_sales_lead after insert on public.author_audit_leads for each row execute function public.capture_sales_lead();
create trigger scout_sales_lead after insert or update on public.scout_prospects for each row execute function public.capture_sales_lead();

-- Backfill without merging unrelated books/projects merely because email addresses match.
insert into public.sales_leads(created_at,source_kind,source_id,name,email,agreed_service,notes)
select created_at,'inquiry',id,name,email,array_to_string(help_with,', '),coalesce(message,'') from public.project_inquiries on conflict do nothing;
insert into public.sales_leads(created_at,source_kind,source_id,name,email,agreed_service,notes)
select created_at,'visibility_check',id,author_name,email,'Author Visibility & Marketing',book_title from public.author_audit_leads on conflict do nothing;
insert into public.sales_leads(created_at,source_kind,source_id,name,email,notes)
select p.created_at,'scout',p.id,a.name,coalesce(a.contact_email,''),'Review Scout evidence and contact permissions before introduction.' from public.scout_prospects p join public.scout_authors a on a.id=p.scout_author_id where p.status <> 'excluded' and not p.do_not_contact on conflict do nothing;

revoke all on function public.capture_sales_lead() from public;
revoke all on function public.track_sales_lead() from public;

grant all on public.sales_leads, public.sales_events to service_role;
