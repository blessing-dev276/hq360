-- Remember authors per workspace independently of source/book identifiers.
-- Existing history remains intact; new memberships/prospects cannot repeat it.
create table public.scout_workspace_authors (
  owner text not null,
  author_key text not null,
  batch_id uuid,
  book_id uuid,
  prospect_id uuid,
  primary key (owner, author_key)
);
alter table public.scout_workspace_authors enable row level security;
revoke all on public.scout_workspace_authors from anon, authenticated;
grant all on public.scout_workspace_authors to service_role;

insert into public.scout_workspace_authors(owner, author_key, batch_id, book_id)
select distinct on (b.owner, a.normalized_name) b.owner, a.normalized_name, b.id, bk.id
from public.scout_batch_books bb
join public.scout_batches b on b.id = bb.batch_id
join public.scout_discovered_books bk on bk.id = bb.book_id
join public.scout_authors a on a.id = bk.scout_author_id
order by b.owner, a.normalized_name, b.created_at, b.id
on conflict do nothing;
insert into public.scout_workspace_authors(owner, author_key, prospect_id)
select distinct on (p.owner, a.normalized_name) p.owner, a.normalized_name, p.id
from public.scout_prospects p join public.scout_authors a on a.id = p.scout_author_id
order by p.owner, a.normalized_name, p.created_at, p.id
on conflict(owner, author_key) do update set prospect_id = excluded.prospect_id;

create function public.scout_guard_workspace_author() returns trigger
language plpgsql set search_path = public as $$
declare workspace text; identity_key text; claimed integer;
begin
  if tg_table_name = 'scout_batch_books' then
    -- Serialize writes to a batch, including its requested author limit.
    select owner into workspace from scout_batches where id = new.batch_id for update;
    select a.normalized_name into identity_key from scout_discovered_books b
      join scout_authors a on a.id = b.scout_author_id where b.id = new.book_id;
    if exists(select 1 from scout_batch_books where batch_id = new.batch_id and book_id = new.book_id) then
      return null;
    end if;
    if (select count(*) from scout_batch_books where batch_id = new.batch_id) >=
       (select least(coalesce(requested_max,100),100) from scout_batches where id = new.batch_id) then
      return null;
    end if;
    insert into scout_workspace_authors(owner, author_key, batch_id, book_id)
      values(workspace, identity_key, new.batch_id, new.book_id) on conflict do nothing;
    get diagnostics claimed = row_count;
    if claimed = 0 then return null; end if;
  else
    select normalized_name into identity_key from scout_authors where id = new.scout_author_id;
    insert into scout_workspace_authors(owner, author_key, prospect_id)
      values(new.owner, identity_key, new.id)
      on conflict(owner, author_key) do update set prospect_id = excluded.prospect_id
      where scout_workspace_authors.prospect_id is null;
    get diagnostics claimed = row_count;
    if claimed = 0 then return null; end if;
  end if;
  return new;
end $$;
create trigger scout_unique_generated_author before insert on public.scout_batch_books
for each row execute function public.scout_guard_workspace_author();
create trigger scout_unique_scouted_author before insert on public.scout_prospects
for each row execute function public.scout_guard_workspace_author();
