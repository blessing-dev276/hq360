-- Scout now uses staff-reviewed Google discovery and individual Amazon imports.
-- Google results and Amazon product pages are not crawled by HQ360.
UPDATE public.scout_sources
SET
  enabled = false,
  sync_schedule = 'manual',
  next_crawl_at = NULL,
  updated_at = now()
WHERE slug <> 'amazon_books';

UPDATE public.scout_sources
SET
  kind = 'manual',
  enabled = true,
  source_access_status = 'manual_only',
  access_method = 'Google search opened by staff; individual Amazon product reviewed and imported manually',
  terms_notes = 'HQ360 does not scrape Google result pages or Amazon product pages. Staff select a result, verify the author and 1–49 Amazon rating count, and import that individual listing.',
  sync_schedule = 'manual',
  next_crawl_at = NULL,
  updated_at = now()
WHERE slug = 'amazon_books';
