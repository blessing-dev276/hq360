-- Serialize with membership insertion, which locks the same batch row.
create or replace function public.scout_discard_empty_batch(p_id uuid, p_owner text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  perform 1 from scout_batches where id = p_id and owner = p_owner for update;
  if not found then return false; end if;
  if exists(select 1 from scout_batch_books where batch_id = p_id) then return false; end if;
  -- Preserve ARC discovery evidence; this action is for review generation only.
  if exists(select 1 from scout_arc_listings where batch_id = p_id) then return false; end if;
  delete from scout_batches where id = p_id and owner = p_owner;
  return true;
end $$;
revoke all on function public.scout_discard_empty_batch(uuid,text) from public, anon, authenticated;
grant execute on function public.scout_discard_empty_batch(uuid,text) to service_role;
