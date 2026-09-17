import { useCallback, useEffect, useRef, useState } from "react";
import { Ban, Clock, Copy, Eye, EyeOff, Link2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
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
type AccessRecord = PublishingData["access"] & object;

/** The Access panel — link, one-time code, view stats, expiry and the
 * enable/regenerate/disable/revoke controls. Redesigned as a single card so
 * the state (live/disabled/revoked) and every action for it live together. */
function AccessPanel({
  access,
  code,
  busy,
  expiry,
  onExpiryChange,
  onCopy,
  onAct,
}: {
  access: AccessRecord;
  code: string;
  busy: boolean;
  expiry: string;
  onExpiryChange: (value: string) => void;
  onCopy: (value: string) => Promise<void>;
  onAct: (action: string, extra?: Record<string, unknown>) => Promise<void>;
}) {
  const live = access.access_enabled && !access.revoked_at;
  const link =
    typeof window !== "undefined"
      ? `${window.location.origin}/author-audit/${access.public_slug}`
      : `/author-audit/${access.public_slug}`;

  return (
    <div className="overflow-hidden rounded-2xl border border-border">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-secondary/60 px-5 py-3.5">
        <span
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold",
            live
              ? "bg-emerald-500/15 text-emerald-700"
              : access.revoked_at
                ? "bg-destructive/10 text-destructive"
                : "bg-muted text-muted-foreground",
          )}
        >
          <span
            className={cn(
              "size-2 rounded-full",
              live ? "bg-emerald-500" : access.revoked_at ? "bg-destructive" : "bg-muted-foreground/50",
            )}
          />
          {live ? "Access enabled" : access.revoked_at ? "Access revoked" : "Access disabled"}
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="size-3.5" aria-hidden="true" />
          {access.expires_at
            ? `Expires ${new Date(access.expires_at).toLocaleString()}`
            : "No expiry set"}
        </span>
      </div>

      <div className="space-y-5 p-5">
        <div>
          <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Client link
          </p>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-background py-2 pr-2 pl-3">
            <Link2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="flex-1 truncate text-sm">{link}</span>
            <button
              type="button"
              onClick={() => void onCopy(link)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-secondary/70"
            >
              <Copy className="size-3.5" aria-hidden="true" />
              Copy
            </button>
          </div>
        </div>

        {code ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand/30 bg-brand-soft/40 p-3.5">
            <div>
              <p className="text-xs font-semibold text-brand">One-time access code — shown once</p>
              <code className="mt-1 block font-mono text-lg tracking-[0.25em] select-all">
                {code}
              </code>
            </div>
            <button
              type="button"
              onClick={() => void onCopy(code)}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground"
            >
              <Copy className="size-3.5" aria-hidden="true" />
              Copy code
            </button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Codes are shown once. Regenerate below if you no longer have the original.
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-secondary/40 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Eye className="size-3.5" aria-hidden="true" /> Views
            </p>
            <p className="mt-1 font-display text-lg">{access.view_count}</p>
          </div>
          <div className="rounded-xl border border-border bg-secondary/40 p-3">
            <p className="text-xs font-semibold text-muted-foreground">First viewed</p>
            <p className="mt-1 text-sm">
              {access.first_viewed_at ? new Date(access.first_viewed_at).toLocaleString() : "Not opened"}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-secondary/40 p-3">
            <p className="text-xs font-semibold text-muted-foreground">Last viewed</p>
            <p className="mt-1 text-sm">
              {access.last_viewed_at ? new Date(access.last_viewed_at).toLocaleString() : "Not opened"}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-xl border border-border bg-secondary/40 p-3.5 sm:flex-row sm:items-end sm:justify-between">
          <label className="text-sm">
            <span className="mb-1 block text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Expiration
            </span>
            <input
              type="datetime-local"
              value={expiry}
              onChange={(e) => onExpiryChange(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void onAct("expiry", { expiresAt: expiry ? new Date(expiry).toISOString() : null })
            }
            className="rounded-full border border-border px-4 py-2 text-xs font-semibold transition-colors hover:border-brand disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save expiration
          </button>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (window.confirm("Replace the code and invalidate existing client sessions?"))
                void onAct("regenerate");
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs font-semibold transition-colors hover:border-brand disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className="size-3.5" aria-hidden="true" />
            Regenerate code
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onAct("disable")}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs font-semibold transition-colors hover:border-brand disabled:cursor-not-allowed disabled:opacity-50"
          >
            <EyeOff className="size-3.5" aria-hidden="true" />
            Disable page
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (window.confirm("Revoke the code and all client sessions?")) void onAct("revoke");
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-destructive/40 px-4 py-2 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Ban className="size-3.5" aria-hidden="true" />
            Revoke access
          </button>
        </div>
      </div>
    </div>
  );
}

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
            <AccessPanel
              access={data.access}
              code={code}
              busy={busy}
              expiry={expiry}
              onExpiryChange={setExpiry}
              onCopy={copy}
              onAct={act}
            />
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
