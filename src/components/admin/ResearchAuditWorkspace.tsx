import { useEffect, useState, type ReactNode } from "react";
import { GlassLoading } from "@/components/ui/glass-loading";
import { ResearchAuditReport } from "@/components/site/ResearchAuditReport";
import {
  CLASSIFICATIONS,
  label,
  reviewIssues,
  type WorkflowState,
  type Finding,
  type Section,
  type Listopia,
  type Asset,
  type Task,
  type Action,
} from "@/lib/author-audit/workflow";
import type { WorkflowSnapshot } from "@/lib/author-audit/workflow.server";
const field = "mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm";
const btn =
  "rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-40";
const primary = `${btn} !bg-primary text-primary-foreground`;
const card = "rounded-2xl border border-border bg-card p-5 sm:p-6";
const tabs = [
  "Overview",
  "Research",
  "Findings",
  "Goodreads",
  "Amazon",
  "Website",
  "Screenshots",
  "Manual Review",
  "Action Plan",
  "Client Site",
  "History",
];
type Entity = "finding" | "section" | "listopia" | "task" | "action" | "asset";
type Values = Record<string, unknown>;
type Field = {
  key: string;
  title: string;
  kind?: "long" | "lines" | "number" | "bool" | "date";
  options?: string[];
};
const findingFields: Field[] = [
  { key: "title", title: "Finding title" },
  { key: "category", title: "Category / section key" },
  { key: "classification", title: "Classification", options: [...CLASSIFICATIONS] },
  {
    key: "priority",
    title: "Priority",
    options: ["immediate", "high_impact", "medium_priority", "long_term", "optional"],
  },
  ...["impact_score", "effort_score", "confidence_score"].map((key) => ({
    key,
    title: label(key),
    kind: "number" as const,
  })),
  ...[
    "what_we_checked",
    "what_we_found",
    "evidence",
    "interpretation",
    "why_it_matters",
    "recommendation",
  ].map((key) => ({ key, title: label(key), kind: "long" as const })),
  { key: "source_urls", title: "Source URLs (one per line)", kind: "lines" },
  { key: "implementation_steps", title: "Implementation steps (one per line)", kind: "lines" },
  { key: "service_match", title: "HQ360 service match" },
  {
    key: "manual_status",
    title: "Manual verification",
    options: ["pending", "verified", "not_applicable"],
  },
  { key: "reviewer_notes", title: "Reviewer notes (internal)", kind: "long" },
  { key: "hidden", title: "Hide from client", kind: "bool" },
  { key: "featured", title: "Featured finding", kind: "bool" },
];
const listFields: Field[] = [
  { key: "list_name", title: "List name" },
  { key: "list_url", title: "List URL" },
  { key: "book_present", title: "Book present", options: ["unknown", "yes", "no"] },
  ...["position", "page", "votes", "number_of_books", "relevance_score"].map((key) => ({
    key,
    title: label(key),
    kind: "number" as const,
  })),
  { key: "competition", title: "Competition", options: ["unknown", "low", "medium", "high"] },
  { key: "books_above", title: "Books above (one per line)", kind: "lines" },
  { key: "books_below", title: "Books below (one per line)", kind: "lines" },
  ...["why_position", "how_to_improve", "evidence", "reviewer_notes"].map((key) => ({
    key,
    title: label(key),
    kind: "long" as const,
  })),
  {
    key: "manual_status",
    title: "Manual verification",
    options: ["pending", "verified", "not_applicable"],
  },
];
const assetFields: Field[] = [
  { key: "category", title: "Category" },
  { key: "finding_id", title: "Finding ID (optional)" },
  { key: "listopia_id", title: "Listopia list ID (optional)" },
  { key: "task_id", title: "Screenshot request ID (optional)" },
  { key: "caption", title: "Caption" },
  { key: "proves", title: "What it proves", kind: "long" },
  { key: "source", title: "Source URL" },
  { key: "asset_date", title: "Capture date", kind: "date" },
  { key: "display_kind", title: "Screenshot kind", options: ["before", "current", "recommended"] },
  { key: "sort_order", title: "Display order", kind: "number" },
];
const actionFields: Field[] = [
  { key: "title", title: "Action title" },
  { key: "description", title: "Reason and implementation", kind: "long" },
  {
    key: "horizon",
    title: "Timeline",
    options: ["do_first", "next_30_days", "next_90_days", "long_term"],
  },
  { key: "finding_ids", title: "Supporting finding IDs (one per line)", kind: "lines" },
  { key: "service", title: "HQ360 service (optional)" },
  { key: "sort_order", title: "Display order", kind: "number" },
];
const defaultFinding = {
  title: "",
  category: "website_audit",
  classification: "unknown",
  priority: "medium_priority",
  what_we_checked: "",
  what_we_found: "",
  evidence: "",
  source_urls: [],
  interpretation: "",
  why_it_matters: "",
  recommendation: "",
  implementation_steps: [],
  impact_score: null,
  effort_score: null,
  confidence_score: null,
  service_match: "",
  manual_status: "pending",
  reviewer_notes: "",
  hidden: false,
  featured: false,
  review_status: "ai_research",
};
function Badge({ value }: { value: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${value === "approved" || value === "verified" ? "bg-emerald-500/10 text-emerald-600" : value === "rejected" ? "bg-destructive/10 text-destructive" : "bg-secondary text-muted-foreground"}`}
    >
      {label(
        value === "ai_research"
          ? "pending"
          : value === "needs_verification"
            ? "needs_changes"
            : value,
      )}
    </span>
  );
}
function Editor({
  fields,
  initial,
  onSave,
  onCancel,
  busy,
}: {
  fields: Field[];
  initial: Values;
  onSave: (v: Values) => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const [values, setValues] = useState<Values>(initial);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(values);
      }}
      className="space-y-5 rounded-2xl border border-primary/20 bg-secondary/20 p-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((f) => (
          <label
            className={`text-sm ${f.kind === "long" || f.kind === "lines" ? "sm:col-span-2" : ""}`}
            key={f.key}
          >
            {f.title}
            {f.kind === "bool" ? (
              <input
                aria-label={f.title}
                className="ml-3"
                type="checkbox"
                checked={!!values[f.key]}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.checked }))}
              />
            ) : f.options ? (
              <select
                aria-label={f.title}
                className={field}
                value={
                  f.key === "book_present"
                    ? values[f.key] === null
                      ? "unknown"
                      : values[f.key]
                        ? "yes"
                        : "no"
                    : String(values[f.key] ?? f.options[0])
                }
                onChange={(e) =>
                  setValues((v) => ({
                    ...v,
                    [f.key]:
                      f.key === "book_present"
                        ? e.target.value === "unknown"
                          ? null
                          : e.target.value === "yes"
                        : e.target.value,
                  }))
                }
              >
                {f.options.map((o) => (
                  <option key={o} value={o}>
                    {label(o)}
                  </option>
                ))}
              </select>
            ) : f.kind === "long" || f.kind === "lines" ? (
              <textarea
                aria-label={f.title}
                className={field}
                rows={3}
                value={
                  f.kind === "lines"
                    ? ((values[f.key] as string[]) ?? []).join("\n")
                    : String(values[f.key] ?? "")
                }
                onChange={(e) =>
                  setValues((v) => ({
                    ...v,
                    [f.key]: f.kind === "lines" ? e.target.value.split("\n") : e.target.value,
                  }))
                }
              />
            ) : (
              <input
                aria-label={f.title}
                className={field}
                type={f.kind === "number" ? "number" : f.kind === "date" ? "date" : "text"}
                min={f.kind === "number" ? 0 : undefined}
                value={String(values[f.key] ?? "")}
                onChange={(e) =>
                  setValues((v) => ({
                    ...v,
                    [f.key]:
                      f.kind === "number"
                        ? e.target.value === ""
                          ? null
                          : Number(e.target.value)
                        : e.target.value,
                  }))
                }
              />
            )}
          </label>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Saving changes returns this item to review. Approve it after checking the saved details.
      </p>
      <div className="flex gap-2">
        <button className={primary} disabled={busy}>
          Save changes
        </button>
        <button type="button" className={btn} onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  );
}
export function ResearchAuditWorkspace({
  id,
  onBack,
  legacy,
}: {
  id: string;
  onBack: () => void;
  legacy: ReactNode;
}) {
  const [data, setData] = useState<WorkflowState | null>(null),
    [tab, setTab] = useState("Overview"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(""),
    [notice, setNotice] = useState(""),
    [raw, setRaw] = useState(""),
    [source, setSource] = useState("Claude"),
    [searchFocus, setSearchFocus] = useState(""),
    [searchedSources, setSearchedSources] = useState<
      { title: string; url: string; excerpt: string; provider: string; retrievedAt: string }[]
    >([]),
    [validation, setValidation] = useState<{
      valid: boolean;
      errors: string[];
      data?: { findings: Finding[]; sections: Section[]; listopia: Listopia[]; tasks: Task[] };
    } | null>(null),
    [editing, setEditing] = useState<{ entity: Entity; id?: string; values: Values } | null>(null),
    [template, setTemplate] = useState(""),
    [preview, setPreview] = useState<WorkflowSnapshot | null>(null),
    [version, setVersion] = useState(""),
    [changeNotes, setChangeNotes] = useState(""),
    [override, setOverride] = useState(""),
    [code, setCode] = useState(""),
    [expiry, setExpiry] = useState(""),
    [assignment, setAssignment] = useState(""),
    [assignmentRole, setAssignmentRole] = useState("expert");
  const base = `/api/admin/author-audits/${id}/workflow`;
  async function load() {
    const r = await fetch(base);
    const body = await r.json();
    if (!r.ok) throw new Error(body.error);
    setData(body);
    setTemplate(body.template);
    setSource(body.audit.research_source);
  }
  useEffect(() => {
    let active = true;
    void fetch(base)
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error);
        if (active) {
          setData(body);
          setTemplate(body.template);
          setSource(body.audit.research_source);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [base]);
  async function act(body: Values, refresh = true) {
    setBusy(label(String(body.action)) + "…");
    setError("");
    setNotice("");
    try {
      const r = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await r.json();
      if (!r.ok)
        throw new Error(
          [result.error, ...(result.issues ?? result.errors ?? [])].filter(Boolean).join("\n"),
        );
      if (result.code) setCode(result.code);
      if (result.versionId) {
        setVersion(result.versionId);
        setPreview(null);
      }
      if (refresh) await load();
      return result;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy("");
    }
  }
  async function moveSection(sectionId: string, direction: number) {
    if (!data) return;
    const ids = [...data.sections].sort((a, b) => a.sort_order - b.sort_order).map((s) => s.id);
    const index = ids.indexOf(sectionId),
      next = index + direction;
    if (index < 0 || next < 0 || next >= ids.length) return;
    [ids[index], ids[next]] = [ids[next]!, ids[index]!];
    await act({ action: "reorder", ids });
  }
  async function saveEditor(values: Values) {
    if (!editing) return;
    const clean = { ...values };
    for (const key of [
      "source_urls",
      "implementation_steps",
      "books_above",
      "books_below",
      "finding_ids",
    ])
      if (Array.isArray(clean[key]))
        clean[key] = (clean[key] as string[]).map((x) => x.trim()).filter(Boolean);
    for (const key of ["finding_id", "task_id", "listopia_id"])
      if (key in clean) clean[key] = clean[key] || null;
    clean.review_status = editing.entity === "finding" ? "needs_verification" : "pending";
    if (!data?.permissions.review && "manual_status" in clean) clean.manual_status = "pending";
    if (await act({ action: "save", entity: editing.entity, id: editing.id, values: clean }))
      setEditing(null);
  }
  function edit(
    entity: Entity,
    values: Finding | Section | Listopia | Task | Asset | Action | Values,
  ) {
    setEditing({
      entity,
      ...("id" in values ? { id: String(values.id) } : {}),
      values: { ...values },
    });
  }
  async function upload(file: File, taskId?: string, findingId?: string) {
    setBusy("Uploading evidence…");
    setError("");
    try {
      const form = new FormData();
      form.set("file", file);
      if (taskId) form.set("taskId", taskId);
      if (findingId) form.set("findingId", findingId);
      const r = await fetch(base, { method: "POST", body: form });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function showPreview() {
    setBusy("Preparing preview…");
    setError("");
    try {
      const r = await fetch(`${base}?version=${version}`);
      const result = await r.json();
      if (!r.ok) throw new Error(result.error);
      setPreview(result.snapshot);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  function download(text: string, name: string) {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const reviewButtons = (entity: Entity, value: Finding | Section | Listopia | Action | Asset) => (
    <div className="flex flex-wrap gap-2">
      <button className={btn} disabled={!!busy} onClick={() => edit(entity, value)}>
        Edit
      </button>
      {data?.permissions.review && (
        <>
          <button
            className={btn}
            disabled={!!busy}
            onClick={() =>
              void act({
                action: "save",
                entity,
                id: value.id,
                approve: true,
                values: { ...value, review_status: "approved" },
              })
            }
          >
            Approve
          </button>
          <button
            className={btn}
            disabled={!!busy}
            onClick={() =>
              void act({
                action: "save",
                entity,
                id: value.id,
                values: { ...value, review_status: "rejected" },
              })
            }
          >
            Reject
          </button>
        </>
      )}
      <button
        className={btn}
        disabled={!!busy}
        onClick={() => void act({ action: "delete", entity, id: value.id })}
      >
        Delete
      </button>
    </div>
  );
  if (!data)
    return (
      <div className="space-y-4 p-6">
        <button className={btn} onClick={onBack}>
          Back to audits
        </button>
        {error ? (
          <p role="alert">{error}</p>
        ) : (
          <GlassLoading label="Opening research workspace…" cards />
        )}
      </div>
    );
  if (data.audit.workflow_version !== 1) return <>{legacy}</>;
  const sourceList = searchedSources.length
    ? searchedSources
    : data.sources.map((item) => ({
        url: item.url,
        provider: item.provider,
        title: item.raw_data.title ?? item.url,
        excerpt: item.raw_data.excerpt ?? "",
        retrievedAt: item.retrieved_at,
      }));
  const issues = reviewIssues(data),
    findings = data.findings.filter((f) =>
      tab === "Amazon"
        ? f.category.includes("amazon")
        : tab === "Website"
          ? f.category.includes("website") || f.category.includes("search")
          : true,
    );
  const editingFields =
    editing?.entity === "finding"
      ? findingFields
      : editing?.entity === "listopia"
        ? listFields
        : editing?.entity === "asset"
          ? assetFields
          : editing?.entity === "action"
            ? actionFields
            : editing?.entity === "section"
              ? [
                  { key: "key", title: "Section key" },
                  { key: "title", title: "Section name" },
                  { key: "content", title: "Reviewed section content", kind: "long" as const },
                  { key: "enabled", title: "Show section", kind: "bool" as const },
                  { key: "sort_order", title: "Display order", kind: "number" as const },
                ]
              : [
                  { key: "title", title: "Task title" },
                  { key: "category", title: "Category" },
                  {
                    key: "instructions",
                    title: "Capture / verification instructions",
                    kind: "long" as const,
                  },
                  { key: "required", title: "Required", kind: "bool" as const },
                  { key: "kind", title: "Task kind", options: ["manual", "screenshot"] },
                  { key: "notes", title: "Reviewer notes", kind: "long" as const },
                ];
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-8">
      <button className={btn} onClick={onBack} disabled={!!busy}>
        ← Audits
      </button>
      <header className="rounded-3xl border border-border bg-secondary/30 p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand">
          HQ360 · Research & review
        </p>
        <h1 className="mt-3 font-display text-3xl sm:text-4xl">{data.audit.books.title}</h1>
        <p className="mt-2 text-muted-foreground">{data.audit.authors.name}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge value={data.audit.status} />
          <Badge value={data.audit.review_status} />
          <span className="self-center text-xs text-muted-foreground">Audit {id}</span>
        </div>
        {data.access && (
          <p className="mt-4 text-sm text-muted-foreground">
            Edits here are draft revisions. The client continues seeing the last published version.
          </p>
        )}
      </header>
      <nav aria-label="Audit workflow" className="flex gap-2 overflow-x-auto pb-2">
        {tabs.map((t) => (
          <button
            key={t}
            className={`${btn} shrink-0 ${tab === t ? "!bg-primary text-primary-foreground" : ""}`}
            onClick={() => {
              setTab(t);
              setEditing(null);
            }}
          >
            {t}
          </button>
        ))}
      </nav>
      {error && (
        <p
          role="alert"
          className="whitespace-pre-line rounded-xl border border-destructive/30 p-4 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {busy && <GlassLoading label={busy} />}
      {editing && (
        <Editor
          key={`${editing.entity}-${editing.id ?? "new"}`}
          fields={editingFields}
          initial={editing.values}
          onSave={(v) => void saveEditor(v)}
          onCancel={() => setEditing(null)}
          busy={!!busy}
        />
      )}
      {tab === "Overview" && (
        <>
          {data.permissions.review && <FastApprove act={act} busy={!!busy} />}
          <section className={card}>
            <h2 className="text-xl font-semibold">Review progress</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {[
                [
                  "Research imported",
                  data.imports.length ? `${data.imports.length} imports` : "Pending",
                ],
                [
                  "Findings reviewed",
                  `${data.findings.filter((f) => ["approved", "rejected"].includes(f.review_status)).length} / ${data.findings.length}`,
                ],
                [
                  "Screenshots completed",
                  `${data.tasks.filter((t) => t.kind === "screenshot" && ["approved", "not_applicable"].includes(t.status)).length} / ${data.tasks.filter((t) => t.kind === "screenshot").length}`,
                ],
                [
                  "Manual checks pending",
                  data.tasks.filter(
                    (t) =>
                      t.kind === "manual" && !["approved", "not_applicable"].includes(t.status),
                  ).length,
                ],
                [
                  "Recommendations approved",
                  data.actions.filter((a) => a.review_status === "approved").length,
                ],
                [
                  "Client site ready",
                  issues.length ? `${issues.length} checks remain` : "Ready for QA",
                ],
              ].map(([title, value]) => (
                <div key={title} className="rounded-xl bg-secondary/50 p-4">
                  <strong className="text-2xl">{value}</strong>
                  <p className="mt-2 text-sm text-muted-foreground">{title}</p>
                </div>
              ))}
            </div>
            {data.permissions.review && (
              <button
                className={`${primary} mt-5`}
                disabled={!!busy}
                onClick={() => void act({ action: "approve" })}
              >
                Approve audit
              </button>
            )}
          </section>
          <section className={`${card} space-y-4`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Audit sections</h2>
              <button
                className={btn}
                onClick={() =>
                  edit("section", {
                    key: `custom_${Date.now()}`,
                    title: "Custom section",
                    content: "",
                    enabled: true,
                    sort_order: data.sections.length,
                    review_status: "pending",
                  })
                }
              >
                Add custom section
              </button>
            </div>
            {[...data.sections]
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((s, i) => (
                <div
                  key={s.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-4"
                >
                  <div className="min-w-40 flex-1">
                    <strong>{s.title}</strong>
                    <p className="text-xs text-muted-foreground">
                      {s.enabled ? "Enabled" : "Hidden"} · {s.key}
                    </p>
                  </div>
                  <Badge value={s.review_status} />
                  <button
                    aria-label={`Move ${s.title} up`}
                    className={btn}
                    disabled={!!busy || i === 0}
                    onClick={() => void moveSection(s.id, -1)}
                  >
                    ↑
                  </button>
                  <button
                    aria-label={`Move ${s.title} down`}
                    className={btn}
                    disabled={!!busy || i === data.sections.length - 1}
                    onClick={() => void moveSection(s.id, 1)}
                  >
                    ↓
                  </button>
                  {reviewButtons("section", s)}
                </div>
              ))}
          </section>
          {data.permissions.admin && (
            <section className={`${card} space-y-4`}>
              <h2 className="text-xl font-semibold">Assignments</h2>
              <p className="text-sm text-muted-foreground">
                Experts prepare assigned audits. Reviewers can approve their assigned audits. Only
                Admin publishes.
              </p>
              <div className="flex flex-wrap gap-3">
                <select
                  aria-label="Assign expert"
                  className={field}
                  value={assignment}
                  onChange={(e) => setAssignment(e.target.value)}
                >
                  <option value="">Choose an expert</option>
                  {data.experts.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.full_name || e.id}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Audit role"
                  className={field}
                  value={assignmentRole}
                  onChange={(e) => setAssignmentRole(e.target.value)}
                >
                  <option value="expert">Expert</option>
                  <option value="reviewer">Reviewer</option>
                </select>
                <button
                  className={btn}
                  disabled={!assignment || !!busy}
                  onClick={() =>
                    void act({ action: "assign", expertId: assignment, role: assignmentRole })
                  }
                >
                  Assign
                </button>
              </div>
              {data.assignments.map((a) => (
                <p key={a.expert_id} className="text-sm">
                  {data.experts.find((e) => e.id === a.expert_id)?.full_name ?? a.expert_id} ·{" "}
                  {label(a.role)}{" "}
                  <button
                    className="underline"
                    onClick={() =>
                      void act({ action: "assign", expertId: a.expert_id, remove: true })
                    }
                  >
                    Remove
                  </button>
                </p>
              ))}
            </section>
          )}
        </>
      )}
      {tab === "Research" && (
        <>
          <section className={`${card} space-y-4`}>
            <div>
              <h2 className="text-xl font-semibold">AI web research</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Search public web listings and book catalogues for this author and book. AI turns
                the collected results into a cited draft and imports it for review. Search snippets
                do not confirm live page details; verify important claims before approval.
              </p>
            </div>
            <label className="block text-sm">
              Search focus (optional)
              <input
                aria-label="AI search focus"
                className={field}
                maxLength={200}
                placeholder="e.g. reviews, website, reader community"
                value={searchFocus}
                onChange={(e) => setSearchFocus(e.target.value)}
              />
            </label>
            <button
              className={primary}
              disabled={!!busy}
              onClick={async () => {
                setBusy("Searching public sources and preparing an AI research draft…");
                setError("");
                setNotice("");
                setSearchedSources([]);
                try {
                  const response = await fetch(base, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "ai_search", focus: searchFocus }),
                  });
                  const result = await response.json();
                  if (Array.isArray(result.sources)) setSearchedSources(result.sources);
                  if (result.raw) {
                    setRaw(result.raw);
                    setValidation(null);
                  }
                  if (!response.ok) {
                    throw new Error(
                      [result.error, ...(result.errors ?? [])].filter(Boolean).join("\n") ||
                        "AI research could not be completed. Please retry.",
                    );
                  }
                  await load();
                  setNotice(
                    `Imported ${result.findings} draft findings from ${result.sources.length} public sources.${result.droppedFindings ? ` ${result.droppedFindings} unsupported findings were excluded.` : ""}${result.skippedDuplicates ? ` ${result.skippedDuplicates} existing findings were skipped.` : ""}${result.failures?.length ? ` ${result.failures.length} searches were unavailable.` : ""} Review them before approval.`,
                  );
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy("");
                }
              }}
            >
              Search web with AI
            </button>
            {sourceList.length > 0 && (
              <details className="rounded-xl border border-border p-4">
                <summary className="cursor-pointer text-sm font-medium">
                  View {sourceList.length} collected sources
                </summary>
                <ul className="mt-3 space-y-3 text-sm">
                  {sourceList.map((item, index) => (
                    <li key={`${item.url}-${index}`}>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-brand underline"
                      >
                        {item.title || item.url}
                      </a>
                      <p className="text-xs text-muted-foreground">
                        {label(item.provider)} · Collected{" "}
                        {new Date(item.retrievedAt).toLocaleDateString()}
                      </p>
                      <p className="text-muted-foreground">{item.excerpt}</p>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
          <section className={`${card} space-y-4`}>
            <h2 className="text-xl font-semibold">Research prompt</h2>
            <label className="block text-sm">
              Research source
              <select
                aria-label="Research source"
                className={field}
                value={source}
                onChange={(e) => setSource(e.target.value)}
              >
                {["Claude", "ChatGPT", "Gemini", "Other"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                className={primary}
                disabled={!!busy}
                onClick={() => void act({ action: "prompt", source })}
              >
                {data.audit.generated_prompt ? "Regenerate Prompt" : "Generate Prompt"}
              </button>
              {data.audit.generated_prompt && (
                <>
                  <button
                    className={btn}
                    onClick={() =>
                      void navigator.clipboard
                        .writeText(data.audit.generated_prompt!)
                        .then(() => setNotice("Prompt copied."))
                        .catch(() => setError("Copy failed. Use Download Prompt."))
                    }
                  >
                    Copy Prompt
                  </button>
                  <button
                    className={btn}
                    onClick={() =>
                      download(data.audit.generated_prompt!, "hq360-research-prompt.txt")
                    }
                  >
                    Download Prompt
                  </button>
                </>
              )}
            </div>
            {data.audit.generated_prompt && (
              <textarea
                aria-label="Generated research prompt"
                className={field}
                rows={10}
                readOnly
                value={data.audit.generated_prompt}
              />
            )}{" "}
            {data.permissions.admin && (
              <details>
                <summary className="cursor-pointer text-sm">Edit reusable prompt template</summary>
                <textarea
                  aria-label="Prompt template"
                  className={field}
                  rows={10}
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                />
                <button
                  className={`${btn} mt-3`}
                  disabled={!!busy}
                  onClick={() => void act({ action: "template", template })}
                >
                  Save template
                </button>
              </details>
            )}
          </section>
          <section className={`${card} space-y-4`}>
            <h2 className="text-xl font-semibold">Import research</h2>
            <p className="text-sm text-muted-foreground">
              Paste the research JSON or upload a .json file. Validation checks identity, structure,
              duplicates, URLs and required sections. Importing never approves or publishes
              findings.
            </p>
            <label className="block text-sm">
              Upload JSON
              <input
                type="file"
                accept=".json,application/json"
                className={field}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    if (f.size > 2000000) {
                      setError("JSON must be at most 2 MB");
                      return;
                    }
                    void f.text().then((text) => {
                      setRaw(text);
                      setValidation(null);
                    });
                  }
                }}
              />
            </label>
            <label className="block text-sm">
              Research JSON
              <textarea
                aria-label="Research JSON"
                rows={10}
                className={field}
                value={raw}
                onChange={(e) => {
                  setRaw(e.target.value);
                  setValidation(null);
                }}
              />
            </label>
            <button
              className={btn}
              disabled={!raw || !!busy}
              onClick={async () => {
                setBusy("Validating research…");
                setError("");
                try {
                  const r = await fetch(base, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "validate", raw }),
                  });
                  const result = await r.json();
                  if (!("valid" in result)) throw new Error(result.error);
                  setValidation(result);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy("");
                }
              }}
            >
              Validate JSON
            </button>
            {validation && !validation.valid && (
              <ul role="alert" className="list-disc space-y-1 pl-5 text-sm text-destructive">
                {validation.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            )}
            {validation?.valid && (
              <div className="space-y-3 rounded-xl border border-emerald-500/30 p-4">
                <h3 className="font-semibold">Research preview</h3>
                <p>
                  {validation.data?.findings.length} findings · {validation.data?.listopia.length}{" "}
                  Listopia lists · {validation.data?.tasks.length} review tasks
                </p>
                {validation.data?.findings.map((f, i) => (
                  <div key={i} className="rounded-lg bg-secondary p-3">
                    <strong>{f.title}</strong>
                    <p className="text-sm">{f.what_we_found}</p>
                    <Badge value={f.classification} />
                  </div>
                ))}
                <button
                  className={primary}
                  disabled={!!busy}
                  onClick={async () => {
                    if (await act({ action: "import", raw, source })) {
                      setRaw("");
                      setValidation(null);
                      setTab("Findings");
                    }
                  }}
                >
                  Import Research
                </button>
              </div>
            )}
          </section>
          <section className={`${card} space-y-3`}>
            <h2 className="text-lg font-semibold">Original research archive</h2>
            {data.imports.map((i) => (
              <a
                key={i.id}
                className="block text-sm text-brand underline"
                href={`${base}?import=${i.id}`}
              >
                {i.source} · {new Date(i.created_at).toLocaleString()} · Download immutable original
              </a>
            ))}
          </section>
        </>
      )}
      {["Findings", "Amazon", "Website"].includes(tab) && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">
              {tab === "Findings" ? "Audit findings" : `${tab} findings`}
            </h2>
            <button
              className={primary}
              onClick={() =>
                edit("finding", {
                  ...defaultFinding,
                  category: tab === "Amazon" ? "amazon_audit" : "website_audit",
                })
              }
            >
              + Add Manual Finding
            </button>
          </div>
          {findings.map((f) => (
            <article key={f.id} className={`${card} space-y-4`}>
              <div className="flex flex-wrap gap-2">
                <Badge value={f.review_status} />
                <Badge value={f.classification} />
                <Badge value={f.priority} />
                {f.hidden && <Badge value="hidden" />}
              </div>
              <h3 className="text-xl font-semibold">{f.title}</h3>
              <p className="text-xs text-muted-foreground">
                {label(f.category)} · Impact {f.impact_score ?? "—"}/10 · Effort{" "}
                {f.effort_score ?? "—"}/10 · Confidence {f.confidence_score ?? "—"}% · Finding{" "}
                {f.id}
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  ["What we checked", f.what_we_checked],
                  ["What we found", f.what_we_found],
                  ["Evidence", f.evidence],
                  ["Interpretation", f.interpretation],
                  ["Why it matters", f.why_it_matters],
                  ["Recommendation", f.recommendation],
                  ["HQ360 service match", f.service_match],
                  ["Reviewer notes", f.reviewer_notes],
                ].map(([title, value]) => (
                  <div key={title}>
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground">
                      {title}
                    </h4>
                    <p className="mt-1 whitespace-pre-line text-sm">{value || "Not provided"}</p>
                  </div>
                ))}
              </div>
              {f.implementation_steps.length > 0 && (
                <ol className="list-decimal space-y-1 pl-5 text-sm">
                  {f.implementation_steps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              )}
              <div className="flex flex-wrap gap-3">
                {f.source_urls.map((url) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="break-all text-sm text-brand underline"
                  >
                    {url}
                  </a>
                ))}
              </div>
              <Badge value={f.manual_status} />
              <div className="grid gap-3 sm:grid-cols-2">
                {data.assets
                  .filter((a) => a.finding_id === f.id)
                  .map((a) => (
                    <img
                      key={a.id}
                      className="max-h-60 rounded-xl object-contain"
                      src={`${base}?asset=${a.id}`}
                      alt={a.caption || "Finding evidence"}
                    />
                  ))}
              </div>
              {reviewButtons("finding", f)}
              <div className="flex flex-wrap gap-2">
                {["Move section", "Add evidence", "Add reviewer note"].map((title) => (
                  <button key={title} className={btn} onClick={() => edit("finding", f)}>
                    {title}
                  </button>
                ))}
                <button
                  className={btn}
                  disabled={!!busy}
                  onClick={() => void act({ action: "duplicate", entity: "finding", id: f.id })}
                >
                  Duplicate
                </button>
                <label className={`${btn} cursor-pointer`}>
                  Add Screenshot
                  <input
                    aria-label={`Add screenshot to ${f.title}`}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    disabled={!!busy}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void upload(file, undefined, f.id);
                    }}
                  />
                </label>
              </div>
            </article>
          ))}
          {!findings.length && (
            <p className={card}>No findings yet. Import research or add a manual finding.</p>
          )}
        </>
      )}
      {tab === "Goodreads" && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Goodreads Listopia</h2>
            <button
              className={btn}
              onClick={() =>
                edit("listopia", {
                  list_name: "",
                  list_url: "",
                  book_present: null,
                  position: null,
                  page: null,
                  votes: null,
                  number_of_books: null,
                  competition: "unknown",
                  relevance_score: null,
                  books_above: [],
                  books_below: [],
                  why_position: "",
                  how_to_improve: "",
                  evidence: "",
                  manual_status: "pending",
                  review_status: "pending",
                  reviewer_notes: "",
                })
              }
            >
              Add Listopia list
            </button>
          </div>
          <p className="text-sm text-muted-foreground">
            Record what you actually observe. Explanations of ranking are interpretations, not
            verified algorithm claims.
          </p>
          {data.listopia.map((l) => (
            <article className={`${card} space-y-4`} key={l.id}>
              <h3 className="text-xl font-semibold">{l.list_name}</h3>
              <p className="text-xs text-muted-foreground">List ID: {l.id}</p>
              {data.assets
                .filter((a) => a.listopia_id === l.id)
                .map((a) => (
                  <img
                    key={a.id}
                    className="max-h-80 rounded-xl object-contain"
                    src={`${base}?asset=${a.id}`}
                    alt={a.caption || "Listopia evidence"}
                  />
                ))}
              {l.list_url ? (
                <a
                  href={l.list_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-brand underline"
                >
                  Open list ↗
                </a>
              ) : (
                <p className="text-sm text-muted-foreground">
                  List URL unknown. Add it when you verify this list.
                </p>
              )}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ["Current position", l.position === null ? "Unknown" : `#${l.position}`],
                  ["Page", l.page ?? "Unknown"],
                  ["Votes", l.votes ?? "Unknown"],
                  ["Competition", label(l.competition)],
                ].map(([title, value]) => (
                  <div key={title} className="rounded-xl bg-secondary p-4">
                    <strong className="text-2xl">{value}</strong>
                    <p className="mt-1 text-xs">{title}</p>
                  </div>
                ))}
              </div>
              <p className="text-sm">
                Above: {l.books_above.join(", ") || "Unknown"} · Below:{" "}
                {l.books_below.join(", ") || "Unknown"}
              </p>
              <p className="whitespace-pre-line text-sm">{l.why_position}</p>
              <p className="whitespace-pre-line text-sm">{l.how_to_improve}</p>
              <p className="text-sm text-muted-foreground">{l.evidence}</p>
              <div className="flex gap-2">
                <Badge value={l.manual_status} />
                <Badge value={l.review_status} />
              </div>
              {reviewButtons("listopia", l)}
            </article>
          ))}
          <button className={btn} onClick={() => setTab("Screenshots")}>
            Open screenshot queue
          </button>
        </>
      )}
      {["Screenshots", "Manual Review"].includes(tab) && (
        <>
          <div className="flex flex-wrap justify-between gap-3">
            <h2 className="text-xl font-semibold">
              {tab === "Screenshots" ? "Screenshot queue" : "Manual checks"}
            </h2>
            <button
              className={btn}
              onClick={() =>
                edit("task", {
                  title: "",
                  category: tab === "Screenshots" ? "goodreads_listopia_audit" : "general",
                  instructions: "",
                  required: true,
                  kind: tab === "Screenshots" ? "screenshot" : "manual",
                  status: "pending",
                  notes: "",
                })
              }
            >
              Add review task
            </button>
          </div>
          {data.tasks
            .filter((t) => t.kind === (tab === "Screenshots" ? "screenshot" : "manual"))
            .map((t) => (
              <article key={t.id} className={`${card} space-y-3`}>
                <div className="flex flex-wrap justify-between gap-3">
                  <h3 className="text-lg font-semibold">{t.title}</h3>
                  <Badge value={t.status} />
                </div>
                <p className="whitespace-pre-line text-sm">{t.instructions}</p>
                <p className="text-xs text-muted-foreground">
                  {t.required ? "Required" : "Optional"} · {t.category} · {t.id}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button className={btn} onClick={() => edit("task", t)}>
                    Edit task / notes
                  </button>
                  {t.kind === "screenshot" && (
                    <label className={`${btn} cursor-pointer`}>
                      Upload screenshot
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="sr-only"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void upload(f, t.id);
                        }}
                      />
                    </label>
                  )}
                  {data.permissions.review &&
                    ["approved", "not_applicable"].map((status) => (
                      <button
                        className={btn}
                        key={status}
                        disabled={!!busy}
                        onClick={() =>
                          void act({
                            action: "save",
                            entity: "task",
                            id: t.id,
                            approve: true,
                            values: { ...t, status },
                          })
                        }
                      >
                        {label(status)}
                      </button>
                    ))}
                </div>
              </article>
            ))}
          {tab === "Screenshots" && (
            <>
              <label className={`${btn} inline-block cursor-pointer`}>
                Upload evidence image
                <input
                  aria-label="Upload evidence image"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  disabled={!!busy}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void upload(f);
                  }}
                />
              </label>
              <p className="text-xs text-muted-foreground">
                PNG, JPEG or WebP · maximum 8 MB · private storage. Images are never generated.
              </p>
              <div className="grid gap-5 sm:grid-cols-2">
                {[...data.assets]
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((a) => (
                    <article key={a.id} className={`${card} space-y-4`}>
                      <img
                        className="max-h-80 w-full rounded-xl object-contain"
                        src={`${base}?asset=${a.id}`}
                        alt={a.caption || a.original_filename}
                      />
                      <h3 className="break-all font-semibold">{a.original_filename}</h3>
                      <p className="text-sm">{a.caption || "Caption needed"}</p>
                      <p className="text-sm text-muted-foreground">
                        {a.proves || "Add what this image proves."}
                      </p>
                      <Badge value={a.review_status} />
                      {reviewButtons("asset", a)}
                      <p className="text-xs text-muted-foreground">
                        To replace: upload the replacement, attach it to the same finding, then
                        delete this draft image. Published versions retain their original image.
                      </p>
                    </article>
                  ))}
              </div>
            </>
          )}
        </>
      )}
      {tab === "Action Plan" && (
        <>
          <div className="flex justify-between gap-3">
            <h2 className="text-xl font-semibold">Priority action plan</h2>
            <button
              className={btn}
              onClick={() =>
                edit("action", {
                  title: "",
                  description: "",
                  horizon: "do_first",
                  service: "",
                  finding_ids: [],
                  review_status: "pending",
                  sort_order: data.actions.length,
                })
              }
            >
              Add action
            </button>
          </div>
          {["do_first", "next_30_days", "next_90_days", "long_term"].map((h) => (
            <section className={`${card} space-y-4`} key={h}>
              <h3 className="font-semibold">{label(h)}</h3>
              {data.actions
                .filter((a) => a.horizon === h)
                .map((a) => (
                  <article key={a.id} className="space-y-3 rounded-xl border border-border p-4">
                    <h4 className="font-semibold">{a.title}</h4>
                    <p className="whitespace-pre-line text-sm">{a.description}</p>
                    {a.service && <p className="text-sm text-brand">{a.service}</p>}
                    <Badge value={a.review_status} />
                    {reviewButtons("action", a)}
                  </article>
                ))}
            </section>
          ))}
        </>
      )}
      {tab === "Client Site" && (
        <>
          <section className={`${card} space-y-4`}>
            <h2 className="text-xl font-semibold">Client site & final QA</h2>
            <p className="text-sm text-muted-foreground">
              Generate an immutable draft from approved material. Preview it, complete final QA,
              then publish. Unapproved findings and internal notes never appear in the client site.
            </p>
            <label className="block text-sm">
              Version change notes
              <textarea
                className={field}
                value={changeNotes}
                onChange={(e) => setChangeNotes(e.target.value)}
              />
            </label>
            <button
              className={primary}
              disabled={!!busy || !data.permissions.review}
              onClick={() => void act({ action: "generate", notes: changeNotes })}
            >
              {data.access ? "Create Draft Revision" : "Generate Client Site"}
            </button>
            <label className="block text-sm">
              Version
              <select
                aria-label="Audit version"
                className={field}
                value={version}
                onChange={(e) => {
                  setVersion(e.target.value);
                  setPreview(null);
                }}
              >
                <option value="">Choose a version</option>
                {[...data.versions]
                  .sort((a, b) => b.version_number - a.version_number)
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      Version {v.version_number} · {v.published_at ? "Published" : "Draft"} ·{" "}
                      {v.change_notes}
                    </option>
                  ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                className={btn}
                disabled={!version || !!busy}
                onClick={() => void showPreview()}
              >
                Preview client site
              </button>
              <button
                className={btn}
                disabled={!version || !!busy || !preview || !data.permissions.review}
                onClick={() => void act({ action: "qa", versionId: version })}
              >
                Final QA complete
              </button>
              {data.permissions.admin && (
                <button
                  className={primary}
                  disabled={!version || !!busy}
                  onClick={() => void act({ action: "publish", versionId: version, override })}
                >
                  Publish version
                </button>
              )}
            </div>
            <details>
              <summary className="cursor-pointer text-sm">
                {issues.length} outstanding review checks
              </summary>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
                {issues.map((issue, i) => (
                  <li key={i}>{issue}</li>
                ))}
              </ul>
            </details>
            {data.permissions.admin && (
              <>
                <label className="block text-sm">
                  Admin override reason (only if required checks cannot be completed)
                  <textarea
                    className={field}
                    value={override}
                    onChange={(e) => setOverride(e.target.value)}
                  />
                </label>
                <label className="flex gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={data.audit.cta_enabled}
                    disabled={!!busy}
                    onChange={(e) => void act({ action: "settings", ctaEnabled: e.target.checked })}
                  />
                  Enable contact CTA on the next published version
                </label>
              </>
            )}
          </section>
          {code && (
            <div role="status" className={`${card} border-emerald-500/30`}>
              <p>Copy this access code now. HQ360 stores only its hash.</p>
              <code className="mt-3 block select-all text-xl">{code}</code>
            </div>
          )}
          {data.access && (
            <section className={`${card} space-y-4`}>
              <h2 className="text-xl font-semibold">Client access</h2>
              <a
                className="break-all text-brand underline"
                href={`/author-audit/${data.access.public_slug}`}
                target="_blank"
                rel="noreferrer"
              >
                /author-audit/{data.access.public_slug}
              </a>
              <p className="text-sm">
                {data.access.access_enabled ? "Enabled" : "Disabled"} · {data.access.view_count}{" "}
                views · Last access{" "}
                {data.access.last_viewed_at
                  ? new Date(data.access.last_viewed_at).toLocaleString()
                  : "Never"}
              </p>
              {data.permissions.admin && (
                <>
                  <div className="flex flex-wrap gap-2">
                    {["regenerate", "revoke", "disable"].map((action) => (
                      <button
                        className={btn}
                        disabled={!!busy}
                        key={action}
                        onClick={() => void act({ action })}
                      >
                        {action === "regenerate"
                          ? "Regenerate access code"
                          : `${label(action)} access`}
                      </button>
                    ))}
                  </div>
                  <label className="block text-sm">
                    Expiration date
                    <input
                      type="datetime-local"
                      className={field}
                      value={expiry}
                      onChange={(e) => setExpiry(e.target.value)}
                    />
                  </label>
                  <button
                    className={btn}
                    disabled={!!busy}
                    onClick={() =>
                      void act({
                        action: "expiry",
                        expiresAt: expiry ? new Date(expiry).toISOString() : null,
                      })
                    }
                  >
                    Save expiration
                  </button>
                  <button
                    className={btn}
                    disabled={!!busy}
                    onClick={() =>
                      void act({
                        action: "settings",
                        ctaEnabled: data.audit.cta_enabled,
                        archived: true,
                      })
                    }
                  >
                    Archive audit
                  </button>
                </>
              )}
            </section>
          )}
          {preview && (
            <div className="overflow-hidden rounded-2xl border border-border">
              <p className="bg-secondary p-3 text-sm">
                Private staff preview · Version{" "}
                {data.versions.find((v) => v.id === version)?.version_number}
              </p>
              <ResearchAuditReport
                report={preview}
                imageBase={`${base}?version=${version}&asset=`}
              />
            </div>
          )}
        </>
      )}
      {tab === "History" && (
        <section className={`${card} space-y-4`}>
          <h2 className="text-xl font-semibold">Audit activity</h2>
          {[...data.history]
            .sort((a, b) => b.created_at.localeCompare(a.created_at))
            .map((h) => (
              <div className="border-b border-border pb-3 text-sm" key={h.id}>
                <strong>{label(h.action)}</strong>
                <p className="mt-1 text-muted-foreground">
                  {h.actor === "admin"
                    ? "HQ360 Admin"
                    : (data.experts.find((e) => e.id === h.actor)?.full_name ?? h.actor)}{" "}
                  · {new Date(h.created_at).toLocaleString()}
                </p>
              </div>
            ))}
        </section>
      )}
    </div>
  );
}

type FastResult = {
  counts: Record<string, number>;
  remaining: string[];
};
/** One-click review for research that was verified before it was imported. */
function FastApprove({
  act,
  busy,
}: {
  act: (body: Values, refresh?: boolean) => Promise<{ [key: string]: unknown } | null>;
  busy: boolean;
}) {
  const [result, setResult] = useState<FastResult | null>(null);
  async function run(generate: boolean) {
    if (
      !window.confirm(
        "Approve and verify every finding, section, Listopia list, action and uploaded screenshot that isn't rejected or hidden? Use this only if you verified the research before importing it.",
      )
    )
      return;
    const r = (await act({ action: "approve_all" })) as FastResult | null;
    if (!r) return;
    setResult(r);
    if (generate && !r.remaining.length)
      await act({ action: "generate", notes: "Approved in one step" });
  }
  const total = result ? Object.values(result.counts).reduce((a, b) => a + b, 0) : 0;
  return (
    <section className={`${card} border-brand/40`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl">
          <p className="text-xs font-semibold tracking-widest text-brand uppercase">Fast approve</p>
          <h2 className="mt-1 text-xl font-semibold">Already verified this research?</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Approve everything in one step instead of item by item. Rejected and hidden items are
            left alone, and screenshot requests still need a real uploaded image.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className={btn} disabled={busy} onClick={() => void run(false)}>
            Approve everything
          </button>
          <button className={primary} disabled={busy} onClick={() => void run(true)}>
            Approve all &amp; generate site
          </button>
        </div>
      </div>
      {result && (
        <div className="mt-4 rounded-xl bg-secondary/50 p-4 text-sm">
          <p className="font-semibold">
            Approved {total} item{total === 1 ? "" : "s"} ·{" "}
            {Object.entries(result.counts)
              .filter(([, n]) => n)
              .map(([k, n]) => `${n} ${k}`)
              .join(", ") || "nothing new"}
          </p>
          {result.remaining.length ? (
            <>
              <p className="mt-2 text-muted-foreground">
                {result.remaining.length} still need you before publishing:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {result.remaining.slice(0, 12).map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-2 text-muted-foreground">
              Review complete — open Client Site to preview, run final QA and publish.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
