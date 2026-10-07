-- Evidence-led author visibility audits. All records are private and are only
-- accessed by server-side HQ360 staff workflows.

CREATE TABLE public.authors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  website_url TEXT,
  amazon_author_url TEXT,
  goodreads_author_url TEXT,
  UNIQUE (normalized_name)
);

CREATE TABLE public.books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  author_id UUID NOT NULL REFERENCES public.authors(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  normalized_title TEXT NOT NULL,
  asin TEXT,
  isbn TEXT,
  amazon_url TEXT,
  goodreads_url TEXT,
  publisher TEXT,
  genre TEXT,
  publication_date DATE,
  UNIQUE (author_id, normalized_title)
);

CREATE TABLE public.author_audit_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  author_name TEXT NOT NULL,
  book_title TEXT NOT NULL,
  email TEXT NOT NULL,
  amazon_url_or_asin TEXT,
  website_url TEXT,
  goodreads_url TEXT,
  consented_at TIMESTAMPTZ NOT NULL,
  source_path TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'contacted', 'archived'))
);

CREATE TABLE public.author_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  author_id UUID NOT NULL REFERENCES public.authors(id) ON DELETE RESTRICT,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE RESTRICT,
  lead_id UUID REFERENCES public.author_audit_leads(id) ON DELETE SET NULL,
  audit_type TEXT NOT NULL DEFAULT 'author_visibility',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'researching', 'needs_verification', 'ready_for_review', 'completed', 'report_sent', 'follow_up', 'converted', 'archived')),
  input_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  research_started_at TIMESTAMPTZ,
  research_completed_at TIMESTAMPTZ,
  client_report_approved_at TIMESTAMPTZ,
  conducted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.audit_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  audit_id UUID NOT NULL REFERENCES public.author_audits(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  source_type TEXT NOT NULL,
  url TEXT,
  retrieved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'retrieved' CHECK (status IN ('retrieved', 'unavailable', 'manual_verification_required', 'failed')),
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT
);

CREATE TABLE public.audit_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  audit_id UUID NOT NULL REFERENCES public.author_audits(id) ON DELETE CASCADE,
  source_id UUID REFERENCES public.audit_sources(id) ON DELETE SET NULL,
  section TEXT NOT NULL,
  claim TEXT NOT NULL,
  excerpt TEXT,
  url TEXT,
  retrieved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verification_status TEXT NOT NULL CHECK (verification_status IN ('verified', 'likely', 'unverified', 'conflicting')),
  confidence TEXT NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
  client_safe BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE public.audit_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  audit_id UUID NOT NULL REFERENCES public.author_audits(id) ON DELETE CASCADE,
  section TEXT NOT NULL,
  observation TEXT NOT NULL,
  why_it_matters TEXT,
  recommendation TEXT,
  status TEXT NOT NULL CHECK (status IN ('strong', 'healthy', 'opportunity_identified', 'needs_attention', 'critical_issue', 'unable_to_verify')),
  priority TEXT NOT NULL CHECK (priority IN ('immediate', 'high_impact', 'medium_priority', 'long_term', 'optional')),
  effort TEXT CHECK (effort IN ('low', 'medium', 'high')),
  potential_impact TEXT CHECK (potential_impact IN ('low', 'medium', 'high')),
  review_status TEXT NOT NULL DEFAULT 'needs_verification' CHECK (review_status IN ('ai_research', 'needs_verification', 'approved', 'rejected')),
  client_visible BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE public.audit_manual_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  audit_id UUID NOT NULL REFERENCES public.author_audits(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  value TEXT,
  verification_status TEXT NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('verified', 'unverified', 'not_applicable')),
  source_url TEXT,
  staff_note TEXT,
  verified_at TIMESTAMPTZ,
  UNIQUE (audit_id, field_key)
);

CREATE TABLE public.audit_staff_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  audit_id UUID NOT NULL REFERENCES public.author_audits(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_by TEXT
);

CREATE TABLE public.service_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  audit_id UUID NOT NULL REFERENCES public.author_audits(id) ON DELETE CASCADE,
  finding_id UUID REFERENCES public.audit_findings(id) ON DELETE SET NULL,
  capability_slug TEXT NOT NULL,
  rationale TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested', 'approved', 'dismissed')),
  internal_only BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX author_audits_status_created_idx ON public.author_audits(status, created_at DESC);
CREATE INDEX audit_sources_audit_idx ON public.audit_sources(audit_id);
CREATE INDEX audit_evidence_audit_idx ON public.audit_evidence(audit_id);
CREATE INDEX audit_findings_audit_idx ON public.audit_findings(audit_id);
CREATE INDEX author_audit_leads_created_idx ON public.author_audit_leads(created_at DESC);

GRANT ALL ON public.authors, public.books, public.author_audit_leads, public.author_audits, public.audit_sources, public.audit_evidence, public.audit_findings, public.audit_manual_verifications, public.audit_staff_notes, public.service_opportunities TO service_role;

ALTER TABLE public.authors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.author_audit_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.author_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_manual_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_staff_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_opportunities ENABLE ROW LEVEL SECURITY;
