/**
 * Row types for the scout (author-prospecting) tables. Like author-audit,
 * these were added by hand and aren't in the generated Supabase types —
 * callers cast supabaseAdmin with `asScoutDb()` below.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type SourceKind = "api" | "manual" | "unimplemented";

export type ScoutSource = {
  slug: string;
  name: string;
  kind: SourceKind;
  enabled: boolean;
  access_method: string;
  terms_notes: string | null;
  collection_limit_per_day: number | null;
  sync_schedule: string | null;
  last_synced_at: string | null;
  last_error: string | null;
  error_count: number;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type PublishingType = "traditional" | "independent" | "hybrid" | "unknown";
export type FieldVerificationStatus = "verified" | "unverified" | "conflicting";

export type ScoutAuthor = {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  normalized_name: string;
  country: string | null;
  publishing_type: PublishingType | null;
  website_url: string | null;
  website_verification_status: FieldVerificationStatus;
  contact_email: string | null;
  contact_form_url: string | null;
  contact_verification_status: FieldVerificationStatus;
  bio: string | null;
  bio_source_url: string | null;
  linked_author_id: string | null;
};

export type BookFormat = "ebook" | "paperback" | "hardcover" | "audiobook" | "unknown";

export type ScoutBook = {
  id: string;
  created_at: string;
  updated_at: string;
  scout_author_id: string;
  title: string;
  normalized_title: string;
  genre: string | null;
  /** Full date; null when the source only supplied a year (see
   * publication_year) or nothing at all. */
  publication_date: string | null;
  /** Set when a source only exposes a publish year (e.g. Open Library) --
   * kept separate rather than fabricating a month/day for the date column. */
  publication_year: number | null;
  book_format: BookFormat | null;
  publisher: string | null;
  series_name: string | null;
  series_position: number | null;
  isbn: string | null;
  asin: string | null;
  source_slug: string;
  source_url: string | null;
  external_id: string | null;
  raw_data: Record<string, unknown>;
  discovered_at: string;
  batch_id: string | null;
  description: string | null;
  ingest_method: "automated" | "manual";
};

export type ReviewPlatform =
  "google_books" | "open_library" | "goodreads" | "amazon" | "reedsy" | "bookbub" | "other";

export type ScoutReviewCount = {
  id: string;
  book_id: string;
  platform: ReviewPlatform;
  review_count: number | null;
  rating: number | null;
  verified: boolean;
  source_url: string | null;
  retrieved_at: string;
};

export type ScoutBatch = {
  id: string;
  created_at: string;
  label: string;
  genre: string | null;
  query: string | null;
  sources: string[];
  requested_max: number | null;
  total_available: number | null;
  item_count: number;
};

export type ScoutSavedSearch = {
  id: string;
  created_at: string;
  name: string;
  filters: Record<string, unknown>;
  created_by: string | null;
};

export type ScoutResearchJobStatus = "queued" | "running" | "completed" | "failed";

export type ScoutResearchJob = {
  id: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  kind: "discover" | "author_research";
  status: ScoutResearchJobStatus;
  progress: number;
  total: number;
  input: Record<string, unknown>;
  result_summary: Record<string, unknown>;
  error_message: string | null;
};

export type ProspectStatus =
  "new" | "research_needed" | "qualified" | "contacted" | "replied" | "interested" | "excluded";

export type ScoutProspect = {
  id: string;
  created_at: string;
  updated_at: string;
  scout_author_id: string;
  book_id: string | null;
  status: ProspectStatus;
  excluded_reason: string | null;
  research_notes: string | null;
  do_not_contact: boolean;
  last_verified_at: string | null;
  audit_id: string | null;
};

export type ScoutOutreachDraft = {
  id: string;
  created_at: string;
  prospect_id: string;
  subject: string;
  body: string;
  status: "draft" | "reviewed" | "sent";
  generated_from: Record<string, unknown>;
};

export type ScoutResearchNote = {
  id: string;
  created_at: string;
  scout_author_id: string;
  note: string;
  source_url: string | null;
  verification_status: FieldVerificationStatus;
  retrieved_at: string;
  added_by: string | null;
};

export type ScoutTable =
  | "scout_sources"
  | "scout_authors"
  | "scout_discovered_books"
  | "scout_review_counts"
  | "scout_saved_searches"
  | "scout_research_jobs"
  | "scout_prospects"
  | "scout_outreach_drafts"
  | "scout_research_notes"
  | "scout_batches";

export function asScoutDb(supabaseAdmin: SupabaseClient) {
  return supabaseAdmin as unknown as {
    from: (table: ScoutTable) => ReturnType<SupabaseClient["from"]>;
  };
}

export function normalizedName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}
