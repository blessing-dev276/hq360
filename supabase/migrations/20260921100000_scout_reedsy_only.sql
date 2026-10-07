-- Keep historical records; stop all other source schedules and crawling.
UPDATE public.scout_sources
SET enabled=false,sync_schedule='manual',next_crawl_at=NULL,updated_at=now()
WHERE slug <> 'reedsy_discovery';
-- Reedsy requires source permission before automated collection can be enabled.
UPDATE public.scout_sources SET enabled=false,sync_schedule='manual',next_crawl_at=NULL,
 source_access_status='manual_only',updated_at=now() WHERE slug='reedsy_discovery';
