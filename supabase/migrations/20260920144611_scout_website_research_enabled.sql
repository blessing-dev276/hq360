-- The "author_websites" source is now backed by a real (if manual,
-- staff-triggered) capability: fetching one already-known author's own
-- public page for bio/contact signals (see
-- src/lib/scout/adapters/website-research.ts). Reflect that in the
-- registry -- still not a crawler, still one URL at a time.
UPDATE public.scout_sources
SET
  enabled = true,
  terms_notes = 'Single-URL, staff-triggered fetch of one already-identified author''s own site -- not automated crawling of a directory. Respects the same permitted-URL guard as the author-audit tool.'
WHERE slug = 'author_websites';
