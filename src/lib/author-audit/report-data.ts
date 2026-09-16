import type { SupabaseClient } from "@supabase/supabase-js";
import {
  asAuditDb,
  type Author,
  type AuditComparable,
  type AuditEvidence,
  type AuditEvidenceAsset,
  type AuditFinding,
  type AuditManualVerification,
  type AuditPriorityMove,
  type AuditReaderJourneyStep,
  type AuditRoadmapItem,
  type AuditSource,
  type AuditStrength,
  type Book,
  type ExecutiveAssessment,
} from "./db";
import { VERIFICATION_FIELDS } from "./verification-fields";

const FIELD_LABEL = new Map(VERIFICATION_FIELDS.map((f) => [f.key, f.label]));

export type SourceReviewed = {
  name: string;
  url: string | null;
  type: string;
  retrievedAt: string | null;
  verificationStatus: string;
};

/**
 * Everything a report (PDF or image) needs, assembled ONCE from the
 * database and handed to both renderers unchanged — neither renderer calls
 * Claude or invents content. Only client_visible + approved rows are
 * included; this is the one place that filter is applied, so both formats
 * are guaranteed to show the same, staff-approved material.
 */
export type ReportData = {
  author: Author;
  book: Book;
  preparedByStaffName: string | null;
  preparedDate: string;
  executiveAssessment: ExecutiveAssessment | null;
  strengths: AuditStrength[];
  findings: AuditFinding[];
  readerJourney: AuditReaderJourneyStep[];
  comparables: AuditComparable[];
  moves: AuditPriorityMove[];
  roadmap: AuditRoadmapItem[];
  evidenceAssets: AuditEvidenceAsset[];
  sourcesReviewed: SourceReviewed[];
};

export async function buildReportData(
  supabaseAdmin: SupabaseClient,
  auditId: string,
): Promise<ReportData | { error: string }> {
  const db = asAuditDb(supabaseAdmin);

  const { data: audit } = await db
    .from("author_audits")
    .select("*, authors(*), books(*)")
    .eq("id", auditId)
    .single();
  if (!audit) return { error: "not_found" };
  const record = audit as unknown as {
    authors: Author;
    books: Book;
    prepared_by_staff_name: string | null;
    executive_assessment: ExecutiveAssessment | null;
    executive_assessment_client_visible: boolean;
  };

  const [
    findingsRes,
    strengthsRes,
    journeyRes,
    comparablesRes,
    movesRes,
    roadmapRes,
    assetsRes,
    sourcesRes,
    evidenceRes,
    verificationsRes,
  ] = await Promise.all([
    db.from("audit_findings").select("*").eq("audit_id", auditId).eq("client_visible", true),
    db.from("audit_strengths").select("*").eq("audit_id", auditId).eq("client_visible", true),
    db.from("audit_reader_journey").select("*").eq("audit_id", auditId).eq("client_visible", true),
    db.from("audit_comparables").select("*").eq("audit_id", auditId).eq("client_visible", true),
    db
      .from("audit_priority_moves")
      .select("*")
      .eq("audit_id", auditId)
      .eq("client_visible", true)
      .order("rank", { ascending: true }),
    db
      .from("audit_roadmap_items")
      .select("*")
      .eq("audit_id", auditId)
      .eq("client_visible", true)
      .order("week", { ascending: true })
      .order("sort_order", { ascending: true }),
    db.from("audit_evidence_assets").select("*").eq("audit_id", auditId).eq("client_visible", true),
    db.from("audit_sources").select("*").eq("audit_id", auditId),
    db.from("audit_evidence").select("*").eq("audit_id", auditId).eq("client_safe", true),
    db
      .from("audit_manual_verifications")
      .select("*")
      .eq("audit_id", auditId)
      .eq("verification_status", "verified"),
  ]);

  const findings = (findingsRes.data ?? []) as AuditFinding[];

  if (findings.length === 0) return { error: "no_approved_findings" };

  const sources = (sourcesRes.data ?? []) as AuditSource[];
  const evidence = (evidenceRes.data ?? []) as AuditEvidence[];
  const verifications = (verificationsRes.data ?? []) as AuditManualVerification[];

  const sourcesReviewed: SourceReviewed[] = [
    ...sources
      .filter((s) => s.status === "retrieved")
      .map((s) => ({
        name: `${s.provider.replace(/_/g, " ")} — ${s.source_type.replace(/_/g, " ")}`,
        url: s.url,
        type: "Automated lookup",
        retrievedAt: s.retrieved_at,
        verificationStatus: "verified",
      })),
    ...evidence
      .filter((e) => e.url)
      .map((e) => ({
        name: e.claim.slice(0, 80),
        url: e.url,
        type: e.section,
        retrievedAt: e.retrieved_at,
        verificationStatus: e.verification_status,
      })),
    ...verifications.map((v) => ({
      name: FIELD_LABEL.get(v.field_key) ?? v.field_key,
      url: v.source_url,
      type: "Staff-verified",
      retrievedAt: v.verified_at,
      verificationStatus: "verified",
    })),
  ];

  return {
    author: record.authors,
    book: record.books,
    preparedByStaffName: record.prepared_by_staff_name,
    preparedDate: new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    executiveAssessment: record.executive_assessment_client_visible
      ? record.executive_assessment
      : null,
    strengths: (strengthsRes.data ?? []) as AuditStrength[],
    findings,
    readerJourney: (journeyRes.data ?? []) as AuditReaderJourneyStep[],
    comparables: (comparablesRes.data ?? []) as AuditComparable[],
    moves: (movesRes.data ?? []) as AuditPriorityMove[],
    roadmap: (roadmapRes.data ?? []) as AuditRoadmapItem[],
    evidenceAssets: (assetsRes.data ?? []) as AuditEvidenceAsset[],
    sourcesReviewed,
  };
}
