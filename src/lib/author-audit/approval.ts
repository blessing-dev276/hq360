import { integrityIssues, type MatchFinding } from "./commercial";
export type ReviewEntity = "finding" | "section" | "listopia" | "action" | "asset";

/** Approval changes review state only; it must not resubmit stale editor content. */
export function approvalPatch(
  entity: ReviewEntity,
  record: Record<string, unknown>,
  status: "approved" | "rejected",
) {
  if (entity === "finding" && status === "approved") {
    const issues = integrityIssues(record as unknown as MatchFinding);
    if (issues.length) throw new Error(issues.join("; "));
  }
  if (entity === "asset" && status === "approved") {
    const required = {
      caption: "caption",
      proves: "what it proves",
      source: "source URL",
      asset_date: "capture date",
    };
    const missing = Object.entries(required)
      .filter(([key]) => !String(record[key] ?? "").trim())
      .map(([, name]) => name);
    if (missing.length)
      throw new Error(`Edit this screenshot and add ${missing.join(", ")} before approving it.`);
  }
  return {
    review_status: status,
    ...(["finding", "asset"].includes(entity)
      ? { client_visible: status === "approved" && (entity !== "finding" || !record.hidden) }
      : {}),
  };
}
