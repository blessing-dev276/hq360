-- Author-prospecting platform ("Scout"): discovery of books/authors from
-- public catalog APIs, per-platform review counts (never conflated), and a
-- prospect pipeline that hands qualified authors off to the existing
-- author-audit and (future) outreach systems rather than duplicating them.
--
-- Same access model as the author-audit tables: RLS enabled, no anon/
-- authenticated grants at all -- every read/write goes through the app's
-- single admin gate (isAdminRequest) via the service-role client.

CREATE TABLE public.scout_sources (
  slug text PRIMARY KEY,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('api', 'manual', 'unimplemented')),
  enabled boolean NOT NULL DEFAULT false,
  access_method text NOT NULL DEFAULT 'unknown',
  terms_notes text,
  collection_limit_per_day integer,
  sync_schedule text,
  last_synced_at timestamptz,
  last_error text,
  error_count integer NOT NULL DEFAULT 0,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.scout_authors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL,
  normalized_name text NOT NULL,
  country text,
  publishing_type text CHECK (publishing_type IN ('traditional', 'independent', 'hybrid', 'unknown')),
  website_url text,
  website_verification_status text NOT NULL DEFAULT 'unverified'
    CHECK (website_verification_status IN ('verified', 'unverified', 'conflicting')),
  contact_email text,
  contact_form_url text,
  contact_verification_status text NOT NULL DEFAULT 'unverified'
    CHECK (contact_verification_status IN ('verified', 'unverified', 'conflicting')),
  bio text,
  bio_source_url text,
  -- Link out to the shared author-audit author record once/if one exists,
  -- instead of forking a second "author" identity for the same person.
  linked_author_id uuid REFERENCES public.authors(id) ON DELETE SET NULL,
  UNIQUE (normalized_name)
);
CREATE INDEX ON public.scout_authors (linked_author_id);

CREATE TABLE public.scout_discovered_books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  scout_author_id uuid NOT NULL REFERENCES public.scout_authors(id) ON DELETE CASCADE,
  title text NOT NULL,
  normalized_title text NOT NULL,
  genre text,
  publication_date date,
  book_format text CHECK (book_format IN ('ebook', 'paperback', 'hardcover', 'audiobook', 'unknown')),
  publisher text,
  series_name text,
  series_position integer,
  isbn text,
  asin text,
  source_slug text NOT NULL REFERENCES public.scout_sources(slug),
  source_url text,
  external_id text,
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scout_author_id, normalized_title)
);
CREATE INDEX ON public.scout_discovered_books (scout_author_id);
CREATE INDEX ON public.scout_discovered_books (source_slug);
CREATE INDEX ON public.scout_discovered_books (genre);
CREATE INDEX ON public.scout_discovered_books (publication_date);

-- Review counts are stored one row per (book, platform) so a Google Books
-- rating can never stand in for an Amazon review count. review_count is
-- nullable: null means "not verified", never "zero".
CREATE TABLE public.scout_review_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES public.scout_discovered_books(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (
    platform IN ('google_books', 'open_library', 'goodreads', 'amazon', 'reedsy', 'bookbub', 'other')
  ),
  review_count integer,
  rating numeric(3, 2),
  verified boolean NOT NULL DEFAULT false,
  source_url text,
  retrieved_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (book_id, platform)
);
CREATE INDEX ON public.scout_review_counts (platform, review_count);

CREATE TABLE public.scout_saved_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text
);

CREATE TABLE public.scout_research_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  kind text NOT NULL CHECK (kind IN ('discover', 'author_research')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  progress integer NOT NULL DEFAULT 0,
  total integer NOT NULL DEFAULT 0,
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text
);

CREATE TABLE public.scout_prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  scout_author_id uuid NOT NULL REFERENCES public.scout_authors(id) ON DELETE CASCADE,
  book_id uuid REFERENCES public.scout_discovered_books(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'new' CHECK (
    status IN ('new', 'research_needed', 'qualified', 'contacted', 'replied', 'interested', 'excluded')
  ),
  excluded_reason text,
  research_notes text,
  -- Set once contacted/excluded; used to block accidental re-adds into a
  -- new outreach campaign rather than inferring it from status alone.
  do_not_contact boolean NOT NULL DEFAULT false,
  last_verified_at timestamptz,
  audit_id uuid REFERENCES public.author_audits(id) ON DELETE SET NULL,
  UNIQUE (scout_author_id, book_id)
);
CREATE INDEX ON public.scout_prospects (status);
CREATE INDEX ON public.scout_prospects (scout_author_id);

CREATE TABLE public.scout_outreach_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  prospect_id uuid NOT NULL REFERENCES public.scout_prospects(id) ON DELETE CASCADE,
  subject text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'reviewed', 'sent')),
  generated_from jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX ON public.scout_outreach_drafts (prospect_id);

CREATE TABLE public.scout_research_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  scout_author_id uuid NOT NULL REFERENCES public.scout_authors(id) ON DELETE CASCADE,
  note text NOT NULL,
  source_url text,
  verification_status text NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('verified', 'unverified', 'conflicting')),
  retrieved_at timestamptz NOT NULL DEFAULT now(),
  added_by text
);
CREATE INDEX ON public.scout_research_notes (scout_author_id);

ALTER TABLE public.scout_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scout_authors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scout_discovered_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scout_review_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scout_saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scout_research_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scout_prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scout_outreach_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scout_research_notes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.scout_sources FROM anon, authenticated;
REVOKE ALL ON public.scout_authors FROM anon, authenticated;
REVOKE ALL ON public.scout_discovered_books FROM anon, authenticated;
REVOKE ALL ON public.scout_review_counts FROM anon, authenticated;
REVOKE ALL ON public.scout_saved_searches FROM anon, authenticated;
REVOKE ALL ON public.scout_research_jobs FROM anon, authenticated;
REVOKE ALL ON public.scout_prospects FROM anon, authenticated;
REVOKE ALL ON public.scout_outreach_drafts FROM anon, authenticated;
REVOKE ALL ON public.scout_research_notes FROM anon, authenticated;

GRANT ALL ON public.scout_sources TO service_role;
GRANT ALL ON public.scout_authors TO service_role;
GRANT ALL ON public.scout_discovered_books TO service_role;
GRANT ALL ON public.scout_review_counts TO service_role;
GRANT ALL ON public.scout_saved_searches TO service_role;
GRANT ALL ON public.scout_research_jobs TO service_role;
GRANT ALL ON public.scout_prospects TO service_role;
GRANT ALL ON public.scout_outreach_drafts TO service_role;
GRANT ALL ON public.scout_research_notes TO service_role;

-- Seed the source registry. Only Google Books and Open Library are
-- implemented API adapters; the rest are listed per the source-management
-- requirement but stay disabled/unimplemented until an authorized access
-- method (official API, licensed feed, or manual entry) is wired up.
INSERT INTO public.scout_sources (slug, name, kind, enabled, access_method, terms_notes) VALUES
  ('google_books', 'Google Books', 'api', true, 'Google Books API (public, key optional)', 'Subject to Google Books API terms of service and quota.'),
  ('open_library', 'Open Library', 'api', true, 'Open Library Search API (public, no key)', 'Subject to Open Library API usage policy and rate limits.'),
  ('reedsy_discovery', 'Reedsy Discovery', 'unimplemented', false, 'No public API', 'No authorized programmatic access identified; manual research only.'),
  ('goodreads', 'Goodreads', 'unimplemented', false, 'API deprecated by Amazon', 'Goodreads closed its public API to new keys; manual research only.'),
  ('amazon_books', 'Amazon Books', 'unimplemented', false, 'No public catalog API for this use case', 'Amazon Product Advertising API requires an active affiliate/seller relationship and does not license this use case; manual/ASIN-based review only.'),
  ('bookbub', 'BookBub', 'unimplemented', false, 'No public API', 'No authorized programmatic access identified; manual research only.'),
  ('independent_publishers', 'Independent publishers', 'manual', false, 'Manual entry', 'Varies per publisher; add per-publisher access notes when onboarded.'),
  ('author_websites', 'Author websites', 'manual', false, 'Manual entry / site''s own contact form', 'Respect each site''s robots directives; no automated crawling.')
ON CONFLICT (slug) DO NOTHING;
