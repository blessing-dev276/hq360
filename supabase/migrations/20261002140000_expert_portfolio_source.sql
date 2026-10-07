-- Items an admin assigns from the site portfolio stay linked to the
-- original, so later edits there (e.g. adding a description) show up on
-- the expert's profile instead of a frozen copy.
alter table public.expert_portfolio_items
  add column source_portfolio_item_id uuid references public.portfolio_items(id) on delete set null;

-- Link items that were assigned before this column existed.
update public.expert_portfolio_items e
set source_portfolio_item_id = p.id
from public.portfolio_items p
where e.source_portfolio_item_id is null
  and e.reviewed_by is not null
  and trim(e.title) = trim(p.title);
