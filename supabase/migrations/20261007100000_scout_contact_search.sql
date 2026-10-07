-- Author email search outcome, so it runs once per author and the result
-- (all found emails, or "not found") replaces the Find email button.
alter table public.scout_authors
  add column contact_emails text[] not null default '{}',
  add column contact_search_status text
    check (contact_search_status in ('found', 'not_found')),
  add column contact_searched_at timestamptz;
