import { GlassLoading } from "@/components/ui/glass-loading";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  BookOpen,
  CalendarClock,
  CircleCheck,
  Globe,
  Inbox,
  PenLine,
  Plus,
  RefreshCw,
  ScanSearch,
  Search,
  Trophy,
  Workflow,
  X,
} from "lucide-react";
import { AUTHOR_OFFERS } from "@/data/author-offers";
import { SALES_STAGES, PROJECT_STATUSES, label, type SalesLead } from "@/lib/sales";
import { PresenceNote } from "./PresenceNote";

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
type Scope = "admin" | "expert";

const SOURCES: Record<string, { label: string; icon: typeof Globe }> = {
  inquiry: { label: "Website inquiry", icon: Globe },
  visibility_check: { label: "Visibility check", icon: BookOpen },
  scout: { label: "Scouting", icon: ScanSearch },
  manual: { label: "Added manually", icon: PenLine },
};
const STAGE_TONE: Record<string, string> = {
  needs_review: "pending",
  qualified: "draft",
  introduced: "draft",
  discussion: "draft",
  proposal: "pending",
  invoiced: "pending",
  won: "paid",
  lost: "overdue",
};
const EMPTY: Partial<SalesLead> = {
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
};
const ACTIVE_PROJECT = new Set(["scoping", "in_progress", "client_review", "ongoing"]);

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDays(days: number) {
  const d = new Date(Date.now() + days * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const isOpen = (l: SalesLead) => l.stage !== "won" && l.stage !== "lost";
const isDue = (l: SalesLead) =>
  !!l.next_follow_up && l.next_follow_up <= today() && l.stage !== "lost";

/** Admin view of HQ360's pipeline (plus every expert's, filterable). */
export function LeadsAdmin() {
  return <LeadsWorkspace scope="admin" />;
}

export function LeadsWorkspace({ scope }: { scope: Scope }) {
  const api = scope === "admin" ? "/api/admin/leads" : "/api/expert/leads";
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("all");
  const [stage, setStage] = useState("all");
  const [project, setProject] = useState("all");
  const [owner, setOwner] = useState("all");
  const [quick, setQuick] = useState<"" | "open" | "new" | "due" | "projects" | "won">("");
  const [sort, setSort] = useState<"newest" | "follow_up" | "name">("newest");
  const [openId, setOpenId] = useState<string | "new" | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(api);
      const body = (await response.json()) as Payload;
      if (!response.ok || !body.ok) throw new Error(body.error || "Could not load leads.");
      setData(body);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load leads.");
    }
  }, [api]);
  useEffect(() => {
    void load();
  }, [load]);

  async function patch(lead: SalesLead, values: Partial<SalesLead>, success?: string) {
    setBusy(lead.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(api, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: lead.id, ...values }),
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error || "Could not save.");
      setData((d) =>
        d
          ? { ...d, items: d.items.map((l) => (l.id === lead.id ? { ...l, ...body.item } : l)) }
          : d,
      );
      if (success) setNotice(success);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
      return false;
    } finally {
      setBusy("");
    }
  }

  const items = data?.items ?? [];
  const owners = useMemo(
    () =>
      [...new Map(items.map((l) => [l.owner ?? "hq360", l.owner_name ?? "HQ360"])).entries()].sort(
        (a, b) => (a[0] === "hq360" ? -1 : b[0] === "hq360" ? 1 : a[1].localeCompare(b[1])),
      ),
    [items],
  );
  const counts = {
    open: items.filter(isOpen).length,
    new: items.filter((l) => l.stage === "needs_review").length,
    due: items.filter(isDue).length,
    projects: items.filter((l) => ACTIVE_PROJECT.has(l.project_status)).length,
    won: items.filter((l) => l.stage === "won").length,
  };
  const term = search.trim().toLowerCase();
  const visible = items
    .filter((l) => {
      if (quick === "open" && !isOpen(l)) return false;
      if (quick === "new" && l.stage !== "needs_review") return false;
      if (quick === "due" && !isDue(l)) return false;
      if (quick === "projects" && !ACTIVE_PROJECT.has(l.project_status)) return false;
      if (quick === "won" && l.stage !== "won") return false;
      if (source !== "all" && l.source_kind !== source) return false;
      if (stage !== "all" && l.stage !== stage) return false;
      if (project !== "all" && l.project_status !== project) return false;
      if (owner !== "all" && (l.owner ?? "hq360") !== owner) return false;
      if (!term) return true;
      return [
        l.name,
        l.email,
        l.context?.book_title,
        l.context?.batch_label,
        l.agreed_service,
        l.notes,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term));
    })
    .sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : sort === "follow_up"
          ? (a.next_follow_up ?? "9999").localeCompare(b.next_follow_up ?? "9999")
          : b.created_at.localeCompare(a.created_at),
    );
  const filtered = !!(
    quick ||
    term ||
    source !== "all" ||
    stage !== "all" ||
    project !== "all" ||
    owner !== "all"
  );
  function clear() {
    setQuick("");
    setSearch("");
    setSource("all");
    setStage("all");
    setProject("all");
    setOwner("all");
  }
  const selected = openId === "new" ? null : (items.find((l) => l.id === openId) ?? null);

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {error && (
        <div className="admin-alert" role="alert">
          <AlertCircle size={18} /> {error}{" "}
          <button className="admin-text-button" onClick={() => void load()}>
            Retry
          </button>
        </div>
      )}
      {notice && !openId && (
        <div className="admin-notice" role="status">
          <CircleCheck size={18} /> {notice}
        </div>
      )}

      <div
        className="admin-stats"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}
      >
        {(
          [
            ["open", "Open leads", Inbox, "In the pipeline"],
            ["new", "New to review", Workflow, "Needs a first look"],
            ["due", "Follow-ups due", CalendarClock, "Today or overdue"],
            ["projects", "Active projects", Workflow, "Scoping to delivery"],
            ["won", "Won", Trophy, "Converted clients"],
          ] as const
        ).map(([key, title, Icon, note]) => (
          <button
            key={key}
            className={`admin-stat leads-stat ${quick === key ? "active" : ""}`}
            onClick={() => setQuick(quick === key ? "" : key)}
            aria-pressed={quick === key}
          >
            <div>
              {title} <Icon size={18} />
            </div>
            <strong>{data ? counts[key] : "—"}</strong>
            <small>{note}</small>
          </button>
        ))}
      </div>

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <h2>
              {scope === "admin" ? "Leads & Projects" : "Your leads & projects"}{" "}
              <span className="admin-count">{items.length}</span>
            </h2>
            <p>
              {scope === "admin"
                ? "Website inquiries, visibility checks and Scouting saves land here automatically."
                : "Authors you save in Scouting and checks requested through your link land here."}
            </p>
          </div>
          <div className="admin-button-row">
            <button className="admin-icon-button" aria-label="Refresh" onClick={() => void load()}>
              <RefreshCw size={16} />
            </button>
            <button className="admin-button admin-button-primary" onClick={() => setOpenId("new")}>
              <Plus size={15} /> Add lead
            </button>
          </div>
        </div>

        <div className="leads-stages" aria-label="Sales stages">
          {SALES_STAGES.map((s) => {
            const n = items.filter((l) => l.stage === s).length;
            return (
              <button
                key={s}
                className={stage === s ? "active" : ""}
                aria-pressed={stage === s}
                onClick={() => setStage(stage === s ? "all" : s)}
              >
                {label(s)} <span>{n}</span>
              </button>
            );
          })}
        </div>

        <div className="leads-toolbar">
          <label className="admin-search leads-search">
            <Search size={16} />
            <input
              aria-label="Search leads"
              placeholder="Search author or client name, email, book, batch…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <select aria-label="Source" value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="all">All sources</option>
            {Object.entries(SOURCES).map(([key, s]) => (
              <option key={key} value={key}>
                {s.label}
              </option>
            ))}
          </select>
          <select aria-label="Sales stage" value={stage} onChange={(e) => setStage(e.target.value)}>
            <option value="all">Any sales stage</option>
            {SALES_STAGES.map((s) => (
              <option key={s} value={s}>
                {label(s)}
              </option>
            ))}
          </select>
          <select
            aria-label="Project status"
            value={project}
            onChange={(e) => setProject(e.target.value)}
          >
            <option value="all">Any project status</option>
            {PROJECT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {label(s)}
              </option>
            ))}
          </select>
          {scope === "admin" && owners.length > 1 && (
            <select aria-label="Owner" value={owner} onChange={(e) => setOwner(e.target.value)}>
              <option value="all">Everyone's leads</option>
              {owners.map(([id, name]) => (
                <option key={id} value={id}>
                  {id === "hq360" ? "HQ360 team" : name}
                </option>
              ))}
            </select>
          )}
          <select
            aria-label="Sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
          >
            <option value="newest">Newest first</option>
            <option value="follow_up">Next follow-up</option>
            <option value="name">Name A–Z</option>
          </select>
        </div>
        <div className="leads-count">
          Showing {visible.length} of {items.length}
          {filtered && (
            <button className="admin-text-button" onClick={clear}>
              Clear filters
            </button>
          )}
        </div>

        {!data && !error ? (
          <GlassLoading label="Loading leads…" variant="list" rows={5} />
        ) : visible.length === 0 ? (
          <div className="admin-empty">
            <h3>{items.length ? "No leads match" : "No leads yet"}</h3>
            <p>
              {items.length
                ? "Try another search or clear the filters."
                : scope === "admin"
                  ? "Website inquiries and Scouting saves will appear here."
                  : "Save authors in Scouting, or add a lead yourself."}
            </p>
          </div>
        ) : (
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Lead</th>
                  <th>Source</th>
                  <th>Sales stage</th>
                  <th>Project</th>
                  <th>Follow-up</th>
                  <th>
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((lead) => {
                  const src = SOURCES[lead.source_kind] ?? SOURCES.manual!;
                  const Icon = src.icon;
                  const due = isDue(lead);
                  return (
                    <tr key={lead.id}>
                      <td>
                        <button
                          className="admin-invoice-name leads-name"
                          onClick={() => setOpenId(lead.id)}
                        >
                          {lead.name}
                        </button>
                        <small>{lead.email || "No email yet"}</small>
                        {scope === "admin" && lead.owner && lead.owner !== "hq360" && (
                          <small className="leads-owner">{lead.owner_name}</small>
                        )}
                      </td>
                      <td style={{ whiteSpace: "normal", maxWidth: 240 }}>
                        <span className="leads-source">
                          <Icon size={13} /> {src.label}
                        </span>
                        {lead.context?.batch_label && (
                          <small>Batch: {lead.context.batch_label}</small>
                        )}
                        {lead.context?.book_title &&
                          !lead.context.batch_label?.includes(lead.context.book_title) && (
                            <small>“{lead.context.book_title}”</small>
                          )}
                        <PresenceNote presence={lead.context?.presence} />
                        {lead.inquiry_context?.help_with?.length ? (
                          <small>{lead.inquiry_context.help_with.join(", ")}</small>
                        ) : null}
                      </td>
                      <td>
                        <select
                          aria-label={`Sales stage for ${lead.name}`}
                          className={`leads-pill ${STAGE_TONE[lead.stage] ?? "draft"}`}
                          value={lead.stage}
                          disabled={busy === lead.id}
                          onChange={(e) =>
                            void patch(lead, { stage: e.target.value as SalesLead["stage"] })
                          }
                        >
                          {SALES_STAGES.map((s) => (
                            <option key={s} value={s}>
                              {label(s)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          aria-label={`Project status for ${lead.name}`}
                          className={`leads-pill ${ACTIVE_PROJECT.has(lead.project_status) ? "pending" : lead.project_status === "delivered" ? "paid" : "draft"}`}
                          value={lead.project_status}
                          disabled={busy === lead.id}
                          onChange={(e) =>
                            void patch(lead, {
                              project_status: e.target.value as SalesLead["project_status"],
                            })
                          }
                        >
                          {PROJECT_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {label(s)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        {lead.next_follow_up ? (
                          <span className={due ? "leads-due" : undefined}>
                            {lead.next_follow_up === today() ? "Today" : lead.next_follow_up}
                            {due && lead.next_follow_up < today() ? " · overdue" : ""}
                          </span>
                        ) : (
                          <span className="admin-delivery">Not set</span>
                        )}
                      </td>
                      <td>
                        <button
                          className="admin-icon-button"
                          aria-label={`Open ${lead.name}`}
                          onClick={() => setOpenId(lead.id)}
                        >
                          <ArrowUpRight size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {openId && (
        <LeadDrawer
          key={openId}
          scope={scope}
          api={api}
          lead={selected}
          invoices={data?.invoices ?? []}
          events={(data?.events ?? []).filter((e) => e.lead_id === openId)}
          busy={busy === openId}
          onPatch={(values, success) =>
            selected ? patch(selected, values, success) : Promise.resolve(false)
          }
          onClose={() => setOpenId(null)}
          onSaved={async (message) => {
            setNotice(message);
            setOpenId(null);
            await load();
          }}
        />
      )}
    </div>
  );
}

function LeadDrawer({
  scope,
  api,
  lead,
  invoices,
  events,
  busy,
  onPatch,
  onClose,
  onSaved,
}: {
  scope: Scope;
  api: string;
  lead: SalesLead | null;
  invoices: Invoice[];
  events: SalesEvent[];
  busy: boolean;
  onPatch: (values: Partial<SalesLead>, success?: string) => Promise<boolean>;
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
}) {
  const editing = lead ?? EMPTY;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const src = lead ? (SOURCES[lead.source_kind] ?? SOURCES.manual!) : null;
  const invoice = invoices.find((i) => i.id === lead?.invoice_id);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const f = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch(api, {
        method: lead ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...f,
          check_completed_at: f.check_completed_at || null,
          last_contact: f.last_contact || null,
          next_follow_up: f.next_follow_up || null,
          invoice_id: f.invoice_id || null,
          ...(lead ? { id: lead.id } : {}),
        }),
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error || "Could not save.");
      await onSaved(lead ? "Lead saved." : "Lead added.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="admin-drawer-backdrop"
      role="presentation"
      onClick={(e) => e.target === e.currentTarget && !saving && onClose()}
    >
      <aside
        className="admin-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={lead?.name ?? "New lead"}
      >
        <div className="admin-drawer-head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2>{lead?.name ?? "Add a lead"}</h2>
            {lead && (
              <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                <span className={`admin-status ${STAGE_TONE[lead.stage] ?? "draft"}`}>
                  {label(lead.stage)}
                </span>
                <span className="admin-status draft">{label(lead.project_status)}</span>
                {src && <span className="admin-status draft">{src.label}</span>}
              </div>
            )}
          </div>
          <button
            className="admin-icon-button"
            aria-label="Close"
            disabled={saving}
            onClick={onClose}
          >
            <X size={17} />
          </button>
        </div>

        {lead && (
          <div className="admin-drawer-card">
            <strong>Where this lead came from</strong>
            <p>
              {src?.label}
              {lead.context?.batch_label ? ` · Batch "${lead.context.batch_label}"` : ""}
              {lead.context?.book_title ? ` · Book "${lead.context.book_title}"` : ""}
              {lead.inquiry_context
                ? ` · ${lead.inquiry_context.help_with?.join(", ") || "General inquiry"}${lead.inquiry_context.source_path ? ` (from ${lead.inquiry_context.source_path})` : ""}`
                : ""}
              {scope === "admin" && lead.owner && lead.owner !== "hq360"
                ? ` · Owner: ${lead.owner_name}`
                : ""}
            </p>
            <PresenceNote presence={lead.context?.presence} />
            <div className="admin-button-row" style={{ flexWrap: "wrap" }}>
              <button
                className="admin-button admin-button-primary"
                disabled={busy}
                onClick={() =>
                  void onPatch(
                    { last_contact: today(), next_follow_up: addDays(3) },
                    "Contact logged — next follow-up in 3 days.",
                  )
                }
              >
                <CircleCheck size={15} /> Contacted today
              </button>
              {lead.email && (
                <a className="admin-button" href={`mailto:${lead.email}`}>
                  Email
                </a>
              )}
              {lead.report_url && (
                <a className="admin-button" href={lead.report_url} target="_blank" rel="noreferrer">
                  Report <ArrowUpRight size={14} />
                </a>
              )}
              {invoice && (
                <a
                  className="admin-button"
                  href={`/pay/${invoice.payment_token}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {invoice.number} · {invoice.status}
                </a>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="admin-alert" role="alert">
            <AlertCircle size={18} /> {error}
          </div>
        )}

        <form className="admin-invoice-form" onSubmit={save}>
          <div className="admin-form-grid">
            <label>
              Name
              <input name="name" required defaultValue={editing.name ?? ""} />
            </label>
            <label>
              Email
              <input name="email" type="email" defaultValue={editing.email ?? ""} />
            </label>
            <label>
              Sales stage
              <select name="stage" defaultValue={editing.stage}>
                {SALES_STAGES.map((s) => (
                  <option key={s} value={s}>
                    {label(s)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Project status
              <select name="project_status" defaultValue={editing.project_status}>
                {PROJECT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {label(s)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Last contact
              <input name="last_contact" type="date" defaultValue={editing.last_contact ?? ""} />
            </label>
            <label>
              Next follow-up
              <input
                name="next_follow_up"
                type="date"
                defaultValue={editing.next_follow_up ?? ""}
              />
            </label>
            <label>
              Assigned to
              <input name="assigned_to" defaultValue={editing.assigned_to ?? ""} />
            </label>
            <label>
              Agreed service
              <input
                name="agreed_service"
                list="lead-services"
                defaultValue={editing.agreed_service ?? ""}
              />
              <datalist id="lead-services">
                {AUTHOR_OFFERS.map((o) => (
                  <option key={o.slug} value={o.name} />
                ))}
              </datalist>
            </label>
            <label>
              Report link
              <input name="report_url" type="url" defaultValue={editing.report_url ?? ""} />
            </label>
            <label>
              Proposal link
              <input name="proposal_url" type="url" defaultValue={editing.proposal_url ?? ""} />
            </label>
            <label>
              Check completed
              <input
                name="check_completed_at"
                type="date"
                defaultValue={editing.check_completed_at ?? ""}
              />
            </label>
            <label>
              Linked invoice
              <select name="invoice_id" defaultValue={editing.invoice_id ?? ""}>
                <option value="">No invoice linked</option>
                {invoices.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.number} · {i.buyer_name} · {i.status}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Needs, scope and notes
            <textarea name="notes" rows={4} defaultValue={editing.notes ?? ""} />
          </label>
          <div className="admin-button-row">
            <button className="admin-button admin-button-primary" disabled={saving}>
              {saving ? "Saving…" : lead ? "Save lead" : "Add lead"}
            </button>
            <button type="button" className="admin-button" disabled={saving} onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>

        {lead && events.length > 0 && (
          <div className="admin-drawer-card">
            <strong>History</strong>
            <ul className="leads-history">
              {events.map((e) => (
                <li key={`${e.event}-${e.created_at}`}>
                  <span>
                    {e.event === "lead_created"
                      ? `Lead created (${label(SOURCES[e.detail]?.label ?? e.detail)})`
                      : e.event === "stage_changed"
                        ? `Sales stage → ${label(e.detail)}`
                        : e.event === "project_status_changed"
                          ? `Project → ${label(e.detail)}`
                          : label(e.event)}
                  </span>
                  <small>
                    {new Date(e.created_at).toLocaleString("en-GB", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </small>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>
    </div>
  );
}
