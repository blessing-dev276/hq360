import { useEffect, useState } from "react";
import { emailCoverage, type ContactEvidence } from "@/lib/scout/email-report";
type Report = {
  run: { accounted_usd: number; targets: unknown[]; status?: string };
  actualUsd: number;
  unsettled: number;
  results: {
    author_id: string;
    contacts: ContactEvidence[];
    status: string;
    checked_sources: number;
  }[];
};
type RunChoice = {
  id: string;
  status: string;
  created_at: string;
  accounted_usd: number;
};
export function EmailRunReport({ id, revision }: { id: string | null; revision: number }) {
  const [runs, setRuns] = useState<RunChoice[]>([]);
  const [selected, setSelected] = useState("");
  const reportId = id || selected;
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    if (!id) {
      void fetch("/api/admin/scout-email-runs", { signal: controller.signal })
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok) throw new Error(data.message);
          setRuns(data.runs ?? []);
          setSelected((current) => current || data.runs?.[0]?.id || "");
        })
        .catch((e) => {
          if (!controller.signal.aborted) setError(e.message);
        });
      return () => controller.abort();
    }
    setSelected(id);
    return undefined;
  }, [id]);
  useEffect(() => {
    const controller = new AbortController();
    if (!reportId) return;
    void fetch(`/api/admin/scout-email-runs?id=${encodeURIComponent(reportId)}`, {
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
  }, [reportId, revision]);
  if (error) return <p role="alert">{error}</p>;
  if (!reportId) return <p>No email search runs have been saved yet.</p>;
  if (!report) return <p>Loading email search report…</p>;
  const coverage = emailCoverage(report.results, report.run.targets.length);
  return (
    <div className="my-3 space-y-2 rounded-xl border border-border p-4 text-sm" aria-live="polite">
      {runs.length > 0 && (
        <label className="block">
          Saved email search runs
          <select
            aria-label="Saved email search runs"
            className="ml-2 rounded border bg-background p-2"
            value={reportId}
            onChange={(e) => {
              setSelected(e.target.value);
              setReport(null);
            }}
          >
            {runs.map((r) => (
              <option key={r.id} value={r.id}>
                {new Date(r.created_at).toLocaleString()} · {r.status} · $
                {Number(r.accounted_usd).toFixed(2)}
              </option>
            ))}
          </select>
        </label>
      )}
      <p className="font-semibold">
        Run {report.run.status ?? "running"} · Direct author emails: {coverage.direct}/
        {coverage.total} ({coverage.percent}%) · target 90%
      </p>
      <p>
        {coverage.representative} representative-only · {coverage.unverified} unverified candidates
        · {coverage.processed}/{coverage.total} processed · {coverage.paused} paused
      </p>
      <p>
        Provider-reported cost: ${Number(report.actualUsd).toFixed(4)}
        {report.unsettled > 0 ? ` · ${report.unsettled} requests awaiting cost confirmation` : ""}
      </p>
      <p className="text-xs text-muted-foreground">
        Source verification confirms publication and author association, not a working mailbox.
        Representatives and unverified candidates do not count toward 90%.
      </p>
      <button
        className="rounded-lg border px-3 py-2"
        onClick={() => {
          const content = JSON.stringify({ ...report, coverage }, null, 2);
          const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
          const a = document.createElement("a");
          a.href = url;
          a.download = `email-search-${reportId}.json`;
          a.click();
          URL.revokeObjectURL(url);
        }}
      >
        Download report
      </button>
    </div>
  );
}
