export type ContactEvidence = {
  email: string;
  role: "author" | "agent" | "publisher" | "publicist";
  source_url: string;
  evidence: string;
  verified: boolean;
};
export function emailCoverage(
  rows: { author_id: string; contacts: ContactEvidence[]; status: string }[],
  targetCount: number,
) {
  const unique = [...new Map(rows.map((row) => [row.author_id, row])).values()];
  const direct = unique.filter((r) =>
    r.contacts.some((c) => c.role === "author" && c.verified),
  ).length;
  const representative = unique.filter(
    (r) =>
      !r.contacts.some((c) => c.role === "author" && c.verified) &&
      r.contacts.some((c) => c.role !== "author" && c.verified),
  ).length;
  const unverified = unique.filter(
    (r) => r.contacts.length > 0 && !r.contacts.some((c) => c.verified),
  ).length;
  return {
    direct,
    representative,
    unverified,
    processed: unique.length,
    paused: unique.filter((r) => r.status === "paused").length,
    total: targetCount,
    percent: targetCount ? Math.round((direct / targetCount) * 100) : 0,
  };
}
