-- A "batch" is one discovery run's result set (a genre browse or search),
-- so staff can come back to exactly what a run produced and export it
-- directly, instead of only being able to work from the cumulative pool of
-- everything ever discovered.
CREATE TABLE public.scout_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  label text NOT NULL,
  genre text,
  query text,
  sources text[] NOT NULL DEFAULT '{}',
  requested_max integer,
  -- Best-known count of how many works/authors the source(s) list for this
  -- genre/query in total, independent of how many we actually pulled in.
  -- Null when a source didn't report one.
  total_available integer,
  item_count integer NOT NULL DEFAULT 0
);

-- A book belongs to the batch it was first discovered in (an author/book
-- already known from an earlier run is skipped entirely by the discovery
-- route, so this column is set once and never contested between batches).
ALTER TABLE public.scout_discovered_books
  ADD COLUMN batch_id uuid REFERENCES public.scout_batches(id) ON DELETE SET NULL;
CREATE INDEX ON public.scout_discovered_books (batch_id);

ALTER TABLE public.scout_batches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.scout_batches FROM anon, authenticated;
GRANT ALL ON public.scout_batches TO service_role;
