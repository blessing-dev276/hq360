-- Admin (hq360 workspace) batches may hold up to 1000 authors; experts stay at 100.
create or replace function public.scout_guard_workspace_author() returns trigger
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
       (select least(coalesce(requested_max,100), case when workspace = 'hq360' then 1000 else 100 end)
        from scout_batches where id = new.batch_id) then
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
