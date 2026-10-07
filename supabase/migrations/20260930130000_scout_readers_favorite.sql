-- Human-initiated public catalog lookups; staff selects which metadata to retain.
INSERT INTO public.scout_sources(slug,name,kind,enabled,access_method,source_access_status,sync_schedule,terms_notes)
VALUES ('readers_favorite','Readers'' Favorite','manual',true,'Public genre catalog lookup; staff-reviewed import','limited','manual','Public listing metadata only. Runtime robots check; bounded pages; no contact messages or assumed indie/debut status.')
ON CONFLICT(slug) DO NOTHING;
ALTER TABLE public.scout_review_counts DROP CONSTRAINT IF EXISTS scout_review_counts_platform_check;
ALTER TABLE public.scout_review_counts ADD CONSTRAINT scout_review_counts_platform_check CHECK(platform IN ('google_books','open_library','goodreads','amazon','reedsy','bookbub','other','readers_favorite'));
