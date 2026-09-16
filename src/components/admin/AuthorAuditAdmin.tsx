import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import "./audit-workspace.css";
import { uploadAdminMedia } from "@/lib/admin-upload";
import {
  VERIFICATION_FIELDS,
  VERIFICATION_SECTIONS,
  SECTION_LABEL,
  fieldsBySection,
} from "@/lib/author-audit/verification-fields";
import {
  READER_JOURNEY_STAGE_LABEL,
  READER_JOURNEY_STAGE_ORDER,
} from "@/lib/author-audit/reader-journey-labels";
import type {
  Author,
  AuditComparable,
  AuditEvidenceAsset,
  AuditFinding,
  AuditFindingStatus,
  AuditManualVerification,
  AuditPriorityMove,
  AuditReaderJourneyStep,
  AuditReport,
  AuditRoadmapItem,
  AuditSource,
  AuditStatus,
  AuditStrength,
  AuthorAudit,
  AuthorAuditLead,
  Book,
  ExecutiveAssessment,
  ReviewStatus,
} from "@/lib/author-audit/db";

const input =
  "w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

async function api<T>(url: string, init?: RequestInit): Promise<{ status: number; body: T }> {
  const res = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json" },
  }).catch(() => null);
  if (!res)
    return {
      status: 0,
      body: { ok: false, error: "Connection interrupted. Please try again." } as T,
    };
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

const REVIEW_LABEL: Record<ReviewStatus, string> = {
  ai_research: "AI draft",
  needs_verification: "Needs verification",
  approved: "Approved",
  rejected: "Rejected",
};

const EMPTY_ASSESSMENT: ExecutiveAssessment = {
  whatIsWorking: "",
  strongestOpportunities: "",
  journeyBreaks: "",
  comparablePatterns: "",
  priorityFirst: "",
  doNotChange: "",
  unknowns: "",
};

export function AuthorAuditAdmin() {
  const [openId, setOpenId] = useState<string | null>(null);
  if (openId) return <AuditWorkspace id={openId} onBack={() => setOpenId(null)} />;
  return <AuditList onOpen={setOpenId} />;
}

/* -------------------------------------------------------------------- list */

function AuditList({ onOpen }: { onOpen: (id: string) => void }) {
  const [audits, setAudits] = useState<AuditListItem[] | null>(null);
  const [leads, setLeads] = useState<AuthorAuditLead[] | null>(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [manual, setManual] = useState({ authorName: "", bookTitle: "" });
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function deleteAudit(audit: AuditListItem) {
    if (
      !window.confirm(
        `Permanently delete the audit for “${audit.books?.title ?? "Untitled"}”? Its research, findings and report history will be removed. This cannot be undone. Shared author/book records and uploaded files are retained.`,
      )
    )
      return;
    setDeleting(audit.id);
    setError("");
    const result = await api<{ ok: boolean }>(`/api/admin/author-audits/${audit.id}`, {
      method: "DELETE",
    });
    setDeleting(null);
    if (result.status === 200 && result.body.ok)
      setAudits((current) => current?.filter((item) => item.id !== audit.id) ?? null);
    else setError("Could not delete this audit. Please try again.");
  }

  const load = useCallback(async () => {
    setError("");
    const [auditsRes, leadsRes] = await Promise.all([
      api<{ ok: boolean; items: AuditListItem[] }>("/api/admin/author-audits"),
      api<{ ok: boolean; items: AuthorAuditLead[] }>("/api/admin/author-audit-leads"),
    ]);
    if (auditsRes.status === 200 && auditsRes.body.ok) setAudits(auditsRes.body.items);
    else setError("Could not load audits.");
    if (leadsRes.status === 200 && leadsRes.body.ok) setLeads(leadsRes.body.items);
    else setError("Could not load new requests. Please refresh to try again.");
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
  const visibleAudits = (audits ?? []).filter(
    (a) =>
      (filter === "all" || a.status === filter) &&
      `${a.authors?.name} ${a.books?.title}`.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="audit-studio space-y-6">
      <div className="audit-hero">
        <div>
          <span className="audit-eyebrow">HQ360 / Audit studio</span>
          <h2>Turn evidence into opportunity.</h2>
          <p>Research, review and deliver a clearer path forward for every author.</p>
        </div>
        <button type="button" onClick={() => setShowCreate(!showCreate)} aria-expanded={showCreate}>
          + New audit
        </button>
      </div>
      <div className="audit-metrics">
        {[
          ["Total audits", audits?.length],
          ["New requests", leads ? pendingLeads.length : undefined],
          [
            "Awaiting review",
            audits?.filter(
              (a) => a.status === "needs_verification" || a.status === "ready_for_review",
            ).length,
          ],
          [
            "Completed / sent",
            audits?.filter((a) => a.status === "completed" || a.status === "report_sent").length,
          ],
        ].map(([label, value]) => (
          <div key={label} className="audit-metric">
            <strong>{value ?? "—"}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>

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

      <form
        hidden={!showCreate}
        onSubmit={createManual}
        className="rounded-2xl border border-border bg-card p-5 sm:p-6"
      >
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

      <div className="audit-toolbar">
        <input
          className={input}
          aria-label="Search audits"
          placeholder="Search author or book…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className={input}
          aria-label="Filter by status"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">All statuses</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>
      {audits === null ? (
        <p className="text-sm text-muted-foreground">Loading audits…</p>
      ) : visibleAudits.length === 0 ? (
        <div className="audit-empty">
          <h3>{audits.length ? "No matching audits" : "Your next audit starts here"}</h3>
          <p>
            {audits.length
              ? "Try a different search or status."
              : "Create an audit or open a new request to begin."}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {visibleAudits.map((a) => (
            <li key={a.id} className="flex items-center gap-2">
              <button type="button" onClick={() => onOpen(a.id)} className="audit-list-row">
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
              <button
                type="button"
                disabled={deleting !== null}
                onClick={() => void deleteAudit(a)}
                aria-label={`Delete audit for ${a.books?.title ?? "Untitled"}`}
                className="shrink-0 rounded-xl border border-border px-3 py-3 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"
              >
                {deleting === a.id ? "Deleting…" : "Delete"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* --------------------------------------------------------- shared review UI */

/** Approve / needs verification / reject + the client-visible gate, shared
 * by every v2 reviewable entity (strengths, reader-journey steps,
 * comparables, moves, roadmap items — findings use the same shape too). */
function ReviewBar({
  reviewStatus,
  clientVisible,
  onChange,
}: {
  reviewStatus: ReviewStatus;
  clientVisible: boolean;
  onChange: (patch: { reviewStatus?: ReviewStatus; clientVisible?: boolean }) => void;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
      <div className="flex rounded-full border border-border p-0.5 text-xs">
        {(["needs_verification", "approved", "rejected"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onChange({ reviewStatus: s })}
            className={cn(
              "rounded-full px-3 py-1 font-medium",
              reviewStatus === s ? "bg-primary text-primary-foreground" : "text-muted-foreground",
            )}
          >
            {REVIEW_LABEL[s]}
          </button>
        ))}
      </div>
      <label className="ml-auto flex items-center gap-2 text-xs font-medium">
        <input
          type="checkbox"
          checked={clientVisible}
          onChange={(e) => onChange({ clientVisible: e.target.checked })}
          disabled={reviewStatus !== "approved"}
          className="size-4 accent-[var(--brand)] disabled:opacity-40"
        />
        Client visible
      </label>
      {reviewStatus === "ai_research" ? (
        <span className="w-full text-[0.65rem] text-muted-foreground">
          AI draft — read it, then mark approved or rejected.
        </span>
      ) : null}
    </div>
  );
}

/* --------------------------------------------------------------- workspace */

type AuditDetailResponse = {
  ok: boolean;
  audit: Omit<AuthorAudit, "input_snapshot"> & {
    authors: Author;
    books: Book;
    input_snapshot: Record<string, unknown>;
  };
  sources: AuditSource[];
  evidence: { id: string; section: string; claim: string; excerpt: string | null }[];
  findings: AuditFinding[];
  verifications: AuditManualVerification[];
  opportunities: { capability_slug: string; rationale: string }[];
  strengths: AuditStrength[];
  readerJourney: AuditReaderJourneyStep[];
  comparables: AuditComparable[];
  moves: AuditPriorityMove[];
  roadmap: AuditRoadmapItem[];
  evidenceAssets: AuditEvidenceAsset[];
  reports: AuditReport[];
};

type QualityCheck = {
  passed: boolean;
  issues: { area: string; message: string }[];
  warnings: { area: string; message: string }[];
};

function AuditWorkspace({ id, onBack }: { id: string; onBack: () => void }) {
  const [stage, setStage] = useState("research");
  const [data, setData] = useState<AuditDetailResponse | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [quality, setQuality] = useState<QualityCheck | null>(null);
  const [copiedReportId, setCopiedReportId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setQuality(null);
    const { status, body } = await api<AuditDetailResponse>(`/api/admin/author-audits/${id}`);
    if (status === 200 && body.ok) setData(body);
    else setError("Could not load this audit.");
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadQuality = useCallback(async () => {
    const { status, body } = await api<QualityCheck & { ok: boolean }>(
      `/api/admin/author-audits/${id}/quality-check`,
    );
    if (status === 200 && body.ok) setQuality(body);
    else setError("Could not run the quality check. Please try again.");
  }, [id]);

  async function setStatus(status: AuditStatus) {
    await api(`/api/admin/author-audits/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    await load();
  }

  async function setStaffName(name: string) {
    await api(`/api/admin/author-audits/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ preparedByStaffName: name || null }),
    });
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

  async function runPlan() {
    setBusy("plan");
    setError("");
    const { status, body } = await api<{ ok: boolean; error?: string }>(
      `/api/admin/author-audits/${id}/synthesize-plan`,
      { method: "POST" },
    );
    setBusy(null);
    if (status !== 200 || !body.ok) setError(body.error || "Strategic plan generation failed.");
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

  const {
    audit,
    sources,
    findings,
    verifications,
    strengths,
    readerJourney,
    comparables,
    moves,
    roadmap,
    evidenceAssets,
    reports,
  } = data;
  const approvedFindingCount = findings.filter((f) => f.review_status === "approved").length;
  const pendingReviews = [...findings, ...strengths, ...readerJourney, ...comparables].filter(
    (item) => item.review_status !== "approved" && item.review_status !== "rejected",
  ).length;
  const stages = [
    { id: "research", name: "Research", detail: `${sources.length} sources` },
    { id: "verify", name: "Verify", detail: `${verifications.length} records` },
    { id: "review", name: "Review", detail: `${pendingReviews} pending` },
    { id: "plan", name: "Plan", detail: `${moves.length} priority moves` },
    { id: "report", name: "Report", detail: `${reports.length} versions` },
  ];
  const nextStage = !sources.length
    ? "research"
    : !verifications.length
      ? "verify"
      : !approvedFindingCount || pendingReviews
        ? "review"
        : !moves.length
          ? "plan"
          : "report";

  return (
    <div className="audit-studio space-y-6">
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

      <div className="audit-next">
        <div>
          <span className="audit-eyebrow">Suggested next step</span>
          <p>
            {nextStage === "research"
              ? "Collect public evidence for this author."
              : nextStage === "verify"
                ? "Verify the important book and retailer information."
                : nextStage === "review"
                  ? "Generate and review findings before building a plan."
                  : nextStage === "plan"
                    ? "Build a strategy from approved findings."
                    : "Check quality and preview the client report."}
          </p>
        </div>
        <button type="button" onClick={() => setStage(nextStage)}>
          Open {stages.find((s) => s.id === nextStage)?.name} →
        </button>
      </div>
      <nav className="audit-stages" aria-label="Audit workflow">
        {stages.map((s, index) => (
          <button
            key={s.id}
            type="button"
            aria-current={stage === s.id ? "step" : undefined}
            onClick={() => setStage(s.id)}
          >
            <span className="audit-stage-number">{index + 1}</span>
            <span>
              <strong>{s.name}</strong>
              <small>{s.detail}</small>
            </span>
          </button>
        ))}
      </nav>
      <div hidden={stage !== "report"}>
        <label className="block rounded-2xl border border-border bg-card p-5">
          <span className="text-sm font-medium">Prepared by (staff member)</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            Shown on the cover of the client report. Leave blank to show HQ360 only.
          </span>
          <input
            className={cn(input, "mt-2")}
            defaultValue={audit.prepared_by_staff_name ?? ""}
            onBlur={(e) => void setStaffName(e.target.value)}
          />
        </label>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {busy ? (
        <p role="status" className="audit-busy">
          Working on{" "}
          {busy === "research" ? "research" : busy === "plan" ? "your strategic plan" : "findings"}…
          You can explore the other stages while this completes.
        </p>
      ) : null}
      <div hidden={stage !== "research"} className="space-y-6">
        <ResearchSection
          sources={sources}
          busy={busy === "research"}
          onRun={() => void runResearch()}
        />

        <EvidenceAssetsSection auditId={id} assets={evidenceAssets} onSaved={load} />
      </div>
      <div hidden={stage !== "verify"}>
        <VerificationForm auditId={id} existing={verifications} onSaved={load} />
      </div>
      <div hidden={stage !== "review"} className="space-y-6">
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg">Generate findings</h3>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void runSynthesis()}
              className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
            >
              {busy === "synthesize" ? "Synthesizing…" : "Generate findings (AI)"}
            </button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Sends the research above to Claude for findings, strengths and reader-journey analysis —
            all unreviewed until approved below.
          </p>
        </section>

        {strengths.length > 0 ? (
          <StrengthsSection auditId={id} strengths={strengths} onSaved={load} />
        ) : null}

        {readerJourney.length > 0 ? (
          <ReaderJourneySection auditId={id} steps={readerJourney} onSaved={load} />
        ) : null}

        <ComparablesSection auditId={id} comparables={comparables} onSaved={load} />

        {findings.length > 0 ? (
          <section className="space-y-3">
            <h3 className="font-display text-lg">Findings — review before sending</h3>
            {findings.map((f) => (
              <FindingCard key={f.id} auditId={id} finding={f} onSaved={load} />
            ))}
          </section>
        ) : null}
      </div>
      <div hidden={stage !== "plan"} className="space-y-6">
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg">Strategic plan</h3>
            <button
              type="button"
              disabled={busy !== null || approvedFindingCount === 0}
              onClick={() => void runPlan()}
              className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
            >
              {busy === "plan" ? "Generating…" : "Generate strategic plan (AI)"}
            </button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {approvedFindingCount === 0
              ? "Approve at least one finding above first — the executive assessment, 3 moves and roadmap are only built from what's already approved."
              : `Builds the executive assessment, 3 moves and 30-day roadmap from the ${approvedFindingCount} approved finding(s) above.`}
          </p>
        </section>

        {audit.executive_assessment ? (
          <ExecutiveAssessmentSection
            auditId={id}
            assessment={audit.executive_assessment}
            reviewStatus={audit.executive_assessment_review_status}
            clientVisible={audit.executive_assessment_client_visible}
            onSaved={load}
          />
        ) : null}

        {moves.length > 0 ? <MovesSection auditId={id} moves={moves} onSaved={load} /> : null}
        {roadmap.length > 0 ? <RoadmapSection auditId={id} items={roadmap} onSaved={load} /> : null}
      </div>
      <div hidden={stage !== "report"} className="space-y-6">
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg">Quality check</h3>
            <button
              type="button"
              onClick={() => void loadQuality()}
              className="rounded-full border border-border px-4 py-1.5 text-xs font-medium hover:border-brand hover:text-brand"
            >
              Run check
            </button>
          </div>
          {quality ? (
            <div className="mt-3 space-y-2">
              <p
                className={cn(
                  "text-sm font-medium",
                  quality.passed ? "text-emerald-700" : "text-destructive",
                )}
              >
                {quality.passed
                  ? "Passed — ready to generate a final report."
                  : "Blocked — fix the issues below."}
              </p>
              {quality.issues.map((i, idx) => (
                <p key={idx} className="text-xs text-destructive">
                  [{i.area}] {i.message}
                </p>
              ))}
              {quality.warnings.map((w, idx) => (
                <p key={idx} className="text-xs text-amber-700">
                  [{w.area}] {w.message}
                </p>
              ))}
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <h3 className="font-display text-lg">Client report</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Preview shows exactly what the author would receive without the quality gate or saving a
            version. Generating a final report requires the quality check to pass.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href={`/api/admin/author-audits/${id}/report?format=pdf&mode=preview`}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-border px-5 py-2 text-sm font-medium hover:border-brand hover:text-brand"
            >
              Preview PDF
            </a>
            <a
              href={`/api/admin/author-audits/${id}/report?format=image&mode=preview`}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-border px-5 py-2 text-sm font-medium hover:border-brand hover:text-brand"
            >
              Preview image
            </a>
            <a
              href={`/api/admin/author-audits/${id}/report?format=pdf`}
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
            >
              Generate final PDF
            </a>
            <a
              href={`/api/admin/author-audits/${id}/report?format=image`}
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
            >
              Generate final image
            </a>
          </div>
          {reports.length > 0 ? (
            <div className="mt-5 border-t border-border pt-4">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Report history
              </p>
              <ul className="mt-2 space-y-1.5">
                {reports.map((r) => (
                  <li key={r.id} className="flex items-center gap-2 text-xs">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 font-medium",
                        r.outdated
                          ? "bg-secondary text-muted-foreground line-through"
                          : "bg-brand-soft text-[oklch(0.42_0.16_42)]",
                      )}
                    >
                      {r.format} v{r.version}
                    </span>
                    <span className="text-muted-foreground">
                      {new Date(r.generated_at).toLocaleString()}
                      {r.generated_by ? ` · ${r.generated_by}` : ""}
                      {r.outdated ? " · outdated" : ""}
                    </span>
                    <a
                      href={r.storage_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-brand underline"
                    >
                      open
                    </a>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(r.storage_url);
                          setCopiedReportId(r.id);
                          setTimeout(() => setCopiedReportId(null), 2000);
                        } catch {
                          /* clipboard unavailable; the "open" link still works */
                        }
                      }}
                      className="text-brand underline"
                    >
                      {copiedReportId === r.id ? "copied" : "copy link"}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </div>
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

/* ------------------------------------------------------------- research */

function ResearchSection({
  sources,
  busy,
  onRun,
}: {
  sources: AuditSource[];
  busy: boolean;
  onRun: () => void;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg">Automated research</h3>
        <button
          type="button"
          disabled={busy}
          onClick={onRun}
          className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
        >
          {busy ? "Running…" : "Run automated research"}
        </button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Google Books, Open Library and a direct website check. Amazon, Goodreads, search visibility,
        social and media have no reliable free API — fill those in below.
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
  );
}

/* --------------------------------------------------------- manual verification */

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

  return (
    <form onSubmit={save} className="rounded-2xl border border-border bg-card p-5">
      <h3 className="font-display text-lg">Manual verification</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Look these up by hand and enter what you actually find. Leave blank if not checked — blank
        fields are treated as unverified, never guessed.
      </p>
      <div className="mt-4 space-y-6">
        {VERIFICATION_SECTIONS.map((section) => (
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

/* ----------------------------------------------------------------- strengths */

function StrengthsSection({
  auditId,
  strengths,
  onSaved,
}: {
  auditId: string;
  strengths: AuditStrength[];
  onSaved: () => void;
}) {
  return (
    <section className="space-y-3">
      <h3 className="font-display text-lg">What is already working</h3>
      {strengths.map((s) => (
        <StrengthCard key={s.id} auditId={auditId} strength={s} onSaved={onSaved} />
      ))}
    </section>
  );
}

function StrengthCard({
  auditId,
  strength,
  onSaved,
}: {
  auditId: string;
  strength: AuditStrength;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState({ title: strength.title, observation: strength.observation });

  async function patch(body: Record<string, unknown>) {
    await api(`/api/admin/author-audits/${auditId}/strengths/${strength.id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    onSaved();
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <input
        className={cn(input, "font-medium")}
        value={draft.title}
        onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
        onBlur={() => void patch({ title: draft.title })}
      />
      <textarea
        rows={2}
        className={cn(input, "mt-2 resize-y")}
        value={draft.observation}
        onChange={(e) => setDraft((d) => ({ ...d, observation: e.target.value }))}
        onBlur={() => void patch({ observation: draft.observation })}
      />
      {strength.evidence ? (
        <p className="mt-2 text-xs text-muted-foreground">Evidence: {strength.evidence}</p>
      ) : null}
      <div className="mt-3 flex gap-2 text-xs">
        {(["preserve", "build_upon", "no_change_needed"] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => void patch({ disposition: d })}
            className={cn(
              "rounded-full border px-3 py-1 font-medium",
              strength.disposition === d
                ? "border-brand text-brand"
                : "border-border text-muted-foreground",
            )}
          >
            {d === "preserve" ? "Preserve" : d === "build_upon" ? "Build upon" : "No change needed"}
          </button>
        ))}
      </div>
      <ReviewBar
        reviewStatus={strength.review_status}
        clientVisible={strength.client_visible}
        onChange={(patch2) => void patch(patch2)}
      />
    </div>
  );
}

/* ------------------------------------------------------------ reader journey */

function ReaderJourneySection({
  auditId,
  steps,
  onSaved,
}: {
  auditId: string;
  steps: AuditReaderJourneyStep[];
  onSaved: () => void;
}) {
  const ordered = READER_JOURNEY_STAGE_ORDER.map((stage) =>
    steps.find((s) => s.stage === stage),
  ).filter((s): s is AuditReaderJourneyStep => !!s);
  return (
    <section className="space-y-3">
      <h3 className="font-display text-lg">Reader journey</h3>
      <p className="text-xs text-muted-foreground">
        Discovery → Interest → Trust → Book information → Purchase → Follow → Owned audience → Next
        book.
      </p>
      {ordered.map((step) => (
        <ReaderJourneyCard key={step.id} auditId={auditId} step={step} onSaved={onSaved} />
      ))}
    </section>
  );
}

function ReaderJourneyCard({
  auditId,
  step,
  onSaved,
}: {
  auditId: string;
  step: AuditReaderJourneyStep;
  onSaved: () => void;
}) {
  async function patch(body: Record<string, unknown>) {
    await api(`/api/admin/author-audits/${auditId}/reader-journey/${step.id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    onSaved();
  }
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{READER_JOURNEY_STAGE_LABEL[step.stage]}</p>
        <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium capitalize">
          {step.status.replace(/_/g, " ")}
        </span>
      </div>
      <p className="mt-2 text-sm">{step.observation}</p>
      {step.friction ? (
        <p className="mt-1 text-xs text-amber-700">Friction: {step.friction}</p>
      ) : null}
      {step.recommendation ? (
        <p className="mt-1 text-xs text-muted-foreground">Recommendation: {step.recommendation}</p>
      ) : null}
      <ReviewBar
        reviewStatus={step.review_status}
        clientVisible={step.client_visible}
        onChange={(patch2) => void patch(patch2)}
      />
    </div>
  );
}

/* -------------------------------------------------------------- comparables */

function ComparablesSection({
  auditId,
  comparables,
  onSaved,
}: {
  auditId: string;
  comparables: AuditComparable[];
  onSaved: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ author: "", book: "", whyComparable: "" });
  const [saving, setSaving] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.author.trim() || !draft.whyComparable.trim()) return;
    setSaving(true);
    await api(`/api/admin/author-audits/${auditId}/comparables`, {
      method: "POST",
      body: JSON.stringify(draft),
    });
    setSaving(false);
    setDraft({ author: "", book: "", whyComparable: "" });
    setAdding(false);
    onSaved();
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg">Comparable market analysis</h3>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="rounded-full border border-border px-4 py-1.5 text-xs font-medium hover:border-brand hover:text-brand"
        >
          {adding ? "Cancel" : "Add comparable"}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        Staff-entered only — no automated discovery source is connected, and inventing one would
        break the audit's no-fabrication rule. Look for patterns across 3-5, not a ranking.
      </p>
      {adding ? (
        <form onSubmit={create} className="rounded-2xl border border-border bg-card p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Author</span>
              <input
                className={cn(input, "mt-1")}
                value={draft.author}
                onChange={(e) => setDraft((d) => ({ ...d, author: e.target.value }))}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Book</span>
              <input
                className={cn(input, "mt-1")}
                value={draft.book}
                onChange={(e) => setDraft((d) => ({ ...d, book: e.target.value }))}
              />
            </label>
          </div>
          <label className="mt-3 block">
            <span className="text-xs font-medium text-muted-foreground">
              Why this is comparable
            </span>
            <textarea
              rows={2}
              className={cn(input, "mt-1 resize-y")}
              value={draft.whyComparable}
              onChange={(e) => setDraft((d) => ({ ...d, whyComparable: e.target.value }))}
            />
          </label>
          <button
            type="submit"
            disabled={saving}
            className="mt-3 rounded-full bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60"
          >
            {saving ? "Adding…" : "Add"}
          </button>
        </form>
      ) : null}
      {comparables.map((c) => (
        <ComparableCard key={c.id} auditId={auditId} comparable={c} onSaved={onSaved} />
      ))}
    </section>
  );
}

function ComparableCard({
  auditId,
  comparable,
  onSaved,
}: {
  auditId: string;
  comparable: AuditComparable;
  onSaved: () => void;
}) {
  async function patch(body: Record<string, unknown>) {
    await api(`/api/admin/author-audits/${auditId}/comparables/${comparable.id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    onSaved();
  }
  async function remove() {
    if (!window.confirm("Remove this comparable?")) return;
    await api(`/api/admin/author-audits/${auditId}/comparables/${comparable.id}`, {
      method: "DELETE",
    });
    onSaved();
  }
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">
            {comparable.author}
            {comparable.book ? ` — ${comparable.book}` : ""}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{comparable.why_comparable}</p>
        </div>
        <button type="button" onClick={() => void remove()} className="text-xs text-destructive">
          Remove
        </button>
      </div>
      <ReviewBar
        reviewStatus={comparable.review_status}
        clientVisible={comparable.client_visible}
        onChange={(patch2) => void patch(patch2)}
      />
    </div>
  );
}

/* ----------------------------------------------------------------- findings */

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
    sourceUrls: finding.source_urls.join("\n"),
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
        <div>
          <p className="text-sm font-semibold">
            {finding.title ?? finding.category ?? finding.section}
          </p>
          <p className="text-xs text-muted-foreground">{finding.category ?? finding.section}</p>
        </div>
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
      <label className="mt-3 block">
        <span className="text-xs font-medium text-muted-foreground">
          Source URLs — one per line
        </span>
        <span className="block text-[0.65rem] text-muted-foreground">
          Required for a needs-attention/critical finding to be client-visible — the quality check
          blocks anything unsourced.
        </span>
        <textarea
          rows={2}
          className={cn(input, "mt-1 resize-y")}
          placeholder="https://…"
          value={draft.sourceUrls}
          onChange={(e) => setDraft((d) => ({ ...d, sourceUrls: e.target.value }))}
        />
      </label>

      <div className="mt-3">
        <button
          type="button"
          disabled={saving}
          onClick={() =>
            void patch({
              observation: draft.observation,
              whyItMatters: draft.whyItMatters || null,
              recommendation: draft.recommendation || null,
              sourceUrls: draft.sourceUrls
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
          className="rounded-full border border-border px-4 py-1.5 text-xs font-medium hover:border-brand hover:text-brand"
        >
          Save edits
        </button>
      </div>
      <ReviewBar
        reviewStatus={finding.review_status}
        clientVisible={finding.client_visible}
        onChange={(patch2) => void patch(patch2)}
      />
    </div>
  );
}

/* ----------------------------------------------------- executive assessment */

const ASSESSMENT_FIELDS: { key: keyof ExecutiveAssessment; label: string }[] = [
  { key: "whatIsWorking", label: "What is already working" },
  { key: "strongestOpportunities", label: "Strongest verified opportunities" },
  { key: "journeyBreaks", label: "Where the reader journey breaks or weakens" },
  { key: "comparablePatterns", label: "Patterns from comparables" },
  { key: "priorityFirst", label: "What deserves attention first" },
  { key: "doNotChange", label: "What should not be changed" },
  { key: "unknowns", label: "What remains unknown or unverifiable" },
];

function ExecutiveAssessmentSection({
  auditId,
  assessment,
  reviewStatus,
  clientVisible,
  onSaved,
}: {
  auditId: string;
  assessment: ExecutiveAssessment;
  reviewStatus: ReviewStatus;
  clientVisible: boolean;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<ExecutiveAssessment>({ ...EMPTY_ASSESSMENT, ...assessment });

  useEffect(() => setDraft({ ...EMPTY_ASSESSMENT, ...assessment }), [assessment]);

  async function save() {
    await api(`/api/admin/author-audits/${auditId}`, {
      method: "PATCH",
      body: JSON.stringify({ executiveAssessment: draft }),
    });
    onSaved();
  }

  async function reviewPatch(patch: { reviewStatus?: ReviewStatus; clientVisible?: boolean }) {
    await api(`/api/admin/author-audits/${auditId}`, {
      method: "PATCH",
      body: JSON.stringify({
        ...(patch.reviewStatus ? { executiveAssessmentReviewStatus: patch.reviewStatus } : {}),
        ...(patch.clientVisible !== undefined
          ? { executiveAssessmentClientVisible: patch.clientVisible }
          : {}),
      }),
    });
    onSaved();
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h3 className="font-display text-lg">Executive assessment</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Claude drafted this from approved findings — read and edit before it goes in front of the
        client.
      </p>
      <div className="mt-4 space-y-4">
        {ASSESSMENT_FIELDS.map((f) => (
          <label key={f.key} className="block">
            <span className="text-xs font-medium text-muted-foreground">{f.label}</span>
            <textarea
              rows={2}
              className={cn(input, "mt-1 resize-y")}
              value={draft[f.key]}
              onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
            />
          </label>
        ))}
      </div>
      <button
        type="button"
        onClick={() => void save()}
        className="mt-4 rounded-full border border-border px-4 py-1.5 text-xs font-medium hover:border-brand hover:text-brand"
      >
        Save edits
      </button>
      <ReviewBar
        reviewStatus={reviewStatus}
        clientVisible={clientVisible}
        onChange={(p) => void reviewPatch(p)}
      />
    </section>
  );
}

/* ---------------------------------------------------------------- 3 moves */

function MovesSection({
  auditId,
  moves,
  onSaved,
}: {
  auditId: string;
  moves: AuditPriorityMove[];
  onSaved: () => void;
}) {
  return (
    <section className="space-y-3">
      <h3 className="font-display text-lg">The 3 moves we would make first</h3>
      {[...moves]
        .sort((a, b) => a.rank - b.rank)
        .map((m) => (
          <MoveCard key={m.id} auditId={auditId} move={m} onSaved={onSaved} />
        ))}
    </section>
  );
}

function MoveCard({
  auditId,
  move,
  onSaved,
}: {
  auditId: string;
  move: AuditPriorityMove;
  onSaved: () => void;
}) {
  async function patch(body: Record<string, unknown>) {
    await api(`/api/admin/author-audits/${auditId}/moves/${move.id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    onSaved();
  }
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="font-display text-base">
        Move {move.rank} — {move.title}
      </p>
      <p className="mt-2 text-xs font-medium text-muted-foreground uppercase">What we found</p>
      <p className="text-sm">{move.what_we_found}</p>
      <p className="mt-2 text-xs font-medium text-muted-foreground uppercase">
        What we would change
      </p>
      <p className="text-sm">{move.what_we_would_change}</p>
      <p className="mt-2 text-xs font-medium text-muted-foreground uppercase">
        Why this comes first
      </p>
      <p className="text-sm">{move.why_first}</p>
      <ReviewBar
        reviewStatus={move.review_status}
        clientVisible={move.client_visible}
        onChange={(patch2) => void patch(patch2)}
      />
    </div>
  );
}

/* ------------------------------------------------------------ 30-day roadmap */

function RoadmapSection({
  auditId,
  items,
  onSaved,
}: {
  auditId: string;
  items: AuditRoadmapItem[];
  onSaved: () => void;
}) {
  const byWeek = new Map<number, AuditRoadmapItem[]>();
  for (const item of items) byWeek.set(item.week, [...(byWeek.get(item.week) ?? []), item]);
  return (
    <section className="space-y-3">
      <h3 className="font-display text-lg">30-day action roadmap</h3>
      {[...byWeek.entries()].map(([week, weekItems]) => (
        <div key={week} className="rounded-2xl border border-border bg-card p-5">
          <p className="font-display text-base">Week {week}</p>
          <div className="mt-3 space-y-3">
            {weekItems.map((item) => (
              <RoadmapItemRow key={item.id} auditId={auditId} item={item} onSaved={onSaved} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function RoadmapItemRow({
  auditId,
  item,
  onSaved,
}: {
  auditId: string;
  item: AuditRoadmapItem;
  onSaved: () => void;
}) {
  async function patch(body: Record<string, unknown>) {
    await api(`/api/admin/author-audits/${auditId}/roadmap/${item.id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    onSaved();
  }
  return (
    <div className="border-t border-border pt-3 first:border-t-0 first:pt-0">
      <p className="text-sm">{item.action}</p>
      {item.completion_indicator ? (
        <p className="mt-1 text-xs text-muted-foreground">Done when: {item.completion_indicator}</p>
      ) : null}
      <ReviewBar
        reviewStatus={item.review_status}
        clientVisible={item.client_visible}
        onChange={(patch2) => void patch(patch2)}
      />
    </div>
  );
}

/* ------------------------------------------------------------ evidence assets */

function EvidenceAssetsSection({
  auditId,
  assets,
  onSaved,
}: {
  auditId: string;
  assets: AuditEvidenceAsset[];
  onSaved: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const { url } = await uploadAdminMedia(file, "audit-evidence");
      await api(`/api/admin/author-audits/${auditId}/evidence-assets`, {
        method: "POST",
        body: JSON.stringify({ storageUrl: url }),
      });
      onSaved();
    } catch {
      setError("Upload failed.");
    }
    setUploading(false);
    e.target.value = "";
  }

  async function patch(assetId: string, body: Record<string, unknown>) {
    await api(`/api/admin/author-audits/${auditId}/evidence-assets/${assetId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    onSaved();
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h3 className="font-display text-lg">Visual evidence</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Manual upload only — no automated screenshots of platforms that restrict scraping (Amazon,
        Goodreads, social).
      </p>
      <input
        type="file"
        accept="image/*"
        disabled={uploading}
        onChange={onFile}
        className="mt-3 block text-sm"
      />
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
      {assets.length > 0 ? (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {assets.map((a) => (
            <li key={a.id} className="rounded-xl border border-border p-3">
              <img
                src={a.storage_url}
                alt={a.caption ?? "Evidence"}
                className="w-full rounded-lg object-cover"
              />
              <input
                className={cn(input, "mt-2")}
                placeholder="Caption"
                defaultValue={a.caption ?? ""}
                onBlur={(e) => void patch(a.id, { caption: e.target.value })}
              />
              <label className="mt-2 flex items-center gap-2 text-xs font-medium">
                <input
                  type="checkbox"
                  checked={a.client_visible}
                  onChange={(e) => void patch(a.id, { clientVisible: e.target.checked })}
                  className="size-4 accent-[var(--brand)]"
                />
                Client visible
              </label>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
