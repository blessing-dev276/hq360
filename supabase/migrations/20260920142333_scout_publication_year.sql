-- Several discovery sources (Open Library in particular) only expose a
-- publish year, not a full date -- writing that into the `date` typed
-- publication_date column threw (e.g. "1508" is not a valid date). Add a
-- companion year column and let publication_date stay null when only a
-- year is known, rather than fabricating a month/day.
ALTER TABLE public.scout_discovered_books
  ADD COLUMN publication_year integer;
