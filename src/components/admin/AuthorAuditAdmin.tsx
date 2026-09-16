import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  VERIFICATION_FIELDS,
  fieldsBySection,
  type VerificationField,
} from "@/lib/author-audit/verification-fields";
import type {
  Author,
  AuditFinding,
  AuditFindingStatus,
  AuditManualVerification,
  AuditSource,
  AuditStatus,
  AuthorAudit,
  AuthorAuditLead,
  Book,
} from "@/lib/author-audit/db";

const input =
  "w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

async function api<T>(url: string, init?: RequestInit): Promise<{ status: number; body: T }> {
  const res = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json" },
  });
  const body = (await res.json().catch(() => ({}))) as T;
  return { status: res.status, body };
}

type AuditListItem = AuthorAudit & {
  authors: { name: string } | null;
  books: { title: string } | null;
};

const STATUS_LABEL: Record<AuditStatus, string> = {
  draft: "Draft",
  researching: "Researching",
  needs_verification: "Needs verification",
  ready_for_review: "Ready for review",
  completed: "Completed",
  report_sent: "Report sent",
  follow_up: "Follow up",
  converted: "Converted",
  archived: "Archived",
};

const STATUS_ORDER: AuditStatus[] = [
  "draft",
  "researching",
  "needs_verification",
  "ready_for_review",
  "completed",
  "report_sent",
  "follow_up",
  "converted",
  "archived",
];

const FINDING_STATUS_LABEL: Record<AuditFindingStatus, string> = {
  strong: "Strong",
  healthy: "Healthy",
  opportunity_identified: "Opportunity",
  needs_attention: "Needs attention",
  critical_issue: "Critical",
  unable_to_verify: "Unable to verify",
};

const FINDING_STATUS_COLOR: Record<AuditFindingStatus, string> = {
  strong: "bg-emerald-100 text-emerald-800",
  healthy: "bg-emerald-50 text-emerald-700",
  opportunity_identified: "bg-brand-soft text-[oklch(0.42_0.16_42)]",
  needs_attention: "bg-amber-100 text-amber-800",
  critical_issue: "bg-red-100 text-red-800",
  unable_to_verify: "bg-secondary text-muted-foreground",
};

const SECTION_LABEL: Record<VerificationField["section"], string> = {
  amazon: "Amazon",
  goodreads: "Goodreads",
  social: "Social & media presence",
  reader_journey: "Reader journey",
  marketing_infra: "Marketing infrastructure",
};

export function AuthorAuditAdmin() {
  const [openId, setOpenId] = useState<string | null>(null);
  if (openId) return <AuditWorkspace id={openId} onBack={() => setOpenId(null)} />;
  return <AuditList onOpen={setOpenId} />;
}

function AuditList({ onOpen }: { onOpen: (id: string) => void }) {
  const [audits, setAudits] = useState<AuditListItem[] | null>(null);
  const [leads, setLeads] = useState<AuthorAuditLead[] | null>(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [manual, setManual] = useState({ authorName: "", bookTitle: "" });

  const load = useCallback(async () => {
    const [auditsRes, leadsRes] = await Promise.all([
      api<{ ok: boolean; items: AuditListItem[] }>("/api/admin/author-audits"),
      api<{ ok: boolean; items: AuthorAuditLead[] }>("/api/admin/author-audit-leads"),
    ]);
    if (auditsRes.status === 200 && auditsRes.body.ok) setAudits(auditsRes.body.items);
    else setError("Could not load audits.");
    if (leadsRes.status === 200 && leadsRes.body.ok) setLeads(leadsRes.body.items);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createFromLead(leadId: string) {
    setCreating(true);
    const { status, body } = await api<{ ok: boolean; item?: { id: string } }>(
      "/api/admin/author-audits",
      { method: "POST", body: JSON.stringify({ leadId }) },
    );
    setCreating(false);
    if (status === 201 && body.ok && body.item) onOpen(body.item.id);
    else setError("Could not create audit from that lead.");
  }

  async function createManual(e: React.FormEvent) {
    e.preventDefault();
    if (!manual.authorName.trim() || !manual.bookTitle.trim()) return;
    setCreating(true);
    const { status, body } = await api<{ ok: boolean; item?: { id: string } }>(
      "/api/admin/author-audits",
      {
        method: "POST",
        body: JSON.stringify({ authorName: manual.authorName, bookTitle: manual.bookTitle }),
      },
    );
    setCreating(false);
    if (status === 201 && body.ok && body.item) onOpen(body.item.id);
    else setError("Could not create the audit.");
  }

  const pendingLeads = (leads ?? []).filter((l) => l.status === "new");

  return (
    <div className="space-y-8">
      <p className="text-sm text-muted-foreground">
        Evidence-led author visibility audits. Every finding a client sees was gathered, then
        approved by a human — nothing is sent unreviewed.
      </p>

      {pendingLeads.length > 0 ? (
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-display text-lg">Leads awaiting review</h2>
          <ul className="mt-3 space-y-2">
            {pendingLeads.map((l) => (
              <li
                key={l.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {l.author_name} — {l.book_title}
                  </p>
                  <p className="text-xs text-muted-foreground">{l.email}</p>
                </div>
                <button
                  type="button"
                  disabled={creating}
                  onClick={() => void createFromLead(l.id)}
                  className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
                >
                  Open as audit
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <form onSubmit={createManual} className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <h2 className="font-display text-lg">Start an audit manually</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium">Author name</span>
            <input
              className={cn(input, "mt-1.5")}
              value={manual.authorName}
              onChange={(e) => setManual((m) => ({ ...m, authorName: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Book title</span>
            <input
              className={cn(input, "mt-1.5")}
              value={manual.bookTitle}
              onChange={(e) => setManual((m) => ({ ...m, bookTitle: e.target.value }))}
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={creating}
          className="mt-4 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-70"
        >
          {creating ? "Creating…" : "Create audit"}
        </button>
      </form>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {audits === null ? (
        <p className="text-sm text-muted-foreground">Loading audits…</p>
      ) : audits.length === 0 ? (
        <p className="text-sm text-muted-foreground">No audits yet.</p>
      ) : (
        <ul className="space-y-2">
          {audits.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => onOpen(a.id)}
                className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left hover:border-brand/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {a.books?.title ?? "Untitled"} — {a.authors?.name ?? "Unknown author"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Created {new Date(a.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium">
                  {STATUS_LABEL[a.status]}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type AuditDetailResponse = {
  ok: boolean;
  audit: AuthorAudit & { authors: Author; books: Book };
  sources: AuditSource[];
  evidence: { id: string; section: string; claim: string; excerpt: string | null }[];
  findings: AuditFinding[];
  verifications: AuditManualVerification[];
  opportunities: { capability_slug: string; rationale: string }[];
};

function AuditWorkspace({ id, onBack }: { id: string; onBack: () => void }) {
  const [data, setData] = useState<AuditDetailResponse | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { status, body } = await api<AuditDetailResponse>(`/api/admin/author-audits/${id}`);
    if (status === 200 && body.ok) setData(body);
    else setError("Could not load this audit.");
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function setStatus(status: AuditStatus) {
    await api(`/api/admin/author-audits/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    await load();
  }

  async function runResearch() {
    setBusy("research");
    setError("");
    const { status, body } = await api<{ ok: boolean; error?: string }>(
      `/api/admin/author-audits/${id}/research`,
      { method: "POST" },
    );
    setBusy(null);
    if (status !== 200 || !body.ok) setError(body.error || "Research failed.");
    await load();
  }

  async function runSynthesis() {
    setBusy("synthesize");
    setError("");
    const { status, body } = await api<{ ok: boolean; error?: string }>(
      `/api/admin/author-audits/${id}/synthesize`,
      { method: "POST" },
    );
    setBusy(null);
    if (status !== 200 || !body.ok) {
      setError(
        body.error === "ANTHROPIC_API_KEY not set"
          ? "Findings synthesis needs an Anthropic API key — not configured yet."
          : body.error || "Synthesis failed.",
      );
    }
    await load();
  }

  if (error && !data) {
    return (
      <div className="space-y-4">
        <BackButton onBack={onBack} />
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }
  if (!data) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const { audit, sources, findings, verifications } = data;

  return (
    <div className="space-y-8">
      <BackButton onBack={onBack} />

      <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border bg-card p-5">
        <div>
          <h2 className="font-display text-xl">{audit.books.title}</h2>
          <p className="text-sm text-muted-foreground">{audit.authors.name}</p>
        </div>
        <select
          className={cn(input, "w-auto")}
          value={audit.status}
          onChange={(e) => void setStatus(e.target.value as AuditStatus)}
        >
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {/* Research */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg">Automated research</h3>
          <button
            type="button"
            disabled={busy === "research"}
            onClick={() => void runResearch()}
            className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
          >
            {busy === "research" ? "Running…" : "Run automated research"}
          </button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Google Books, Open Library and a direct website check. Amazon and Goodreads have no usable
          free API — fill those in below.
        </p>
        {sources.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {sources.map((s) => (
              <li key={s.id} className="rounded-xl border border-border p-3 text-sm">
                <p className="font-medium">
                  {s.provider} — {s.source_type}{" "}
                  <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-xs">
                    {s.status}
                  </span>
                </p>
                {s.error_message ? (
                  <p className="mt-1 text-xs text-destructive">{s.error_message}</p>
                ) : (
                  <pre className="mt-1 max-h-32 overflow-auto text-xs text-muted-foreground">
                    {JSON.stringify(s.raw_data, null, 2).slice(0, 800)}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">No research run yet.</p>
        )}
      </section>

      {/* Manual verification */}
      <VerificationForm auditId={id} existing={verifications} onSaved={load} />

      {/* Synthesis */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg">Generate findings</h3>
          <button
            type="button"
            disabled={busy === "synthesize"}
            onClick={() => void runSynthesis()}
            className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
          >
            {busy === "synthesize" ? "Synthesizing…" : "Generate findings (AI)"}
          </button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Sends the research above to Claude, which returns evidence-only findings — nothing here is
          visible to the client until you approve it below.
        </p>
      </section>

      {/* Findings review */}
      {findings.length > 0 ? (
        <section className="space-y-3">
          <h3 className="font-display text-lg">Findings — review before sending</h3>
          {findings.map((f) => (
            <FindingCard key={f.id} auditId={id} finding={f} onSaved={load} />
          ))}
        </section>
      ) : null}

      {/* Report */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h3 className="font-display text-lg">Client report</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Only findings marked "Client visible" above are included.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a
            href={`/api/admin/author-audits/${id}/report?format=pdf`}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-border px-5 py-2 text-sm font-medium hover:border-brand hover:text-brand"
          >
            View / download PDF
          </a>
          <a
            href={`/api/admin/author-audits/${id}/report?format=image`}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-border px-5 py-2 text-sm font-medium hover:border-brand hover:text-brand"
          >
            View / download shareable image
          </a>
        </div>
      </section>
    </div>
  );
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="text-sm text-muted-foreground hover:text-foreground"
    >
      ← All audits
    </button>
  );
}

function VerificationForm({
  auditId,
  existing,
  onSaved,
}: {
  auditId: string;
  existing: AuditManualVerification[];
  onSaved: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const v of existing) map[v.field_key] = v.value ?? "";
    return map;
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const map: Record<string, string> = {};
    for (const v of existing) map[v.field_key] = v.value ?? "";
    setValues(map);
  }, [existing]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    const entries = VERIFICATION_FIELDS.filter((f) => (values[f.key] ?? "").trim() !== "").map(
      (f) => ({
        fieldKey: f.key,
        value: values[f.key]!.trim(),
        verificationStatus: "verified" as const,
      }),
    );
    if (entries.length > 0) {
      await api(`/api/admin/author-audits/${auditId}/verifications`, {
        method: "POST",
        body: JSON.stringify({ entries }),
      });
    }
    setSaving(false);
    setSaved(true);
    onSaved();
  }

  const sections = ["amazon", "goodreads", "social", "reader_journey", "marketing_infra"] as const;

  return (
    <form onSubmit={save} className="rounded-2xl border border-border bg-card p-5">
      <h3 className="font-display text-lg">Manual verification</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Look these up by hand and enter what you actually find. Leave blank if not checked — blank
        fields are treated as unverified, never guessed.
      </p>
      <div className="mt-4 space-y-6">
        {sections.map((section) => (
          <div key={section}>
            <h4 className="text-sm font-semibold">{SECTION_LABEL[section]}</h4>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {fieldsBySection(section).map((f) => (
                <label key={f.key} className="block">
                  <span className="text-xs font-medium text-muted-foreground">{f.label}</span>
                  {f.hint ? (
                    <span className="block text-[0.65rem] text-muted-foreground">{f.hint}</span>
                  ) : null}
                  <input
                    className={cn(input, "mt-1")}
                    value={values[f.key] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button
        type="submit"
        disabled={saving}
        className="mt-5 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-70"
      >
        {saving ? "Saving…" : saved ? "Saved" : "Save verification"}
      </button>
    </form>
  );
}

function FindingCard({
  auditId,
  finding,
  onSaved,
}: {
  auditId: string;
  finding: AuditFinding;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState({
    observation: finding.observation,
    whyItMatters: finding.why_it_matters ?? "",
    recommendation: finding.recommendation ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function patch(body: Record<string, unknown>) {
    setSaving(true);
    await api(`/api/admin/author-audits/${auditId}/findings/${finding.id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    setSaving(false);
    onSaved();
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">{finding.section}</p>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-medium",
            FINDING_STATUS_COLOR[finding.status],
          )}
        >
          {FINDING_STATUS_LABEL[finding.status]}
        </span>
      </div>

      <label className="mt-3 block">
        <span className="text-xs font-medium text-muted-foreground">Observed</span>
        <textarea
          rows={2}
          className={cn(input, "mt-1 resize-y")}
          value={draft.observation}
          onChange={(e) => setDraft((d) => ({ ...d, observation: e.target.value }))}
        />
      </label>
      <label className="mt-3 block">
        <span className="text-xs font-medium text-muted-foreground">Why it matters</span>
        <textarea
          rows={2}
          className={cn(input, "mt-1 resize-y")}
          value={draft.whyItMatters}
          onChange={(e) => setDraft((d) => ({ ...d, whyItMatters: e.target.value }))}
        />
      </label>
      <label className="mt-3 block">
        <span className="text-xs font-medium text-muted-foreground">Recommendation</span>
        <textarea
          rows={2}
          className={cn(input, "mt-1 resize-y")}
          value={draft.recommendation}
          onChange={(e) => setDraft((d) => ({ ...d, recommendation: e.target.value }))}
        />
      </label>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={() =>
            void patch({
              observation: draft.observation,
              whyItMatters: draft.whyItMatters || null,
              recommendation: draft.recommendation || null,
            })
          }
          className="rounded-full border border-border px-4 py-1.5 text-xs font-medium hover:border-brand hover:text-brand"
        >
          Save edits
        </button>
        <label className="ml-auto flex items-center gap-2 text-xs font-medium">
          <input
            type="checkbox"
            checked={finding.client_visible}
            onChange={(e) =>
              void patch({
                clientVisible: e.target.checked,
                reviewStatus: e.target.checked ? "approved" : "needs_verification",
              })
            }
            className="size-4 accent-[var(--brand)]"
          />
          Client visible (include in report)
        </label>
      </div>
    </div>
  );
}
