import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CircleCheck,
  Copy,
  Eye,
  FileText,
  Mail,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { ProposalDocument } from "./ProposalDocument";
import { EMPTY_PROPOSAL, type Proposal } from "@/lib/proposals";

async function call<T>(url: string, method = "GET", body?: unknown): Promise<T> {
  const res = await fetch(
    url,
    body
      ? { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) }
      : { method },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
  return data as T;
}

const FORMAT_HELP = [
  ["## Heading", "Section heading"],
  ["### Sub-heading", "Smaller heading"],
  ["- item", "Bullet list"],
  ["1. item", "Numbered list"],
  ["> Important: …", "Highlighted note"],
  ["| A | B |", "Table (first row is the header)"],
  ["**bold**", "Bold text"],
];

function when(value?: string | null) {
  return value
    ? new Date(value).toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";
}

export function ProposalsWorkspace() {
  const [items, setItems] = useState<Proposal[] | null>(null);
  const [draft, setDraft] = useState<Proposal | null>(null);
  const [view, setView] = useState<"edit" | "preview">("edit");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dirty, setDirty] = useState(false);
  const docRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const data = await call<{ items: Proposal[] }>("/api/admin/proposals");
      setItems(data.items);
    } catch (e) {
      setError((e as Error).message);
      setItems([]);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  function open(p: Proposal | null) {
    if (dirty && !window.confirm("Discard unsaved changes?")) return;
    setDraft(p ? { ...p } : { ...EMPTY_PROPOSAL, details: [...EMPTY_PROPOSAL.details] });
    setView("edit");
    setDirty(false);
    setError("");
    setNotice("");
  }
  function set<K extends keyof Proposal>(key: K, value: Proposal[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
    setDirty(true);
  }

  async function run(label: string, task: () => Promise<void>) {
    setBusy(label);
    setError("");
    setNotice("");
    try {
      await task();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  const payload = (p: Proposal) => ({
    title: p.title,
    client_name: p.client_name,
    client_email: p.client_email,
    subtitle: p.subtitle,
    details: p.details,
    body: p.body,
    prepared_by: p.prepared_by,
    prepared_by_role: p.prepared_by_role,
    footer_note: p.footer_note,
  });
  /** Saves if needed and returns the saved proposal. */
  async function save(): Promise<Proposal> {
    if (!draft) throw new Error("Nothing to save.");
    const res = draft.id
      ? await call<{ item: Proposal }>(`/api/admin/proposals/${draft.id}`, "PUT", payload(draft))
      : await call<{ item: Proposal }>("/api/admin/proposals", "POST", payload(draft));
    setDraft(res.item);
    setDirty(false);
    await load();
    return res.item;
  }
  const link = (p: Proposal) => `${window.location.origin}/proposal/${p.token}`;

  const sent = draft?.sent_at;
  return (
    <div style={{ display: "grid", gap: 18 }}>
      {error && (
        <div className="admin-alert" role="alert">
          <AlertCircle size={18} /> {error}
        </div>
      )}
      {notice && (
        <div className="admin-notice" role="status">
          <CircleCheck size={18} /> {notice}
        </div>
      )}

      {!draft ? (
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <h2>
                Proposals <span className="admin-count">{items?.length ?? 0}</span>
              </h2>
              <p>Long-form, branded proposals. Share a link, download a PDF or email the client.</p>
            </div>
            <button className="admin-button admin-button-primary" onClick={() => open(null)}>
              <Plus size={15} /> New proposal
            </button>
          </div>
          {!items ? (
            <div className="admin-empty" role="status">
              Loading proposals…
            </div>
          ) : items.length === 0 ? (
            <div className="admin-empty">
              <h3>No proposals yet</h3>
              <p>Create your first proposal and send it to a client in minutes.</p>
            </div>
          ) : (
            <div className="admin-table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Proposal</th>
                    <th>Client</th>
                    <th>Status</th>
                    <th>Views</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((p) => (
                    <tr key={p.id} style={{ cursor: "pointer" }} onClick={() => open(p)}>
                      <td>
                        <span className="admin-invoice-name">{p.title || "Untitled"}</span>
                        <small>Updated {when(p.updated_at)}</small>
                      </td>
                      <td>
                        {p.client_name || "—"}
                        <small>{p.client_email}</small>
                      </td>
                      <td>
                        <span className={`admin-status ${p.sent_at ? "paid" : "draft"}`}>
                          {p.sent_at ? `Sent ${when(p.sent_at)}` : "Draft"}
                        </span>
                      </td>
                      <td>
                        {p.views ?? 0}
                        {p.last_viewed_at && <small>Last {when(p.last_viewed_at)}</small>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : (
        <section className="admin-panel">
          <div className="admin-panel-heading" style={{ flexWrap: "wrap", gap: 12 }}>
            <div>
              <button
                className="admin-button"
                onClick={() => {
                  if (dirty && !window.confirm("Discard unsaved changes?")) return;
                  setDraft(null);
                  setDirty(false);
                }}
              >
                <X size={15} /> Close
              </button>
            </div>
            <div className="admin-button-row" style={{ flexWrap: "wrap" }}>
              <div className="admin-segmented">
                <button className={view === "edit" ? "active" : ""} onClick={() => setView("edit")}>
                  <Pencil size={13} /> Edit
                </button>
                <button
                  className={view === "preview" ? "active" : ""}
                  onClick={() => setView("preview")}
                >
                  <Eye size={13} /> Preview
                </button>
              </div>
              <button
                className="admin-button"
                disabled={!!busy}
                onClick={() =>
                  void run("save", async () => {
                    await save();
                    setNotice("Proposal saved.");
                  })
                }
              >
                <Save size={15} />{" "}
                {busy === "save" ? "Saving…" : dirty || !draft.id ? "Save" : "Saved"}
              </button>
              <button
                className="admin-button"
                disabled={!!busy}
                onClick={() =>
                  void run("copy", async () => {
                    const p = dirty || !draft.id ? await save() : draft;
                    await navigator.clipboard.writeText(link(p));
                    setNotice("Link copied. Anyone with the link can read this proposal.");
                  })
                }
              >
                <Copy size={15} /> Copy link
              </button>
              <button
                className="admin-button"
                disabled={!!busy}
                onClick={() =>
                  void run("pdf", async () => {
                    setView("preview");
                    await new Promise((r) => setTimeout(r, 150));
                    if (!docRef.current) throw new Error("Open the preview and try again.");
                    const m = await import("@/lib/quote-export");
                    await m.downloadQuotePdf(docRef.current, draft.title || "proposal");
                  })
                }
              >
                <FileText size={15} /> {busy === "pdf" ? "Preparing…" : "Download PDF"}
              </button>
              <button
                className="admin-button admin-button-primary"
                disabled={!!busy || !draft.client_email}
                title={draft.client_email ? "" : "Add the client's email first"}
                onClick={() =>
                  void run("send", async () => {
                    const p = dirty || !draft.id ? await save() : draft;
                    if (
                      !window.confirm(
                        `Email "${p.title}" to ${p.client_email}?${p.sent_at ? " It was already sent once." : ""}`,
                      )
                    )
                      return;
                    const res = await call<{ item: Proposal }>(
                      `/api/admin/proposals/${p.id}`,
                      "POST",
                      {},
                    );
                    setDraft(res.item);
                    await load();
                    setNotice(`Proposal emailed to ${p.client_email}.`);
                  })
                }
              >
                <Mail size={15} />{" "}
                {busy === "send" ? "Sending…" : sent ? "Send again" : "Send to client"}
              </button>
              {draft.id && (
                <button
                  className="admin-button text-destructive"
                  disabled={!!busy}
                  onClick={() =>
                    window.confirm(`Delete "${draft.title}"? The link will stop working.`) &&
                    void run("delete", async () => {
                      await call(`/api/admin/proposals/${draft.id}`, "DELETE");
                      setDraft(null);
                      setDirty(false);
                      await load();
                      setNotice("Proposal deleted.");
                    })
                  }
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          </div>
          {sent && (
            <p className="admin-form-note" style={{ marginTop: -6 }}>
              Sent to {draft.sent_to} on {when(sent)} · {draft.views ?? 0} view
              {draft.views === 1 ? "" : "s"}
              {draft.last_viewed_at ? ` · last opened ${when(draft.last_viewed_at)}` : ""}
            </p>
          )}

          {view === "preview" ? (
            <div style={{ margin: "0 -8px", borderRadius: 16, overflow: "hidden" }}>
              <ProposalDocument proposal={draft} ref={docRef} />
            </div>
          ) : (
            <div className="admin-invoice-form">
              <div className="admin-form-grid">
                <label>
                  Proposal title
                  <input
                    value={draft.title}
                    maxLength={200}
                    placeholder="US Book Visibility & Reader Acquisition Proposal"
                    onChange={(e) => set("title", e.target.value)}
                  />
                </label>
                <label>
                  Subtitle
                  <input
                    value={draft.subtitle}
                    maxLength={300}
                    placeholder="Author of …"
                    onChange={(e) => set("subtitle", e.target.value)}
                  />
                </label>
                <label>
                  Client name
                  <input
                    value={draft.client_name}
                    maxLength={160}
                    onChange={(e) => set("client_name", e.target.value)}
                  />
                </label>
                <label>
                  Client email
                  <input
                    type="email"
                    value={draft.client_email}
                    maxLength={254}
                    onChange={(e) => set("client_email", e.target.value)}
                  />
                </label>
              </div>

              <div>
                <strong style={{ fontSize: 12 }}>Cover details</strong>
                <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                  {draft.details.map((d, i) => (
                    <div
                      key={i}
                      className="admin-form-grid"
                      style={{ gridTemplateColumns: "1fr 2fr auto" }}
                    >
                      <input
                        aria-label="Label"
                        placeholder="Label, e.g. Campaign duration"
                        value={d.label}
                        onChange={(e) =>
                          set(
                            "details",
                            draft.details.map((x, j) =>
                              j === i ? { ...x, label: e.target.value } : x,
                            ),
                          )
                        }
                      />
                      <input
                        aria-label="Value"
                        placeholder="Value, e.g. 90 days"
                        value={d.value}
                        onChange={(e) =>
                          set(
                            "details",
                            draft.details.map((x, j) =>
                              j === i ? { ...x, value: e.target.value } : x,
                            ),
                          )
                        }
                      />
                      <button
                        type="button"
                        className="admin-icon-button"
                        aria-label="Remove detail"
                        onClick={() =>
                          set(
                            "details",
                            draft.details.filter((_, j) => j !== i),
                          )
                        }
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  {draft.details.length < 12 && (
                    <button
                      type="button"
                      className="admin-button"
                      style={{ justifySelf: "start" }}
                      onClick={() => set("details", [...draft.details, { label: "", value: "" }])}
                    >
                      <Plus size={14} /> Add detail
                    </button>
                  )}
                </div>
              </div>

              <label>
                Proposal content
                <textarea
                  value={draft.body}
                  rows={24}
                  maxLength={100000}
                  style={{
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    lineHeight: 1.55,
                  }}
                  placeholder={"## 1. Executive Summary\n\nWrite the proposal here…"}
                  onChange={(e) => set("body", e.target.value)}
                />
              </label>
              <div
                className="admin-form-note"
                style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px" }}
              >
                {FORMAT_HELP.map(([code, what]) => (
                  <span key={code}>
                    <code>{code}</code> {what}
                  </span>
                ))}
              </div>

              <div className="admin-form-grid">
                <label>
                  Prepared by
                  <input
                    value={draft.prepared_by}
                    maxLength={160}
                    onChange={(e) => set("prepared_by", e.target.value)}
                  />
                </label>
                <label>
                  Role
                  <input
                    value={draft.prepared_by_role}
                    maxLength={160}
                    onChange={(e) => set("prepared_by_role", e.target.value)}
                  />
                </label>
              </div>
              <label>
                Footer note
                <input
                  value={draft.footer_note}
                  maxLength={600}
                  placeholder="Private proposal prepared for … Subject to final scope, pricing approval and written agreement."
                  onChange={(e) => set("footer_note", e.target.value)}
                />
              </label>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
