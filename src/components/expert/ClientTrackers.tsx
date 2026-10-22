import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AlertCircle, ArrowDown, ArrowUp, CircleCheck, Copy, Eye, GripVertical, Sparkles, Trash2 } from "lucide-react";
import { ITEM_STATUSES, STATUS_LABEL, type ClientSnapshot, type ItemBlocks, type ItemStatus } from "@/lib/trackers/core";
import { TrackerView } from "@/components/trackers/TrackerView";
import { actorHeaders, setTrackerAdminMode } from "./tracker-actor";

type TrackerSummary = {
  id: string;
  client_name: string;
  project_title: string;
  package_name: string;
  status: "draft" | "live" | "archived";
  url: string;
  progress: number;
  updated_at: string;
  viewsThisWeek: number;
  lastViewedAt: string | null;
  /** The owning expert (shown to admin). */
  expert?: { full_name: string | null; email: string | null } | null;
};
type Template = { id: string; name: string; package_name: string };
type Item = {
  id: string;
  title: string;
  status: ItemStatus;
  progress: number;
  description: string;
  is_free_bonus: boolean;
  portfolio_ready: boolean;
  portfolio_blurb: string;
  blocks: ItemBlocks;
};
type FileRow = { id: string; item_id: string; kind: string; filename: string; size: number };
type Log = { id: string; entry_date: string; text: string; source: "manual" | "ai" };
type Draft = { id: string; item_id: string | null; action: string; output: Record<string, string> };
type Views = {
  opensThisWeek: number;
  uniqueVisitorsThisWeek: number;
  unlocksThisWeek: number;
  failedThisWeek: number;
  lastViewedAt: string | null;
  byDay: { day: string; opens: number }[];
  engagement: Record<string, { plays: number; downloads: number }>;
};
type Detail = {
  tracker: TrackerSummary & {
    client_email: string | null;
    slug: string;
    portfolio_consent: boolean;
    consent_at: string | null;
    consent_method: string | null;
    consent_allows_naming: boolean;
    published_at: string | null;
    hasPasscode: boolean;
    passcode: string | null;
  };
  items: Item[];
  files: FileRow[];
  log: Log[];
  drafts: Draft[];
  views: Views;
};

async function call<T = Record<string, unknown>>(url: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: actorHeaders(body === undefined ? {} : { "content-type": "application/json" }),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Something went wrong. Please try again.");
  return data as T;
}

export function relativeTime(iso: string | null) {
  if (!iso) return "not yet";
  const date = new Date(iso);
  const today = new Date();
  const time = date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  if (date.toDateString() === today.toDateString()) return `today ${time}`;
  return `${date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} ${time}`;
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="admin-button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* clipboard blocked */
        }
      }}
    >
      <Copy size={14} aria-hidden="true" /> {done ? "Copied" : label}
    </button>
  );
}

function Alerts({ error, notice }: { error: string; notice: string }) {
  return (
    <>
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
    </>
  );
}

/** Shown once after creating a tracker or resetting its passcode. */
function OneTimePasscode({ url, passcode, onDone }: { url: string; passcode: string; onDone: () => void }) {
  return (
    <div className="admin-notice" role="status" style={{ display: "block" }}>
      <p style={{ margin: "0 0 8px" }}>
        <b>Send these to your client.</b> You can see this passcode on the tracker until you replace it.
      </p>
      <p style={{ margin: "4px 0", wordBreak: "break-all" }}>
        Link: <code>{url}</code> <CopyButton text={url} label="Copy link" />
      </p>
      <p style={{ margin: "4px 0" }}>
        Passcode: <code style={{ fontSize: "1.1em" }}>{passcode}</code> <CopyButton text={passcode} label="Copy passcode" />
      </p>
      <button type="button" className="admin-button" onClick={onDone} style={{ marginTop: 8 }}>
        I have saved it
      </button>
    </div>
  );
}

/** `admin`: used inside the admin panel, where every expert's trackers show. */
export function ClientTrackers({ admin = false }: { admin?: boolean }) {
  setTrackerAdminMode(admin);
  const [trackers, setTrackers] = useState<TrackerSummary[] | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<{ url: string; passcode: string } | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await call<{ trackers: TrackerSummary[]; templates: Template[] }>("/api/expert/trackers");
      setTrackers(data.trackers);
      setTemplates(data.templates);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load trackers.");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  if (openId)
    return (
      <TrackerEditor
        id={openId}
        onBack={() => {
          setOpenId(null);
          void load();
        }}
      />
    );

  return (
    <section className="admin-content-panel">
      <div className="admin-panel-heading" style={{ padding: "0 0 1.5rem" }}>
        <div>
          <h2>Client tracking pages</h2>
          <p>A private, passcode protected progress page for each client. Clients see only what you publish.</p>
        </div>
        {!creating && (
          <button className="admin-button admin-button-primary" onClick={() => setCreating(true)}>
            New tracker
          </button>
        )}
      </div>
      <Alerts error={error} notice="" />
      {created && <OneTimePasscode {...created} onDone={() => setCreated(null)} />}
      {creating && (
        <CreateTracker
          admin={admin}
          templates={templates}
          onCancel={() => setCreating(false)}
          onCreated={(result) => {
            setCreating(false);
            // Stay on the list so the one time passcode is seen before opening the tracker.
            setCreated({ url: result.url, passcode: result.passcode });
            void load();
          }}
        />
      )}
      {trackers === null ? (
        <p>Loading…</p>
      ) : trackers.length === 0 ? (
        <div className="admin-empty">
          <h3>No trackers yet</h3>
          <p>Create one for a client, add their package items and share the link and passcode.</p>
        </div>
      ) : (
        <div className="admin-table-wrap" style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Client</th>
                {admin && <th scope="col">Expert</th>}
                <th scope="col">Project</th>
                <th scope="col">Progress</th>
                <th scope="col">Last update</th>
                <th scope="col">Views</th>
                <th scope="col">Link</th>
              </tr>
            </thead>
            <tbody>
              {trackers.map((t) => (
                <tr key={t.id}>
                  <td>
                    <button type="button" className="admin-link-button" onClick={() => setOpenId(t.id)}>
                      {t.client_name}
                    </button>
                    <br />
                    <small>{t.status === "live" ? "Live" : t.status === "draft" ? "Draft" : "Archived"}</small>
                  </td>
                  {admin && <td>{t.expert?.full_name || t.expert?.email || "—"}</td>}
                  <td>{t.project_title || "—"}</td>
                  <td>{t.progress}%</td>
                  <td>{relativeTime(t.updated_at)}</td>
                  <td>
                    Viewed {t.viewsThisWeek} {t.viewsThisWeek === 1 ? "time" : "times"} this week
                    <br />
                    <small>last viewed {relativeTime(t.lastViewedAt)}</small>
                  </td>
                  <td>
                    <CopyButton text={t.url} label="Copy link" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function CreateTracker({
  admin,
  templates,
  onCancel,
  onCreated,
}: {
  admin: boolean;
  templates: Template[];
  onCancel: () => void;
  onCreated: (result: { tracker: { id: string }; url: string; passcode: string }) => void;
}) {
  const [form, setForm] = useState({ clientName: "", clientEmail: "", projectTitle: "", packageName: "", passcode: "", templateId: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // Admin creates trackers on behalf of an approved expert, who then owns them.
  const [experts, setExperts] = useState<{ id: string; label: string }[]>([]);
  const [expertId, setExpertId] = useState("");
  useEffect(() => {
    if (!admin) return;
    fetch("/api/admin/experts")
      .then((r) => r.json())
      .then((data: { experts?: { id: string; full_name: string | null; email: string; status: string; is_guest?: boolean }[] }) =>
        setExperts(
          (data.experts ?? [])
            .filter((e) => e.status === "approved" && !e.is_guest)
            .map((e) => ({ id: e.id, label: e.full_name ? `${e.full_name} (${e.email})` : e.email })),
        ),
      )
      .catch(() => setError("Could not load the experts list."));
  }, [admin]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await call<{ tracker: { id: string }; url: string; passcode: string }>("/api/expert/trackers", "POST", {
        clientName: form.clientName,
        clientEmail: form.clientEmail,
        projectTitle: form.projectTitle,
        packageName: form.packageName,
        ...(form.passcode ? { passcode: form.passcode } : {}),
        ...(form.templateId ? { templateId: form.templateId } : {}),
        ...(admin ? { expertId } : {}),
      });
      onCreated(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the tracker.");
    } finally {
      setBusy(false);
    }
  }
  const field = (key: keyof typeof form, label: string, extra: Record<string, unknown> = {}) => (
    <label className="admin-field">
      <span>{label}</span>
      <input value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} {...extra} />
    </label>
  );
  return (
    <form className="admin-invoice-form" onSubmit={submit} style={{ marginBottom: "1.5rem" }}>
      <Alerts error={error} notice="" />
      <div className="admin-form-grid" style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        {admin && (
          <label className="admin-field">
            <span>Expert who owns this tracker</span>
            <select required value={expertId} onChange={(e) => setExpertId(e.target.value)}>
              <option value="">Choose an expert</option>
              {experts.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.label}
                </option>
              ))}
            </select>
          </label>
        )}
        {field("clientName", "Client name", { required: true, maxLength: 120 })}
        {field("clientEmail", "Client email", { type: "email", maxLength: 254 })}
        {field("projectTitle", "Project or book title", { maxLength: 200 })}
        {field("packageName", "Package", { maxLength: 120 })}
        {field("passcode", "Passcode (leave empty to generate WORD-1234)", { maxLength: 64, autoComplete: "off" })}
        <label className="admin-field">
          <span>Start from a template</span>
          <select value={form.templateId} onChange={(e) => setForm({ ...form, templateId: e.target.value })}>
            <option value="">Empty tracker</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button className="admin-button admin-button-primary" disabled={busy}>
          {busy ? "Creating…" : "Create tracker"}
        </button>
        <button type="button" className="admin-button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function TrackerEditor({ id, onBack }: { id: string; onBack: () => void }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState<ClientSnapshot | null>(null);
  const [passcode, setPasscode] = useState<string | null>(null);
  const [notify, setNotify] = useState(false);
  const [newItem, setNewItem] = useState("");
  const [logText, setLogText] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [aiReady, setAiReady] = useState(false);

  const load = useCallback(async () => {
    try {
      setDetail(await call<Detail>(`/api/expert/trackers/${id}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the tracker.");
    }
  }, [id]);
  useEffect(() => {
    void load();
    call<{ perplexity?: { configured: boolean }; other?: { configured: boolean } }>(
      "/api/expert/ai-key",
    )
      .then((data) => setAiReady(Boolean(data.perplexity?.configured || data.other?.configured)))
      .catch(() => setAiReady(false));
  }, [load]);

  const act = useCallback(
    async (body: Record<string, unknown>, success = "") => {
      setError("");
      setNotice("");
      try {
        const result = await call<Record<string, unknown>>(`/api/expert/trackers/${id}`, "POST", body);
        if (success) setNotice(success);
        await load();
        return result;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save.");
        return null;
      }
    },
    [id, load],
  );

  if (!detail)
    return (
      <section className="admin-content-panel">
        <Alerts error={error} notice="" />
        <p>Loading…</p>
      </section>
    );
  const { tracker, items, files, log, drafts, views } = detail;

  async function reorder(ids: string[]) {
    await act({ action: "reorder", itemIds: ids });
  }
  const move = (index: number, delta: number) => {
    const ids = items.map((i) => i.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    void reorder(ids);
  };

  async function upload(itemId: string, file: File) {
    const result = await act({
      action: "uploadUrl",
      itemId,
      filename: file.name,
      contentType: file.type || "application/octet-stream",
      size: file.size,
    });
    if (!result) return;
    const put = await fetch(result.uploadUrl as string, {
      method: "PUT",
      headers: { "content-type": file.type || "application/octet-stream", "x-upsert": "false" },
      body: file,
    });
    if (!put.ok) {
      await act({ action: "deleteFile", fileId: (result.file as { id: string }).id });
      setError("The upload did not finish. Please try again.");
    } else setNotice(`${file.name} uploaded.`);
  }

  const maxOpens = Math.max(1, ...views.byDay.map((d) => d.opens));

  return (
    <section className="admin-content-panel">
      <div className="admin-panel-heading" style={{ padding: "0 0 1rem" }}>
        <div>
          <button type="button" className="admin-link-button" onClick={onBack}>
            ← All trackers
          </button>
          <h2>{tracker.client_name}</h2>
          <p>
            {tracker.project_title} {tracker.package_name ? `· ${tracker.package_name}` : ""} ·{" "}
            {tracker.status === "live" ? `Live, published ${relativeTime(tracker.published_at)}` : tracker.status === "draft" ? "Draft, not published yet" : "Archived"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button
            type="button"
            className="admin-button"
            onClick={async () => {
              const result = await act({ action: "preview" });
              if (result) setPreview(result.page as ClientSnapshot);
            }}
          >
            <Eye size={14} aria-hidden="true" /> Preview as client
          </button>
          <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} disabled={!tracker.client_email} />
            Notify client
          </label>
          <button
            type="button"
            className="admin-button admin-button-primary"
            onClick={async () => {
              const result = await act({ action: "publish", notify });
              if (result)
                setNotice(
                  `Published. ${result.notified ? "Your client was emailed the link (never the passcode)." : ""}${result.pendingAiDrafts ? " AI drafts still waiting for review were not included." : ""}`,
                );
            }}
          >
            Publish
          </button>
        </div>
      </div>
      <Alerts error={error} notice={notice} />
      {passcode && <OneTimePasscode url={tracker.url} passcode={passcode} onDone={() => setPasscode(null)} />}

      {preview && (
        <div role="dialog" aria-modal="true" aria-label="Preview as client" className="admin-modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 50, overflow: "auto" }}>
          <div style={{ maxWidth: 900, margin: "24px auto" }}>
            <button type="button" className="admin-button admin-button-primary" onClick={() => setPreview(null)} autoFocus>
              Close preview
            </button>
            <div className="trk-shell" style={{ minHeight: 0, borderRadius: 12, marginTop: 8 }}>
              <TrackerView page={preview} fileHref={null} />
            </div>
          </div>
        </div>
      )}

      <div className="admin-setup" style={{ display: "grid", gap: 8, marginBottom: 16 }}>
        <p style={{ margin: 0, wordBreak: "break-all" }}>
          <b>Link:</b> <code>{tracker.url}</code> <CopyButton text={tracker.url} label="Copy link" />{" "}
          {tracker.published_at ? (
            <a href={tracker.url} target="_blank" rel="noreferrer" className="admin-button">
              Open
            </a>
          ) : (
            <small>Publish once to make the link work.</small>
          )}
        </p>
        <p style={{ margin: 0 }}>
          <b>Passcode:</b>{" "}
          {tracker.passcode ? (
            <>
              <code style={{ fontSize: "1.1em" }}>{tracker.passcode}</code>{" "}
              <CopyButton text={tracker.passcode} label="Copy passcode" />
            </>
          ) : tracker.hasPasscode ? (
            "set before passcodes were kept visible. Replace it once to see it here."
          ) : (
            "not set"
          )}{" "}
          <button
            type="button"
            className="admin-button"
            onClick={async () => {
              const chosen = window.prompt("Type a passcode to keep (for example an existing one), or leave empty to generate a new WORD-1234 passcode. Clients signed in on other devices will need the new one.");
              if (chosen === null) return;
              const result = await act({ action: "resetPasscode", ...(chosen.trim() ? { passcode: chosen.trim() } : {}) });
              if (result) setPasscode(result.passcode as string);
            }}
          >
            Replace passcode
          </button>
        </p>
      </div>

      <h3>Views</h3>
      <p>
        Viewed {views.opensThisWeek} times this week by {views.uniqueVisitorsThisWeek} {views.uniqueVisitorsThisWeek === 1 ? "device" : "devices"}, last viewed{" "}
        {relativeTime(views.lastViewedAt)}. Unlocks: {views.unlocksThisWeek}. Wrong passcodes: {views.failedThisWeek}.
      </p>
      <div role="img" aria-label={`Opens per day for the last 14 days: ${views.byDay.map((d) => d.opens).join(", ")}`} style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 60, marginBottom: 20 }}>
        {views.byDay.map((d) => (
          <div key={d.day} title={`${d.day}: ${d.opens}`} style={{ flex: 1, height: `${(d.opens / maxOpens) * 100}%`, minHeight: 2, background: "var(--admin-accent, #ff5a00)", borderRadius: 3 }} />
        ))}
      </div>

      <h3>Package items</h3>
      <p>Drag to reorder, or use the arrow buttons. Changes stay private until you publish.</p>
      <ol style={{ listStyle: "none", padding: 0, display: "grid", gap: 12 }}>
        {items.map((item, index) => (
          <li
            key={item.id}
            draggable
            onDragStart={() => setDragId(item.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (!dragId || dragId === item.id) return;
              const ids = items.map((i) => i.id).filter((x) => x !== dragId);
              ids.splice(index, 0, dragId);
              setDragId(null);
              void reorder(ids);
            }}
            className="admin-card"
            style={{ border: "1px solid var(--admin-line, #ddd)", borderRadius: 12, padding: 14 }}
          >
            <ItemEditor
              item={item}
              files={files.filter((f) => f.item_id === item.id)}
              engagement={views.engagement[item.id]}
              consent={tracker.portfolio_consent}
              aiReady={aiReady}
              onSave={(patch, success) => act({ action: "updateItem", itemId: item.id, patch }, success)}
              onDelete={() => {
                if (window.confirm(`Delete "${item.title}" and its files?`)) void act({ action: "deleteItem", itemId: item.id });
              }}
              onUpload={(file) => upload(item.id, file)}
              onDeleteFile={(fileId) => act({ action: "deleteFile", fileId })}
              onAi={(body) => act({ action: "aiDraft", itemId: item.id, ...body }, "AI draft ready below. Review it before it can be used.")}
              handle={
                <span style={{ display: "inline-flex", gap: 4 }}>
                  <GripVertical size={16} aria-hidden="true" />
                  <button type="button" className="admin-icon-button" aria-label={`Move ${item.title} up`} onClick={() => move(index, -1)} disabled={index === 0}>
                    <ArrowUp size={14} />
                  </button>
                  <button type="button" className="admin-icon-button" aria-label={`Move ${item.title} down`} onClick={() => move(index, 1)} disabled={index === items.length - 1}>
                    <ArrowDown size={14} />
                  </button>
                </span>
              }
            />
          </li>
        ))}
      </ol>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!newItem.trim()) return;
          void act({ action: "addItem", title: newItem.trim() }).then(() => setNewItem(""));
        }}
        style={{ display: "flex", gap: 8, marginBottom: 24 }}
      >
        <label className="admin-field" style={{ flex: 1 }}>
          <span className="sr-only">New item title</span>
          <input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="New item, e.g. Press kit" maxLength={200} />
        </label>
        <button className="admin-button">Add item</button>
      </form>

      {drafts.length > 0 && <DraftReview drafts={drafts} items={items} act={act} />}

      <h3>Updates log</h3>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!logText.trim()) return;
          void act({ action: "addLog", text: logText.trim() }).then((r) => r && setLogText(""));
        }}
        style={{ display: "grid", gap: 8, marginBottom: 12 }}
      >
        <label className="admin-field">
          <span>New update for the client (dated today)</span>
          <textarea value={logText} onChange={(e) => setLogText(e.target.value)} rows={2} maxLength={2000} />
        </label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="admin-button">Add update</button>
          {aiReady && (
            <button
              type="button"
              className="admin-button"
              onClick={() => logText.trim() && act({ action: "aiDraft", kind: "draft_update", notes: logText.trim() }, "AI draft ready below. Review it first.")}
            >
              <Sparkles size={14} aria-hidden="true" /> Draft from these notes with AI
            </button>
          )}
          {aiReady && (
            <button type="button" className="admin-button" onClick={() => act({ action: "aiDraft", kind: "progress_summary" }, "Summary draft ready below.")}>
              <Sparkles size={14} aria-hidden="true" /> Progress summary for an email
            </button>
          )}
        </div>
      </form>
      <ul style={{ paddingLeft: 18 }}>
        {log.map((entry) => (
          <li key={entry.id} style={{ marginBottom: 6 }}>
            <b>{entry.entry_date}</b> {entry.text} {entry.source === "ai" && <small>(AI assisted, approved)</small>}{" "}
            <button type="button" className="admin-link-button" onClick={() => act({ action: "deleteLog", entryId: entry.id })}>
              Remove
            </button>
          </li>
        ))}
      </ul>

      <ConsentPanel tracker={tracker} act={act} />

      <h3>More</h3>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          className="admin-button"
          onClick={() => {
            const name = window.prompt("Template name, for example Premium author package", tracker.package_name || "");
            if (name?.trim()) void act({ action: "saveTemplate", name: name.trim() }, "Saved as a template.");
          }}
        >
          Save items as a template
        </button>
        <button
          type="button"
          className="admin-button"
          onClick={async () => {
            if (!window.confirm("Archive this tracker? The client page stops working and portfolio entries from it are removed.")) return;
            try {
              await call(`/api/expert/trackers/${id}`, "PATCH", { status: "archived" });
              await load();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Could not archive.");
            }
          }}
        >
          Archive
        </button>
        <button
          type="button"
          className="admin-button"
          onClick={async () => {
            if (!window.confirm("Delete this tracker, its files and any portfolio entries from it? This cannot be undone.")) return;
            try {
              await call(`/api/expert/trackers/${id}`, "DELETE");
              onBack();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Could not delete.");
            }
          }}
        >
          <Trash2 size={14} aria-hidden="true" /> Delete
        </button>
      </div>
    </section>
  );
}

function ItemEditor({
  item,
  files,
  engagement,
  consent,
  aiReady,
  onSave,
  onDelete,
  onUpload,
  onDeleteFile,
  onAi,
  handle,
}: {
  item: Item;
  files: FileRow[];
  engagement?: { plays: number; downloads: number };
  consent: boolean;
  aiReady: boolean;
  onSave: (patch: Record<string, unknown>, success?: string) => Promise<unknown>;
  onDelete: () => void;
  onUpload: (file: File) => Promise<void>;
  onDeleteFile: (id: string) => Promise<unknown>;
  onAi: (body: Record<string, unknown>) => Promise<unknown>;
  handle: React.ReactNode;
}) {
  const [draft, setDraft] = useState({
    title: item.title,
    description: item.description,
    progress: item.progress,
    blocksText: JSON.stringify(item.blocks ?? {}, null, 2),
    blurb: item.portfolio_blurb,
  });
  const [open, setOpen] = useState(false);
  const [blocksError, setBlocksError] = useState("");
  useEffect(() => {
    setDraft({
      title: item.title,
      description: item.description,
      progress: item.progress,
      blocksText: JSON.stringify(item.blocks ?? {}, null, 2),
      blurb: item.portfolio_blurb,
    });
  }, [item]);
  const idBase = `item-${item.id}`;
  return (
    <div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        {handle}
        <b style={{ flex: "1 1 200px" }}>{item.title}</b>
        {item.is_free_bonus && <small>Free bonus</small>}
        <label>
          <span className="sr-only">Status of {item.title}</span>
          <select value={item.status} onChange={(e) => void onSave({ status: e.target.value })}>
            {ITEM_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <span>{item.progress}%</span>
        {engagement && (
          <small>
            {engagement.plays} plays · {engagement.downloads} downloads
          </small>
        )}
        <button type="button" className="admin-button" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {open ? "Close" : "Edit"}
        </button>
      </div>
      {open && (
        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          <label className="admin-field">
            <span>Title</span>
            <input value={draft.title} maxLength={200} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </label>
          <label className="admin-field">
            <span>Progress: {draft.progress}%</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={draft.progress}
              disabled={item.status === "done"}
              onChange={(e) => setDraft({ ...draft, progress: Number(e.target.value) })}
            />
          </label>
          <label className="admin-field">
            <span>Description the client sees</span>
            <textarea rows={3} maxLength={4000} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </label>
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" checked={item.is_free_bonus} onChange={(e) => void onSave({ is_free_bonus: e.target.checked })} />
            Free bonus (not counted in the overall progress)
          </label>
          <details>
            <summary>Checklist, list tracker, button and highlight box (advanced)</summary>
            <p style={{ fontSize: 13 }}>
              JSON with any of: <code>checklist</code> [{"{text, done}"}], <code>lists</code> [{"{name, link, position}"}],{" "}
              <code>button</code> {"{label, url}"}, <code>highlight</code> {"{text, imageFileId}"}. File ids are listed below.
            </p>
            <label className="admin-field">
              <span className="sr-only">Blocks JSON for {item.title}</span>
              <textarea rows={8} value={draft.blocksText} onChange={(e) => setDraft({ ...draft, blocksText: e.target.value })} style={{ fontFamily: "monospace", fontSize: 12 }} />
            </label>
            {blocksError && <p role="alert">{blocksError}</p>}
          </details>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="admin-button admin-button-primary"
              onClick={() => {
                let blocks: unknown;
                try {
                  blocks = JSON.parse(draft.blocksText || "{}");
                  setBlocksError("");
                } catch {
                  setBlocksError("The advanced section is not valid JSON.");
                  return;
                }
                void onSave(
                  { title: draft.title, description: draft.description, progress: draft.progress, blocks },
                  "Item saved. Publish when you are ready for the client to see it.",
                );
              }}
            >
              Save item
            </button>
            {aiReady && (
              <button type="button" className="admin-button" onClick={() => void onAi({ kind: "friendly_rewrite", text: draft.description })}>
                <Sparkles size={14} aria-hidden="true" /> Client friendly rewrite
              </button>
            )}
            <button type="button" className="admin-button" onClick={onDelete}>
              Delete item
            </button>
          </div>

          <div>
            <b>Files</b>
            <ul>
              {files.map((f) => (
                <li key={f.id}>
                  {f.filename} <small>({f.kind}, id {f.id})</small>{" "}
                  <button type="button" className="admin-link-button" onClick={() => void onDeleteFile(f.id)}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            <label className="admin-field">
              <span>Upload image, video, PDF or other file (up to 200 MB)</span>
              <input
                type="file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void onUpload(file);
                  e.target.value = "";
                }}
              />
            </label>
          </div>

          <fieldset style={{ border: "1px solid var(--admin-line, #ddd)", borderRadius: 10, padding: 10 }}>
            <legend>Portfolio</legend>
            {!consent && <p style={{ margin: 0 }}>Record client consent below before anything can go to your portfolio.</p>}
            <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="checkbox"
                id={`${idBase}-ready`}
                checked={item.portfolio_ready}
                disabled={item.status !== "done"}
                onChange={(e) => void onSave({ portfolio_ready: e.target.checked })}
              />
              Portfolio ready {item.status !== "done" && "(mark the item Complete first)"}
            </label>
            <label className="admin-field">
              <span>Portfolio blurb (2 to 3 sentences, no private details)</span>
              <textarea rows={3} maxLength={900} value={draft.blurb} onChange={(e) => setDraft({ ...draft, blurb: e.target.value })} />
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className="admin-button" onClick={() => void onSave({ portfolio_blurb: draft.blurb }, "Blurb saved.")}>
                Save blurb
              </button>
              {aiReady && item.status === "done" && (
                <button type="button" className="admin-button" onClick={() => void onAi({ kind: "portfolio_blurb" })}>
                  <Sparkles size={14} aria-hidden="true" /> Draft blurb with AI
                </button>
              )}
            </div>
          </fieldset>
        </div>
      )}
    </div>
  );
}

const ACTION_LABEL: Record<string, string> = {
  draft_update: "Update from notes",
  friendly_rewrite: "Client friendly rewrite",
  progress_summary: "Progress summary for an email",
  portfolio_blurb: "Portfolio blurb",
};

/** AI drafts wait here. Nothing reaches the client until a person approves and then publishes. */
function DraftReview({
  drafts,
  items,
  act,
}: {
  drafts: Draft[];
  items: Item[];
  act: (body: Record<string, unknown>, success?: string) => Promise<Record<string, unknown> | null>;
}) {
  const [edits, setEdits] = useState<Record<string, Record<string, string>>>({});
  return (
    <div className="admin-setup" style={{ marginBottom: 24 }}>
      <h3 style={{ marginTop: 0 }}>AI drafts waiting for your review</h3>
      <p>Edit if needed, then approve. Approved text goes into the tracker; the client sees it only after you publish.</p>
      {drafts.map((draft) => {
        const values = { ...draft.output, ...(edits[draft.id] ?? {}) };
        const item = items.find((i) => i.id === draft.item_id);
        return (
          <div key={draft.id} style={{ borderTop: "1px solid var(--admin-line, #ddd)", paddingTop: 10, marginTop: 10 }}>
            <p style={{ margin: "0 0 6px" }}>
              <span className="admin-badge">AI draft</span> {ACTION_LABEL[draft.action]} {item ? `· ${item.title}` : ""}
            </p>
            {Object.entries(values).map(([key, value]) => (
              <label key={key} className="admin-field">
                <span>{key === "log_entry" ? "Log entry" : key === "description" ? "Item description" : "Text"}</span>
                <textarea rows={3} value={value} onChange={(e) => setEdits({ ...edits, [draft.id]: { ...(edits[draft.id] ?? {}), [key]: e.target.value } })} />
              </label>
            ))}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {draft.action === "progress_summary" ? (
                <CopyButton text={values.text ?? ""} label="Copy for email" />
              ) : null}
              <button
                type="button"
                className="admin-button admin-button-primary"
                onClick={() =>
                  act(
                    { action: "approveDraft", draftId: draft.id, ...(edits[draft.id] ? { edited: edits[draft.id] } : {}) },
                    draft.action === "progress_summary" ? "Summary approved." : "Approved. Publish when you want the client to see it.",
                  )
                }
              >
                Approve
              </button>
              <button type="button" className="admin-button" onClick={() => act({ action: "discardDraft", draftId: draft.id })}>
                Discard
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ConsentPanel({
  tracker,
  act,
}: {
  tracker: Detail["tracker"];
  act: (body: Record<string, unknown>, success?: string) => Promise<Record<string, unknown> | null>;
}) {
  const [method, setMethod] = useState("");
  const [naming, setNaming] = useState(false);
  return (
    <div className="admin-setup" style={{ margin: "24px 0" }}>
      <h3 style={{ marginTop: 0 }}>Client agreed to portfolio use</h3>
      {tracker.portfolio_consent ? (
        <>
          <p>
            Consent recorded {tracker.consent_at ? new Date(tracker.consent_at).toLocaleDateString("en-GB") : ""} ({tracker.consent_method}).{" "}
            {tracker.consent_allows_naming ? "The client or book may be named." : "Entries do not name the client or book."}
          </p>
          <button
            type="button"
            className="admin-button"
            onClick={() => {
              if (window.confirm("Withdraw consent? Every portfolio entry from this tracker is removed now."))
                void act({ action: "consent", consent: false }, "Consent withdrawn. Portfolio entries from this tracker were removed.");
            }}
          >
            Withdraw consent
          </button>
        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void act({ action: "consent", consent: true, method, allowsNaming: naming }, "Consent recorded.");
          }}
          style={{ display: "grid", gap: 8 }}
        >
          <p style={{ margin: 0 }}>Without this, nothing from this tracker is ever published to your portfolio.</p>
          <label className="admin-field">
            <span>How consent was given</span>
            <input required minLength={2} maxLength={300} value={method} onChange={(e) => setMethod(e.target.value)} placeholder="Email reply on 20 Oct 2026" />
          </label>
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" checked={naming} onChange={(e) => setNaming(e.target.checked)} />
            The client agreed to be named (client or book name shown)
          </label>
          <button className="admin-button">Record consent</button>
        </form>
      )}
    </div>
  );
}
