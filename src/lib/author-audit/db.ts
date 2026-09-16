/**
 * Row types for the author-audit tables. These aren't in the generated
 * Supabase types (see src/integrations/supabase/types.ts) since that file is
 * regenerated from the DB schema and this feature's tables were added by
 * hand — callers cast supabaseAdmin with `asAuditDb()` below and annotate
 * results with these types.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/** Shared by every reviewable v2 entity (strengths, reader journey stages,
 * comparables, priority moves, roadmap items) — the same vocabulary
 * audit_findings already used, so review UI/logic can be generic. */
export type ReviewStatus = "ai_research" | "needs_verification" | "approved" | "rejected";

export type Priority = "immediate" | "high_impact" | "medium_priority" | "long_term" | "optional";
export type Effort = "low" | "medium" | "high";

export type Author = {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  normalized_name: string;
  website_url: string | null;
  amazon_author_url: string | null;
  goodreads_author_url: string | null;
};

export type Book = {
  id: string;
  created_at: string;
  author_id: string;
  title: string;
  normalized_title: string;
  asin: string | null;
  isbn: string | null;
  amazon_url: string | null;
  goodreads_url: string | null;
  publisher: string | null;
  genre: string | null;
  publication_date: string | null;
};

export type AuthorAuditLead = {
  id: string;
  created_at: string;
  author_name: string;
  book_title: string;
  email: string;
  amazon_url_or_asin: string | null;
  website_url: string | null;
  goodreads_url: string | null;
  consented_at: string;
  source_path: string | null;
  status: "new" | "reviewing" | "contacted" | "archived";
};

export type AuditStatus =
  | "draft"
  | "researching"
  | "needs_verification"
  | "ready_for_review"
  | "completed"
  | "report_sent"
  | "follow_up"
  | "converted"
  | "archived";

export type ExecutiveAssessment = {
  whatIsWorking: string;
  strongestOpportunities: string;
  journeyBreaks: string;
  comparablePatterns: string;
  priorityFirst: string;
  doNotChange: string;
  unknowns: string;
};

export type AuthorAudit = {
  id: string;
  public_id: string;
  created_at: string;
  updated_at: string;
  author_id: string;
  book_id: string;
  lead_id: string | null;
  audit_type: string;
  status: AuditStatus;
  input_snapshot: Record<string, unknown>;
  research_started_at: string | null;
  research_completed_at: string | null;
  client_report_approved_at: string | null;
  conducted_at: string;
  prepared_by_staff_name: string | null;
  executive_assessment: ExecutiveAssessment | null;
  executive_assessment_review_status: ReviewStatus;
  executive_assessment_client_visible: boolean;
};

export type AuditSource = {
  id: string;
  created_at: string;
  audit_id: string;
  provider: string;
  source_type: string;
  url: string | null;
  retrieved_at: string;
  status: "retrieved" | "unavailable" | "manual_verification_required" | "failed";
  raw_data: Record<string, unknown>;
  error_message: string | null;
};

export type AuditEvidence = {
  id: string;
  created_at: string;
  audit_id: string;
  source_id: string | null;
  section: string;
  claim: string;
  excerpt: string | null;
  url: string | null;
  retrieved_at: string;
  verification_status: "verified" | "likely" | "unverified" | "conflicting";
  confidence: "high" | "medium" | "low";
  client_safe: boolean;
};

export type AuditFindingStatus =
  | "strong"
  | "healthy"
  | "opportunity_identified"
  | "needs_attention"
  | "critical_issue"
  | "unable_to_verify";

export type AuditFinding = {
  id: string;
  created_at: string;
  updated_at: string;
  audit_id: string;
  /** Legacy free-text grouping label; `category` supersedes this for display. */
  section: string;
  title: string | null;
  category: string | null;
  observation: string;
  why_it_matters: string | null;
  recommendation: string | null;
  status: AuditFindingStatus;
  priority: Priority;
  effort: Effort | null;
  potential_impact: Effort | null;
  source_urls: string[];
  retrieved_at: string | null;
  capability_slug: string | null;
  review_status: ReviewStatus;
  client_visible: boolean;
};

export type AuditManualVerification = {
  id: string;
  created_at: string;
  updated_at: string;
  audit_id: string;
  field_key: string;
  value: string | null;
  verification_status: "verified" | "unverified" | "not_applicable";
  source_url: string | null;
  staff_note: string | null;
  verified_at: string | null;
};

export type ServiceOpportunity = {
  id: string;
  created_at: string;
  audit_id: string;
  finding_id: string | null;
  capability_slug: string;
  rationale: string;
  status: "suggested" | "approved" | "dismissed";
  internal_only: boolean;
  implementation_complexity: Effort | null;
  dependency: string | null;
  internal_notes: string | null;
};

export type AuditStrength = {
  id: string;
  created_at: string;
  updated_at: string;
  audit_id: string;
  title: string;
  observation: string;
  evidence: string | null;
  source_urls: string[];
  retrieved_at: string | null;
  disposition: "preserve" | "build_upon" | "no_change_needed" | null;
  review_status: ReviewStatus;
  client_visible: boolean;
};

export type ReaderJourneyStage =
  | "discovery"
  | "interest"
  | "trust"
  | "book_information"
  | "purchase"
  | "follow"
  | "owned_audience"
  | "next_book";

export type ReaderJourneyStatus =
  "strong" | "functional" | "friction_identified" | "opportunity_identified" | "unable_to_verify";

export type AuditReaderJourneyStep = {
  id: string;
  created_at: string;
  updated_at: string;
  audit_id: string;
  stage: ReaderJourneyStage;
  status: ReaderJourneyStatus;
  observation: string;
  evidence: string | null;
  friction: string | null;
  recommendation: string | null;
  source_urls: string[];
  retrieved_at: string | null;
  review_status: ReviewStatus;
  client_visible: boolean;
};

export type AuditComparable = {
  id: string;
  created_at: string;
  updated_at: string;
  audit_id: string;
  author: string;
  book: string | null;
  genre_relationship: string | null;
  why_comparable: string;
  website_url: string | null;
  retailer_url: string | null;
  goodreads_url: string | null;
  positioning_notes: string | null;
  reader_pathway_notes: string | null;
  newsletter_notes: string | null;
  media_notes: string | null;
  content_strategy_notes: string | null;
  strengths_notes: string | null;
  differences_notes: string | null;
  source_urls: string[];
  retrieved_at: string | null;
  added_by: "auto" | "staff";
  review_status: ReviewStatus;
  client_visible: boolean;
};

export type AuditPriorityMove = {
  id: string;
  created_at: string;
  updated_at: string;
  audit_id: string;
  rank: 1 | 2 | 3;
  title: string;
  what_we_found: string;
  evidence: string | null;
  what_we_would_change: string;
  why_first: string;
  enables_next: string | null;
  success_indicator: string | null;
  capability_slug: string | null;
  based_on_finding_ids: string[];
  review_status: ReviewStatus;
  client_visible: boolean;
};

export type AuditRoadmapItem = {
  id: string;
  created_at: string;
  updated_at: string;
  audit_id: string;
  week: 1 | 2 | 3 | 4;
  action: string;
  reason: string | null;
  dependency: string | null;
  priority: Priority | null;
  capability_slug: string | null;
  completion_indicator: string | null;
  sort_order: number;
  based_on_finding_ids: string[];
  review_status: ReviewStatus;
  client_visible: boolean;
};

export type AuditEvidenceAsset = {
  id: string;
  created_at: string;
  audit_id: string;
  finding_id: string | null;
  storage_url: string;
  caption: string | null;
  source: string | null;
  asset_date: string | null;
  client_visible: boolean;
};

export type AuditReport = {
  id: string;
  created_at: string;
  audit_id: string;
  format: "pdf" | "image";
  version: number;
  generated_at: string;
  generated_by: string | null;
  storage_url: string;
  approval_state: "draft" | "approved" | "sent";
  outdated: boolean;
};

export type AuditTable =
  | "authors"
  | "books"
  | "author_audit_leads"
  | "author_audits"
  | "audit_sources"
  | "audit_evidence"
  | "audit_findings"
  | "audit_manual_verifications"
  | "audit_staff_notes"
  | "service_opportunities"
  | "audit_strengths"
  | "audit_reader_journey"
  | "audit_comparables"
  | "audit_priority_moves"
  | "audit_roadmap_items"
  | "audit_evidence_assets"
  | "audit_reports";

/**
 * `supabaseAdmin.from()` is typed against the generated Database schema,
 * which doesn't know about these tables. This narrows the escape hatch to
 * just the audit tables instead of `as any` scattered through every route.
 */
export function asAuditDb(supabaseAdmin: SupabaseClient) {
  return supabaseAdmin as unknown as {
    from: (table: AuditTable) => ReturnType<SupabaseClient["from"]>;
  };
}
