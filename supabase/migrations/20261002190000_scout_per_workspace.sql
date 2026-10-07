-- Partition Scouting per workspace so experts never see each other's leads.
--
-- `owner` is 'hq360' for the admin team or the expert's profile id (as text).
-- The shared author/book catalogue is unchanged; ownership lives on the
-- things a person creates: search batches, audience batches, saved
-- prospects and audience shortlists. Existing rows belong to the team.

alter table public.scout_batches add column owner text not null default 'hq360';
alter table public.scout_audience_batches add column owner text not null default 'hq360';
alter table public.scout_prospects add column owner text not null default 'hq360';

create index scout_batches_owner_idx on public.scout_batches (owner, created_at desc);
create index scout_audience_batches_owner_idx
  on public.scout_audience_batches (owner, audience, created_at desc);
create index scout_prospects_owner_idx on public.scout_prospects (owner, created_at desc);

-- Two workspaces may each save the same author/book as their own prospect.
alter table public.scout_prospects
  drop constraint if exists scout_prospects_scout_author_id_book_id_key;
create unique index scout_prospects_owner_author_book_key
  on public.scout_prospects (owner, scout_author_id, coalesce(book_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Shortlists were a global flag on the shared lead; make them per workspace.
create table public.scout_audience_shortlist (
  owner text not null,
  lead_id uuid not null references public.scout_audience_leads(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner, lead_id)
);
alter table public.scout_audience_shortlist enable row level security;
revoke all on public.scout_audience_shortlist from anon, authenticated;
grant all on public.scout_audience_shortlist to service_role;
insert into public.scout_audience_shortlist (owner, lead_id)
  select 'hq360', id from public.scout_audience_leads where shortlisted
  on conflict do nothing;

-- Only the team's own Scout prospects feed HQ360's sales pipeline; an
-- expert's prospects stay in that expert's workspace.
create or replace function public.capture_sales_lead() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'project_inquiries' then
    insert into sales_leads(source_kind,source_id,name,email,agreed_service,notes)
    values ('inquiry',new.id,new.name,new.email,array_to_string(new.help_with,', '),coalesce(new.message,'')) on conflict do nothing;
  elsif tg_table_name = 'author_audit_leads' then
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
