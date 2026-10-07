-- Author Visibility Audit v2: depth, structure, staff review, premium reports.
-- Extends the existing author_audits / audit_findings pipeline rather than
-- replacing it. Every new entity follows the same review_status /
-- client_visible pattern already used by audit_findings, so the human-review
-- rule (nothing client-visible without explicit staff approval) is uniform.

-- ---------------------------------------------------------------- findings
-- Findings already have the right status/priority/review vocabulary; add the
-- fields the richer finding structure needs (title, category, sourcing,
-- retrieval date, and a client-safe capability reference).
ALTER TABLE public.audit_findings
  ADD COLUMN title TEXT,
  ADD COLUMN category TEXT,
  ADD COLUMN source_urls TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN retrieved_at TIMESTAMPTZ,
  ADD COLUMN capability_slug TEXT;

-- Backfill title/category for any pre-existing rows so the column can be
-- treated as present going forward (none exist in production yet, but keep
-- this safe for local/dev databases that may have test rows).
UPDATE public.audit_findings SET title = section WHERE title IS NULL;
UPDATE public.audit_findings SET category = section WHERE category IS NULL;

-- ------------------------------------------------------- service opportunities
-- Internal-only HQ360 <-> finding capability map (upgrade 22). Never exposed
-- to the client report regardless of status.
ALTER TABLE public.service_opportunities
  ADD COLUMN implementation_complexity TEXT CHECK (implementation_complexity IN ('low', 'medium', 'high')),
  ADD COLUMN dependency TEXT,
  ADD COLUMN internal_notes TEXT;

-- ------------------------------------------------------------- strengths
CREATE TABLE public.audit_strengths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  audit_id UUID NOT NULL REFERENCES public.author_audits(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  observation TEXT NOT NULL,
  evidence TEXT,
  source_urls TEXT[] NOT NULL DEFAULT '{}',
  retrieved_at TIMESTAMPTZ,
  -- what staff want done with a working thing: leave it alone, or lean on it.
  disposition TEXT CHECK (disposition IN ('preserve', 'build_upon', 'no_change_needed')),
  review_status TEXT NOT NULL DEFAULT 'ai_research' CHECK (review_status IN ('ai_research', 'needs_verification', 'approved', 'rejected')),
  client_visible BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX audit_strengths_audit_idx ON public.audit_strengths (audit_id);

-- --------------------------------------------------------- reader journey
CREATE TABLE public.audit_reader_journey (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  audit_id UUID NOT NULL REFERENCES public.author_audits(id) ON DELETE CASCADE,
  stage TEXT NOT NULL CHECK (stage IN ('discovery', 'interest', 'trust', 'book_information', 'purchase', 'follow', 'owned_audience', 'next_book')),
  status TEXT NOT NULL CHECK (status IN ('strong', 'functional', 'friction_identified', 'opportunity_identified', 'unable_to_verify')),
  observation TEXT NOT NULL,
  evidence TEXT,
  friction TEXT,
  recommendation TEXT,
  source_urls TEXT[] NOT NULL DEFAULT '{}',
  retrieved_at TIMESTAMPTZ,
  review_status TEXT NOT NULL DEFAULT 'ai_research' CHECK (review_status IN ('ai_research', 'needs_verification', 'approved', 'rejected')),
  client_visible BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (audit_id, stage)
);
CREATE INDEX audit_reader_journey_audit_idx ON public.audit_reader_journey (audit_id);

-- --------------------------------------------------------------- comparables
CREATE TABLE public.audit_comparables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  audit_id UUID NOT NULL REFERENCES public.author_audits(id) ON DELETE CASCADE,
  author TEXT NOT NULL,
  book TEXT,
  genre_relationship TEXT,
  why_comparable TEXT NOT NULL,
  website_url TEXT,
  retailer_url TEXT,
  goodreads_url TEXT,
  positioning_notes TEXT,
  reader_pathway_notes TEXT,
  newsletter_notes TEXT,
  media_notes TEXT,
  content_strategy_notes TEXT,
  strengths_notes TEXT,
  differences_notes TEXT,
  source_urls TEXT[] NOT NULL DEFAULT '{}',
  retrieved_at TIMESTAMPTZ,
  -- 'auto' is reserved for when a real search/discovery source is wired in;
  -- today every row is staff-entered, since inventing a comparable without a
  -- source would violate the no-fabrication rule.
  added_by TEXT NOT NULL DEFAULT 'staff' CHECK (added_by IN ('auto', 'staff')),
  review_status TEXT NOT NULL DEFAULT 'needs_verification' CHECK (review_status IN ('ai_research', 'needs_verification', 'approved', 'rejected')),
  client_visible BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX audit_comparables_audit_idx ON public.audit_comparables (audit_id);

-- ---------------------------------------------------------- priority moves
CREATE TABLE public.audit_priority_moves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  audit_id UUID NOT NULL REFERENCES public.author_audits(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL CHECK (rank BETWEEN 1 AND 3),
  title TEXT NOT NULL,
  what_we_found TEXT NOT NULL,
  evidence TEXT,
  what_we_would_change TEXT NOT NULL,
  why_first TEXT NOT NULL,
  enables_next TEXT,
  success_indicator TEXT,
  capability_slug TEXT,
  -- which approved findings this move was built from, for traceability.
  based_on_finding_ids UUID[] NOT NULL DEFAULT '{}',
  review_status TEXT NOT NULL DEFAULT 'ai_research' CHECK (review_status IN ('ai_research', 'needs_verification', 'approved', 'rejected')),
  client_visible BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (audit_id, rank)
);
CREATE INDEX audit_priority_moves_audit_idx ON public.audit_priority_moves (audit_id);

-- ------------------------------------------------------------ roadmap items
CREATE TABLE public.audit_roadmap_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  audit_id UUID NOT NULL REFERENCES public.author_audits(id) ON DELETE CASCADE,
  week INTEGER NOT NULL CHECK (week BETWEEN 1 AND 4),
  action TEXT NOT NULL,
  reason TEXT,
  dependency TEXT,
  priority TEXT CHECK (priority IN ('immediate', 'high_impact', 'medium_priority', 'long_term', 'optional')),
  capability_slug TEXT,
  completion_indicator TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  based_on_finding_ids UUID[] NOT NULL DEFAULT '{}',
  review_status TEXT NOT NULL DEFAULT 'ai_research' CHECK (review_status IN ('ai_research', 'needs_verification', 'approved', 'rejected')),
  client_visible BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX audit_roadmap_items_audit_idx ON public.audit_roadmap_items (audit_id, week, sort_order);

-- ------------------------------------------------------------ evidence assets
-- Manually uploaded visual evidence only -- never automated screenshots of
-- platforms that restrict scraping (Amazon, Goodreads, social).
CREATE TABLE public.audit_evidence_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  audit_id UUID NOT NULL REFERENCES public.author_audits(id) ON DELETE CASCADE,
  finding_id UUID REFERENCES public.audit_findings(id) ON DELETE SET NULL,
  storage_url TEXT NOT NULL,
  caption TEXT,
  source TEXT,
  asset_date DATE,
  client_visible BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX audit_evidence_assets_audit_idx ON public.audit_evidence_assets (audit_id);

INSERT INTO storage.buckets (id, name, public)
VALUES ('audit-evidence', 'audit-evidence', TRUE)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "audit evidence public read" ON storage.objects;
CREATE POLICY "audit evidence public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'audit-evidence');

-- ----------------------------------------------------------------- reports
-- Every PDF/image generation is recorded so a changed audit can't silently
-- invalidate a report an author may already have received.
CREATE TABLE public.audit_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  audit_id UUID NOT NULL REFERENCES public.author_audits(id) ON DELETE CASCADE,
  format TEXT NOT NULL CHECK (format IN ('pdf', 'image')),
  version INTEGER NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  generated_by TEXT,
  storage_url TEXT NOT NULL,
  approval_state TEXT NOT NULL DEFAULT 'draft' CHECK (approval_state IN ('draft', 'approved', 'sent')),
  outdated BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX audit_reports_audit_idx ON public.audit_reports (audit_id, format, version DESC);

INSERT INTO storage.buckets (id, name, public)
VALUES ('audit-reports', 'audit-reports', TRUE)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "audit reports public read" ON storage.objects;
CREATE POLICY "audit reports public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'audit-reports');

-- ------------------------------------------------------------ author_audits
ALTER TABLE public.author_audits
  ADD COLUMN prepared_by_staff_name TEXT,
  ADD COLUMN executive_assessment JSONB,
  ADD COLUMN executive_assessment_review_status TEXT NOT NULL DEFAULT 'ai_research'
    CHECK (executive_assessment_review_status IN ('ai_research', 'needs_verification', 'approved', 'rejected')),
  ADD COLUMN executive_assessment_client_visible BOOLEAN NOT NULL DEFAULT false;

-- ------------------------------------------------------------------- grants
GRANT ALL ON
  public.audit_strengths,
  public.audit_reader_journey,
  public.audit_comparables,
  public.audit_priority_moves,
  public.audit_roadmap_items,
  public.audit_evidence_assets,
  public.audit_reports
TO service_role;

ALTER TABLE public.audit_strengths ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_reader_journey ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_comparables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_priority_moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_roadmap_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_evidence_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_reports ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.audit_v2_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_strengths_updated_at
  BEFORE UPDATE ON public.audit_strengths
  FOR EACH ROW EXECUTE FUNCTION public.audit_v2_touch_updated_at();

CREATE TRIGGER audit_reader_journey_updated_at
  BEFORE UPDATE ON public.audit_reader_journey
  FOR EACH ROW EXECUTE FUNCTION public.audit_v2_touch_updated_at();

CREATE TRIGGER audit_comparables_updated_at
  BEFORE UPDATE ON public.audit_comparables
  FOR EACH ROW EXECUTE FUNCTION public.audit_v2_touch_updated_at();

CREATE TRIGGER audit_priority_moves_updated_at
  BEFORE UPDATE ON public.audit_priority_moves
  FOR EACH ROW EXECUTE FUNCTION public.audit_v2_touch_updated_at();

CREATE TRIGGER audit_roadmap_items_updated_at
  BEFORE UPDATE ON public.audit_roadmap_items
  FOR EACH ROW EXECUTE FUNCTION public.audit_v2_touch_updated_at();
