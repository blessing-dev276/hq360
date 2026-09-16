import type { SupabaseClient } from "@supabase/supabase-js";
import {
  asAuditDb,
  type AuditFinding,
  type AuditPriorityMove,
  type AuditRoadmapItem,
  type AuditStrength,
} from "./db";

export type QualityIssue = { area: string; message: string };
export type QualityCheckResult = {
  passed: boolean;
  issues: QualityIssue[];
  warnings: QualityIssue[];
};

const NEGATIVE_STATUSES: AuditFinding["status"][] = ["needs_attention", "critical_issue"];
const ACTIONABLE_STATUSES: AuditFinding["status"][] = [
  "opportunity_identified",
  "needs_attention",
  "critical_issue",
];

/** Everything upgrade 19 asks for, run before a report is allowed to
 * generate. Distinguishes hard blockers (issues) from things worth a
 * second look but not disqualifying (warnings). */
export async function runQualityCheck(
  supabaseAdmin: SupabaseClient,
  auditId: string,
): Promise<QualityCheckResult> {
  const db = asAuditDb(supabaseAdmin);
  const issues: QualityIssue[] = [];
  const warnings: QualityIssue[] = [];

  const [findingsRes, strengthsRes, journeyRes, comparablesRes, movesRes, roadmapRes] =
    await Promise.all([
      db.from("audit_findings").select("*").eq("audit_id", auditId),
      db.from("audit_strengths").select("*").eq("audit_id", auditId),
      db.from("audit_reader_journey").select("*").eq("audit_id", auditId),
      db.from("audit_comparables").select("*").eq("audit_id", auditId),
      db.from("audit_priority_moves").select("*").eq("audit_id", auditId),
      db.from("audit_roadmap_items").select("*").eq("audit_id", auditId),
    ]);

  const findings = (findingsRes.data ?? []) as AuditFinding[];
  const strengths = (strengthsRes.data ?? []) as AuditStrength[];
  const moves = (movesRes.data ?? []) as AuditPriorityMove[];
  const roadmap = (roadmapRes.data ?? []) as AuditRoadmapItem[];

  const clientFindings = findings.filter((f) => f.client_visible);
  const clientStrengths = strengths.filter((s) => s.client_visible);

  // 1 & 4 — every client-visible negative/actionable finding needs sourcing
  // and a retrieval date, not just an assertion.
  for (const f of clientFindings) {
    if (NEGATIVE_STATUSES.includes(f.status) && f.source_urls.length === 0) {
      issues.push({
        area: "Findings",
        message: `"${f.title ?? f.category ?? f.section}" is marked ${f.status} and client-visible but has no source URL.`,
      });
    }
    if (!f.retrieved_at) {
      warnings.push({
        area: "Findings",
        message: `"${f.title ?? f.category ?? f.section}" has no retrieval date recorded.`,
      });
    }
    if (ACTIONABLE_STATUSES.includes(f.status) && !f.recommendation) {
      issues.push({
        area: "Findings",
        message: `"${f.title ?? f.category ?? f.section}" needs a recommendation before it can reach the client — it's actionable but doesn't say what to do.`,
      });
    }
  }

  // 6 — at least one real, approved strength.
  if (clientStrengths.length === 0) {
    warnings.push({
      area: "Strengths",
      message:
        "No strengths are approved for the client yet — an audit that finds nothing working reads as incomplete, not thorough.",
    });
  }

  // 3 — some sourcing exists at all.
  if (findings.length === 0) {
    issues.push({
      area: "Research",
      message: "No findings exist yet — run research and synthesis first.",
    });
  }

  // 9 — the 3 moves are traceable to findings that are actually approved.
  const approvedFindingIds = new Set(
    findings.filter((f) => f.review_status === "approved").map((f) => f.id),
  );
  for (const m of moves.filter((m) => m.client_visible)) {
    const unresolved = m.based_on_finding_ids.filter((id) => !approvedFindingIds.has(id));
    if (unresolved.length > 0) {
      issues.push({
        area: "3 Moves",
        message: `"${m.title}" references a finding that is not (or no longer) approved — regenerate the strategic plan.`,
      });
    }
  }

  // 10 — same check for roadmap items.
  for (const r of roadmap.filter((r) => r.client_visible)) {
    const unresolved = r.based_on_finding_ids.filter((id) => !approvedFindingIds.has(id));
    if (unresolved.length > 0) {
      issues.push({
        area: "30-day roadmap",
        message: `"${r.action}" references a finding that is not (or no longer) approved — regenerate the strategic plan.`,
      });
    }
  }

  // 11 — nothing client-visible should ever be in a non-approved review state;
  // this is a data-integrity backstop, the UI shouldn't allow it to happen.
  const reviewableSets: {
    area: string;
    rows: { review_status: string; client_visible: boolean }[];
  }[] = [
    { area: "Findings", rows: findings },
    { area: "Strengths", rows: strengths },
    {
      area: "Reader journey",
      rows: (journeyRes.data ?? []) as { review_status: string; client_visible: boolean }[],
    },
    {
      area: "Comparables",
      rows: (comparablesRes.data ?? []) as { review_status: string; client_visible: boolean }[],
    },
    { area: "3 Moves", rows: moves },
    { area: "30-day roadmap", rows: roadmap },
  ];
  for (const { area, rows } of reviewableSets) {
    const unreviewed = rows.filter((r) => r.client_visible && r.review_status !== "approved");
    if (unreviewed.length > 0) {
      issues.push({
        area,
        message: `${unreviewed.length} item(s) are marked client-visible without being approved.`,
      });
    }
  }

  return { passed: issues.length === 0, issues, warnings };
}
