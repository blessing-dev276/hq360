import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AUTHOR_OFFERS } from "@/data/author-offers";
import { SALES_STAGES, PROJECT_STATUSES, label, type SalesLead } from "@/lib/sales";
type Invoice = {
  id: string;
  number: string;
  buyer_name: string;
  status: string;
  environment: string;
  payment_token: string;
};
type SalesEvent = { lead_id: string; event: string; detail: string; created_at: string };
type Payload = {
  ok: boolean;
  items: SalesLead[];
  invoices: Invoice[];
  events: SalesEvent[];
  error?: string;
};
const empty = {
  name: "",
  email: "",
  assigned_to: "",
  stage: "needs_review",
  check_completed_at: null,
  last_contact: null,
  next_follow_up: null,
  report_url: "",
  proposal_url: "",
  invoice_id: null,
  agreed_service: "",
  project_status: "not_started",
  notes: "",
} as const;
const input = "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";
export function LeadsAdmin({ projects = false }: { projects?: boolean }) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<Partial<SalesLead> | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("all");
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/leads");
      const body = (await response.json()) as Payload;
      if (!response.ok || !body.ok) throw new Error(body.error || "Could not load leads.");
      setData(body);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load leads.");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    const payload = {
      ...fields,
      check_completed_at: fields.check_completed_at || null,
      last_contact: fields.last_contact || null,
      next_follow_up: fields.next_follow_up || null,
      invoice_id: fields.invoice_id || null,
      ...(editing?.id ? { id: editing.id } : {}),
    };
    try {
      const response = await fetch("/api/admin/leads", {
        method: editing?.id ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error || "Could not save.");
      setEditing(null);
      setNotice(
        body.forwarded
          ? "Saved and forwarded to CRM."
          : "Saved in HQ360. CRM forwarding is not configured or did not succeed.",
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }
  const today = [
    new Date().getFullYear(),
    String(new Date().getMonth() + 1).padStart(2, "0"),
    String(new Date().getDate()).padStart(2, "0"),
  ].join("-");
  const due = (lead: SalesLead) =>
    lead.next_follow_up && lead.next_follow_up <= today && lead.stage !== "lost";
  const items = (data?.items ?? []).filter(
    (lead) =>
      (!projects || lead.project_status !== "not_started" || lead.stage === "won") &&
      (filter === "all" || (filter === "due" && due(lead)) || lead.stage === filter),
  );
  const stageCount = (stage: string) =>
    new Set(
      data?.events
        .filter((event) => event.event === "stage_changed" && event.detail === stage)
        .map((event) => event.lead_id),
    ).size;
  const paid =
    data?.items.filter((lead) =>
      data.invoices.some(
        (invoice) =>
          invoice.id === lead.invoice_id &&
          invoice.status === "paid" &&
          invoice.environment === "live",
      ),
    ).length ?? 0;
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Review needs → introduce → discuss → propose → invoice → deliver → ongoing support. New
        inquiries, visibility requests and saved Scout prospects appear here automatically.
      </p>
      {data && (
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            [
              "Completed visibility checks",
              data.items.filter(
                (lead) => lead.source_kind === "visibility_check" && lead.check_completed_at,
              ).length,
            ],
            ["Qualified leads", stageCount("qualified")],
            ["Proposals reached", stageCount("proposal")],
            ["Paid projects", paid],
          ].map(([title, count]) => (
            <div key={title} className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">{title}</p>
              <strong className="text-2xl">{count}</strong>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Counts cover stored records. Qualified leads and proposals count recorded stage transitions;
        paid projects require a linked, paid live invoice. Mark the check completion date only after
        the reviewed assessment is delivered.
      </p>
      {error && (
        <p role="alert" className="text-destructive">
          {error}{" "}
          <button className="underline" onClick={() => void load()}>
            Retry loading
          </button>
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <div className="flex flex-wrap items-center gap-4">
        <button
          className="rounded-full bg-primary px-5 py-2 text-primary-foreground"
          onClick={() => {
            setEditing({ ...empty });
            setNotice("");
          }}
        >
          Add lead
        </button>
        <label>
          Show{" "}
          <select
            className={input}
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            <option value="all">All records</option>
            <option value="due">Follow-ups due</option>
            {SALES_STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {label(stage)}
              </option>
            ))}
          </select>
        </label>
        <a href="/scout" className="underline">
          Open Scout
        </a>
        <a href="/admin#audits" className="underline">
          Author Reports
        </a>
        <a href="/admin#payments" className="underline">
          Invoices
        </a>
      </div>
      {editing && (
        <form
          key={editing.id ?? "new"}
          onSubmit={save}
          className="rounded-2xl border border-border bg-card p-6"
        >
          <h2 className="text-xl">{editing.id ? "Update lead / project" : "Add a lead"}</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {(
              [
                "name",
                "email",
                "assigned_to",
                "check_completed_at",
                "last_contact",
                "next_follow_up",
                "report_url",
                "proposal_url",
              ] as const
            ).map((key) => (
              <label key={key} className="text-sm">
                {label(key)}
                <input
                  name={key}
                  required={key === "name"}
                  type={
                    key.includes("url")
                      ? "url"
                      : key === "email"
                        ? "email"
                        : key === "check_completed_at" ||
                            key === "last_contact" ||
                            key === "next_follow_up"
                          ? "date"
                          : "text"
                  }
                  defaultValue={editing[key] ?? ""}
                  className={input}
                />
              </label>
            ))}
            <label className="text-sm">
              Sales stage
              <select name="stage" className={input} defaultValue={editing.stage}>
                {SALES_STAGES.map((stage) => (
                  <option key={stage} value={stage}>
                    {label(stage)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Project status
              <select name="project_status" className={input} defaultValue={editing.project_status}>
                {PROJECT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {label(status)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Agreed service
              <input
                name="agreed_service"
                list="author-services"
                defaultValue={editing.agreed_service}
                className={input}
              />
              <datalist id="author-services">
                {AUTHOR_OFFERS.map((offer) => (
                  <option key={offer.slug} value={offer.name} />
                ))}
              </datalist>
            </label>
            <label className="text-sm">
              Linked invoice
              <select name="invoice_id" className={input} defaultValue={editing.invoice_id ?? ""}>
                <option value="">No invoice linked</option>
                {data?.invoices.map((invoice) => (
                  <option key={invoice.id} value={invoice.id}>
                    {invoice.number} · {invoice.buyer_name} · {invoice.status} (
                    {invoice.environment})
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm sm:col-span-2">
              Needs, scope and delivery notes
              <textarea name="notes" defaultValue={editing.notes} rows={4} className={input} />
            </label>
          </div>
          <div className="mt-5 flex gap-4">
            <button
              disabled={saving}
              className="rounded-full bg-primary px-5 py-2 text-primary-foreground disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save record"}
            </button>
            <button type="button" disabled={saving} onClick={() => setEditing(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}
      {!data && !error && <p role="status">Loading sales records…</p>}
      {data && items.length === 0 && <p>No records match this view.</p>}
      <ul className="space-y-3">
        {items.map((lead) => {
          const invoice = data?.invoices.find((invoice) => invoice.id === lead.invoice_id);
          return (
            <li key={lead.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="font-semibold">{lead.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    {lead.email || "No email recorded"} · {label(lead.source_kind)}
                  </p>
                  <p className="mt-2 text-sm">
                    {label(lead.stage)} · {label(lead.project_status)} ·{" "}
                    {lead.assigned_to || "Unassigned"}
                  </p>
                  <p className="text-sm">{lead.agreed_service || "Service to be agreed"}</p>
                  {lead.next_follow_up && (
                    <p
                      className={
                        due(lead) ? "mt-2 text-sm font-semibold text-brand" : "mt-2 text-sm"
                      }
                    >
                      Follow up: {lead.next_follow_up}
                      {due(lead) ? " · Due" : ""}
                    </p>
                  )}
                </div>
                <button
                  className="rounded-full border border-border px-4 py-2 text-sm"
                  onClick={() => setEditing({ ...lead })}
                >
                  Review / edit
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-4 text-sm">
                {lead.report_url && (
                  <a className="underline" href={lead.report_url} target="_blank" rel="noreferrer">
                    Report
                  </a>
                )}
                {lead.proposal_url && (
                  <a
                    className="underline"
                    href={lead.proposal_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Proposal
                  </a>
                )}
                {invoice && (
                  <a
                    className="underline"
                    href={`/pay/${invoice.payment_token}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {invoice.number} · {invoice.status}
                  </a>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
