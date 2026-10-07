-- Reedsy Discovery has no accessible public API and its listing pages are
-- a client-rendered SPA with no data in server HTML -- real automated
-- collection would require reverse-engineering an undocumented internal
-- API or headless-browser JS execution against a site already showing
-- active bot-protection (sitemap.xml returns 403). That's not "reading a
-- public page"; it's exactly the kind of restriction-bypass this project
-- doesn't do. So Reedsy (and other sources without safe automated access)
-- get a manual, staff-supplied, single-URL-at-a-time ingestion path
-- instead -- staff paste the specific book/author page they're looking at
-- and enter what's on screen; nothing is crawled or auto-extracted.
UPDATE public.scout_sources
SET
  kind = 'manual',
  enabled = true,
  access_method = 'Staff-supplied individual page + manually entered fields',
  terms_notes = 'No accessible public API or ToS found; robots.txt only disallows /loves/ but the discovery listing is a client-rendered SPA with no data in server HTML, and /sitemap.xml returns 403 (active bot-protection). Automated collection isn''t implemented -- staff add specific books/authors by hand via the Manual ingest tab, one already-identified page at a time.'
WHERE slug = 'reedsy_discovery';

-- Same manual, staff-driven path now covers any source without a safe API.
UPDATE public.scout_sources
SET enabled = true
WHERE slug = 'independent_publishers';

-- A short description isn't collected by the Google Books/Open Library
-- adapters (kept out of the automated pipeline to avoid an unused, ever
-- growing column) but manual ingestion from a source page is exactly where
-- staff have one on screen to copy, so give it a home.
ALTER TABLE public.scout_discovered_books
  ADD COLUMN description text;

-- Marks which discovered_books rows came from staff-entered manual
-- ingestion rather than an automated adapter, for the source-admin error
-- log / audit trail and for the UI to label them honestly.
ALTER TABLE public.scout_discovered_books
  ADD COLUMN ingest_method text NOT NULL DEFAULT 'automated'
  CHECK (ingest_method IN ('automated', 'manual'));
