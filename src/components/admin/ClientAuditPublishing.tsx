import { useCallback, useEffect, useRef, useState } from "react";
import { PrivateAuditReport } from "@/components/site/PrivateAuthorAudit";
import type { ReportData } from "@/lib/author-audit/report-data";

type Version = {
  id: string;
  created_at: string;
  published_at: string | null;
  snapshot: ReportData;
};
type PublishingData = {
  access: {
    public_slug: string;
    access_enabled: boolean;
    revoked_at: string | null;
    expires_at: string | null;
    version_id: string;
    view_count: number;
    first_viewed_at: string | null;
    last_viewed_at: string | null;
  } | null;
  versions: Version[];
  interest: {
    id: string;
    version_id: string;
    finding_id: string;
    author_interest: string;
    question: string | null;
    created_at: string;
  }[];
  events: { event: string; target: string | null; created_at: string }[];
  quality: { passed: boolean; issues: { message: string }[] };
};
const checks = [
  "Comparables and their sources verified",
  "Series recommendation resolved or removed",
  "Goodreads opportunities verified",
  "Visual evidence approved for client viewing",
  "Unsupported claims corrected and source appendix cleaned",
  "This exact version has been reviewed as the author",
];
export function ClientAuditPublishing({ auditId }: { auditId: string }) {
  const [data, setData] = useState<PublishingData | null>(null);
  const [message, setMessage] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState<string[]>([]);
  const [preview, setPreview] = useState<Version | null>(null);
  const previewRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!preview) return;
    const dialog = previewRef.current;
    dialog?.showModal();
    const prior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = prior;
    };
  }, [preview]);
  const [expiry, setExpiry] = useState("");
  const endpoint = `/api/admin/author-audits/${auditId}/publishing`;
  const load = useCallback(async () => {
    try {
      const res = await fetch(endpoint);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      setData(body);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to load client access.");
    }
  }, [endpoint]);
  useEffect(() => {
    void load();
  }, [load]);
  async function act(action: string, extra = {}) {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      if (body.code) setCode(body.code);
      if (["draft", "publish"].includes(action)) setChecked([]);
      if (action === "revoke") setCode("");
      setMessage(
        action === "draft"
          ? "Draft captured. Review the changes and author preview before publishing."
          : "Client access updated.",
      );
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not update access.");
    } finally {
      setBusy(false);
    }
  }
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage("Copied.");
    } catch {
      setMessage("Copy unavailable. Select and copy the displayed text.");
    }
  }
  const draft = data?.versions.find((v) => !v.published_at);
  const ready = Boolean(
    draft &&
    draft.snapshot.comparables.length >= 3 &&
    draft.snapshot.comparables.length <= 5 &&
    draft.snapshot.comparables.every((c) => c.source_urls.length && c.retrieved_at) &&
    draft.snapshot.evidenceAssets.length &&
    draft.snapshot.strengths.length &&
    draft.snapshot.moves.length === 3,
  );
  const published = data?.versions.find((v) => v.id === data.access?.version_id);
  return (
    <section className="rounded-2xl border border-border bg-card p-5 space-y-5">
      <div>
        <p className="text-xs uppercase tracking-widest text-brand">Private client experience</p>
        <h3 className="mt-2 font-display text-2xl">Publish a reviewed audit</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Capture a version, review it, then publish. Internal research edits never silently change
          a published report.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <button
          disabled={busy}
          onClick={() => void act("draft")}
          className="rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground"
        >
          Create new version
        </button>
        <button onClick={() => void load()} className="text-sm underline">
          Refresh status
        </button>
      </div>
      {message && (
        <p role="status" className="rounded-xl bg-secondary p-3 text-sm">
          {message}
        </p>
      )}
      {data && (
        <>
          {draft && !ready && (
            <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
              REVIEW REQUIRED: this version needs 3–5 sourced and dated comparables, approved visual
              evidence, at least one verified strength, and exactly 3 traceable priority moves
              before publishing.
            </p>
          )}
          <p className="text-sm font-semibold">
            {data.quality.passed
              ? "Engine quality check passed — complete publication review below."
              : "REVIEW REQUIRED"}
          </p>
          {data.quality.issues.map((i, index) => (
            <p key={index} className="text-sm text-destructive">
              {i.message}
            </p>
          ))}
          {draft && (
            <div className="rounded-xl border border-border p-4 space-y-3">
              <h4 className="font-semibold">
                Review changes · {new Date(draft.created_at).toLocaleString()}
              </h4>
              {(
                [
                  "strengths",
                  "findings",
                  "readerJourney",
                  "comparables",
                  "moves",
                  "roadmap",
                  "evidenceAssets",
                  "sourcesReviewed",
                ] as const
              ).map((key) => (
                <p className="text-xs" key={key}>
                  {key}: {published?.snapshot[key].length ?? 0} → {draft.snapshot[key].length} ·{" "}
                  {JSON.stringify(published?.snapshot[key]) === JSON.stringify(draft.snapshot[key])
                    ? "Unchanged"
                    : "Changed — review in preview"}
                </p>
              ))}
              <button className="text-brand underline" onClick={() => setPreview(draft)}>
                Preview as author
              </button>
              {checks.map((check) => (
                <label key={check} className="flex gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={checked.includes(check)}
                    onChange={(e) =>
                      setChecked((c) =>
                        e.target.checked ? [...c, check] : c.filter((x) => x !== check),
                      )
                    }
                  />
                  {check}
                </label>
              ))}
              <button
                disabled={
                  busy || !data.quality.passed || !ready || checked.length !== checks.length
                }
                onClick={() => void act("publish", { versionId: draft.id, qaConfirmed: true })}
                className="rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground disabled:opacity-40"
              >
                {published ? "Publish update" : "Publish client audit"}
              </button>
            </div>
          )}
          {data.access && (
            <div className="space-y-3 rounded-xl bg-secondary p-4">
              <p className="text-sm font-semibold">
                {data.access.access_enabled && !data.access.revoked_at
                  ? "Access enabled"
                  : "Access disabled / revoked"}
              </p>
              <p className="break-all text-sm">
                {window.location.origin}/author-audit/{data.access.public_slug}
              </p>
              <div className="flex flex-wrap gap-4 text-sm">
                <button
                  onClick={() =>
                    void copy(`${window.location.origin}/author-audit/${data.access!.public_slug}`)
                  }
                >
                  Copy link
                </button>
                <button
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm("Replace the code and invalidate existing client sessions?"))
                      void act("regenerate");
                  }}
                >
                  Regenerate code
                </button>
                <button disabled={busy} onClick={() => void act("disable")}>
                  Disable page
                </button>
                <button
                  disabled={busy}
                  className="text-destructive"
                  onClick={() => {
                    if (window.confirm("Revoke the code and all client sessions?"))
                      void act("revoke");
                  }}
                >
                  Revoke access
                </button>
              </div>
              <p className="text-xs">
                Codes are shown once. Regenerate if you no longer have the original.
              </p>
              {code && (
                <div className="flex gap-3">
                  <code className="select-all">{code}</code>
                  <button onClick={() => void copy(code)}>Copy code</button>
                </div>
              )}
              <label className="block text-sm">
                Expiration (blank means no expiry)
                <input
                  type="datetime-local"
                  className="ml-2 rounded border p-2"
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                />
              </label>
              <button
                disabled={busy}
                onClick={() =>
                  void act("expiry", { expiresAt: expiry ? new Date(expiry).toISOString() : null })
                }
              >
                Save expiration
              </button>
              <p className="text-xs">
                Current expiry:{" "}
                {data.access.expires_at
                  ? new Date(data.access.expires_at).toLocaleString()
                  : "None"}
              </p>
              <p className="text-sm">
                Views: {data.access.view_count} · First:{" "}
                {data.access.first_viewed_at
                  ? new Date(data.access.first_viewed_at).toLocaleString()
                  : "Not opened"}{" "}
                · Last:{" "}
                {data.access.last_viewed_at
                  ? new Date(data.access.last_viewed_at).toLocaleString()
                  : "Not opened"}
              </p>
            </div>
          )}
          <details>
            <summary className="cursor-pointer font-semibold">
              Report versions ({data.versions.length})
            </summary>
            {data.versions.map((v) => (
              <div key={v.id} className="flex flex-wrap gap-3 border-b py-3 text-xs">
                <span>
                  {new Date(v.created_at).toLocaleString()} ·{" "}
                  {v.published_at ? "Published" : "Draft"}
                </span>
                <button onClick={() => setPreview(v)}>Preview as author</button>
                <a href={`${endpoint}?version=${v.id}&format=pdf`} target="_blank" rel="noreferrer">
                  Download PDF
                </a>
                <a
                  href={`${endpoint}?version=${v.id}&format=image`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Download share image
                </a>
              </div>
            ))}
          </details>
          <div>
            <h4 className="font-display text-xl">Client interest</h4>
            {!data.interest.length && (
              <p className="text-sm text-muted-foreground">No client selections yet.</p>
            )}
            {data.interest.map((i) => (
              <div key={i.id} className="mt-3 rounded-xl border p-3 text-sm">
                <strong>
                  {i.author_interest === "help" ? "Implementation opportunity" : i.author_interest}
                </strong>
                <p>
                  {data.versions
                    .find((v) => v.id === i.version_id)
                    ?.snapshot.findings.find((f) => f.id === i.finding_id)?.title ||
                    "Finding from an earlier version"}
                </p>
                {i.question && <p>{i.question}</p>}
                <small>{new Date(i.created_at).toLocaleString()}</small>
              </div>
            ))}
          </div>
          <details>
            <summary className="cursor-pointer text-sm">
              Recent access history ({data.events.length})
            </summary>
            {data.events.map((e, i) => (
              <p className="mt-2 text-xs" key={i}>
                {new Date(e.created_at).toLocaleString()} · {e.event} · {e.target}
              </p>
            ))}
          </details>
        </>
      )}
      {preview && (
        <dialog
          ref={previewRef}
          onCancel={() => setPreview(null)}
          className="fixed inset-0 m-0 h-full max-h-full w-full max-w-full overflow-auto bg-background"
          aria-label="Author report preview"
        >
          <button
            autoFocus
            className="sticky top-2 left-2 z-40 rounded-full bg-black px-5 py-3 text-white"
            onClick={() => setPreview(null)}
          >
            Close preview
          </button>
          <PrivateAuditReport
            preview
            report={preview.snapshot}
            versionId={preview.id}
            slug={auditId}
          />
        </dialog>
      )}
    </section>
  );
}
