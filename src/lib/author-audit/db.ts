/**
 * Row types for the author-audit tables. These aren't in the generated
 * Supabase types (see src/integrations/supabase/types.ts) since that file is
 * regenerated from the DB schema and this feature's tables were added by
 * hand — callers cast supabaseAdmin with `asAuditDb()` below and annotate
 * results with these types.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

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
  section: string;
  observation: string;
  why_it_matters: string | null;
  recommendation: string | null;
  status: AuditFindingStatus;
  priority: "immediate" | "high_impact" | "medium_priority" | "long_term" | "optional";
  effort: "low" | "medium" | "high" | null;
  potential_impact: "low" | "medium" | "high" | null;
  review_status: "ai_research" | "needs_verification" | "approved" | "rejected";
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
  | "service_opportunities";

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
