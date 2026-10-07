import { useEffect, useState } from "react";
import { emailCoverage, type ContactEvidence } from "@/lib/scout/email-report";
type Report = {
  run: { budget_usd: number; accounted_usd: number; targets: unknown[] };
  actualUsd: number;
  unsettled: number;
  results: {
    author_id: string;
    contacts: ContactEvidence[];
    status: string;
    checked_sources: number;
  }[];
};
export function EmailRunReport({ id, revision }: { id: string; revision: number }) {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/admin/scout-email-runs?id=${encodeURIComponent(id)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        setReport(data);
        setError("");
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [id, revision]);
  if (error) return <p role="alert">{error}</p>;
  if (!report) return <p>Loading email search report…</p>;
  const coverage = emailCoverage(report.results, report.run.targets.length);
  return (
    <div className="my-3 space-y-2 rounded-xl border border-border p-4 text-sm" aria-live="polite">
      <p className="font-semibold">
        Direct author emails: {coverage.direct}/{coverage.total} ({coverage.percent}%) · target 90%
      </p>
      <p>
        {coverage.representative} representative-only · {coverage.unverified} unverified candidates
        · {coverage.processed}/{coverage.total} processed · {coverage.paused} budget-paused
      </p>
      <p>
        Provider-reported cost: ${Number(report.actualUsd).toFixed(4)} · budget used/reserved: $
        {Number(report.run.accounted_usd).toFixed(2)} / ${Number(report.run.budget_usd).toFixed(2)}
        {report.unsettled > 0 ? ` · ${report.unsettled} requests awaiting cost confirmation` : ""}
      </p>
      <p className="text-xs text-muted-foreground">
        Source verification confirms publication and author association, not a working mailbox.
        Representatives and unverified candidates do not count toward 90%. In-flight charges may
        exceed the budget threshold.
      </p>
      <button
        className="rounded-lg border px-3 py-2"
        onClick={() => {
          const content = JSON.stringify({ ...report, coverage }, null, 2);
          const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
          const a = document.createElement("a");
          a.href = url;
          a.download = `email-search-${id}.json`;
          a.click();
          URL.revokeObjectURL(url);
        }}
      >
        Download report
      </button>
    </div>
  );
}
