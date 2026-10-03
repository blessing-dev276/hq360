import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertCircle, AlertTriangle, CircleCheck, Mail, Send } from "lucide-react";
import { outreachWarnings, renderOutreach, type OutreachTemplate } from "@/lib/outreach";

type Recipient = {
  prospect_id: string;
  name: string;
  email: string;
  book: string | null;
  status: string;
};
type Sent = {
  id: string;
  created_at: string;
  to_email: string;
  to_name: string | null;
  subject: string;
  template: OutreachTemplate;
  status: "sent" | "failed";
  error: string | null;
};
type Config = {
  configured: boolean;
  from: string;
  senderName: string;
  senderTitle: string;
  address: string;
  siteOrigin: string;
  dailyLimit: number;
  sentToday: number;
};

const STARTER = `Hi {first_name},

I came across your book while researching new releases in your genre and wanted to reach out personally.

[One or two specific, genuine observations about their book or author presence.]

At HQ360 we help authors get their books in front of the right readers. If it would be useful, I'd be glad to share a few ideas specific to your book, no obligation.

Would you be open to a short reply?`;

/** Admin-only, one-to-one author outreach from the dedicated outreach sender. */
export function OutreachAdmin() {
  const [config, setConfig] = useState<Config | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [history, setHistory] = useState<Sent[]>([]);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [repeatPrompt, setRepeatPrompt] = useState("");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const [prospectId, setProspectId] = useState<string | null>(null);
  const [toEmail, setToEmail] = useState("");
  const [toName, setToName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState(STARTER);
  const [template, setTemplate] = useState<OutreachTemplate>("letter");

  const load = useCallback(async () => {
    setLoadError("");
    try {
      const response = await fetch("/api/admin/outreach");
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not load outreach.");
      setConfig(data.config);
      setRecipients(data.recipients ?? []);
      setHistory(data.history ?? []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load outreach.");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return recipients.slice(0, 8);
    return recipients
      .filter((r) => `${r.name} ${r.email} ${r.book ?? ""}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [recipients, search]);

  const warnings = useMemo(() => outreachWarnings(subject, body), [subject, body]);
  const preview = useMemo(
    () =>
      renderOutreach({
        template,
        toName: toName || "Author",
        subject: subject || "(no subject)",
        body,
        senderName: config?.senderName || "The HQ360 team",
        senderTitle: config?.senderTitle || "",
        siteOrigin: config?.siteOrigin || "https://www.hq360.space",
        unsubscribeUrl: "#unsubscribe",
        address: config?.address || undefined,
      }),
    [template, toName, subject, body, config],
  );

  function pick(r: Recipient) {
    setProspectId(r.prospect_id);
    setToEmail(r.email);
    setToName(r.name);
    setSearch("");
    if (!subject && r.book) setSubject(`A quick thought on ${r.book}`);
  }

  async function send(confirmRepeat = false) {
    setSending(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/outreach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          to_email: toEmail,
          to_name: toName,
          subject,
          body,
          template,
          prospect_id: prospectId,
          confirm_repeat: confirmRepeat,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 409 && data.code === "repeat") {
        setRepeatPrompt(data.error);
        return;
      }
      if (!response.ok) throw new Error(data.error || "Could not send this email.");
      setRepeatPrompt("");
      setNotice(`Sent to ${toEmail}.`);
      setProspectId(null);
      setToEmail("");
      setToName("");
      setSubject("");
      setBody(STARTER);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send this email.");
    } finally {
      setSending(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (body.includes("[") && body.includes("]")) {
      setError("Replace the [bracketed] placeholder text before sending.");
      return;
    }
    void send(false);
  }

  const remaining = config ? Math.max(0, config.dailyLimit - config.sentToday) : 0;

  return (
    <div className="space-y-6">
      {loadError && (
        <div className="admin-alert" role="alert">
          <AlertCircle size={18} /> {loadError}
        </div>
      )}
      {config && !config.configured && (
        <div className="admin-setup">
          <AlertTriangle size={20} />
          <div>
            <strong>Outreach sender not set up</strong>
            <p>
              Add a verified sending domain such as mail.hq360.space in Resend, then set
              OUTREACH_EMAIL_FROM (for example “Blessing at HQ360 &lt;hello@mail.hq360.space&gt;”)
              in the host environment. Outreach never uses the invoice sender.
            </p>
          </div>
        </div>
      )}

      <div className="admin-stats admin-stats-4">
        <div className="admin-stat">
          <div>
            Sent today <Send size={18} />
          </div>
          <strong>{config ? `${config.sentToday} / ${config.dailyLimit}` : "—"}</strong>
          <small>{config ? `${remaining} left today` : "Loading…"}</small>
        </div>
        <div className="admin-stat">
          <div>
            Authors with email <Mail size={18} />
          </div>
          <strong>{recipients.length}</strong>
          <small>From your Scout prospects</small>
        </div>
        <div className="admin-stat">
          <div>Sent (recent)</div>
          <strong>{history.filter((h) => h.status === "sent").length}</strong>
          <small>Last 100 messages</small>
        </div>
        <div className="admin-stat">
          <div>Sending from</div>
          <strong style={{ fontSize: 15, overflowWrap: "anywhere" }}>
            {config?.configured ? config.from.replace(/^.*</, "").replace(/>$/, "") : "Not set"}
          </strong>
          <small>Separate from invoices</small>
        </div>
      </div>

      <div className="admin-outreach-grid">
        <form className="admin-content-panel admin-invoice-form" onSubmit={submit}>
          <div className="admin-panel-heading" style={{ padding: 0 }}>
            <div>
              <h2>Write to an author</h2>
              <p>One author at a time. Personal emails reach the inbox; mass emails don't.</p>
            </div>
          </div>

          <label>
            Find an author from Scout
            <input
              placeholder="Search name, email or book…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          {search && (
            <ul className="admin-outreach-picks">
              {matches.length ? (
                matches.map((r) => (
                  <li key={r.prospect_id}>
                    <button type="button" onClick={() => pick(r)}>
                      <strong>{r.name}</strong>
                      <small>
                        {r.email}
                        {r.book ? ` · ${r.book}` : ""}
                      </small>
                    </button>
                  </li>
                ))
              ) : (
                <li className="admin-form-note">No Scout prospects match. Type the email below.</li>
              )}
            </ul>
          )}

          <div className="admin-form-grid">
            <label>
              Author name
              <input
                value={toName}
                maxLength={160}
                placeholder="Racheal Eniola"
                onChange={(e) => setToName(e.target.value)}
              />
            </label>
            <label>
              Email
              <input
                type="email"
                required
                value={toEmail}
                placeholder="author@gmail.com"
                onChange={(e) => {
                  setToEmail(e.target.value);
                  setProspectId(null);
                }}
              />
            </label>
          </div>
          <label>
            <span style={{ display: "flex", justifyContent: "space-between" }}>
              Subject <small style={{ fontWeight: 400 }}>{subject.length}/70</small>
            </span>
            <input
              required
              minLength={3}
              maxLength={200}
              value={subject}
              placeholder="A quick thought on your book"
              onChange={(e) => setSubject(e.target.value)}
            />
          </label>
          <label>
            <span style={{ display: "flex", justifyContent: "space-between" }}>
              Message
              <small style={{ fontWeight: 400 }}>
                {body.trim().split(/\s+/).filter(Boolean).length} words · use {"{first_name}"}
              </small>
            </span>
            <textarea
              required
              rows={12}
              maxLength={5000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </label>

          <div>
            <span className="admin-form-label">Design</span>
            <div className="admin-segmented">
              {(
                [
                  ["letter", "Letter + signature"],
                  ["card", "Branded card"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={template === value ? "active" : ""}
                  aria-pressed={template === value}
                  onClick={() => setTemplate(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="admin-form-note" style={{ marginTop: 8 }}>
              {template === "letter"
                ? "Best inbox placement for cold outreach: reads like a personal email."
                : "Matches your invoice design. More likely to land in Promotions for cold email."}
            </p>
          </div>

          {warnings.length > 0 && (
            <div className="admin-notice" role="status" style={{ alignItems: "flex-start" }}>
              <AlertTriangle size={18} />
              <div>
                <strong>Deliverability check</strong>
                <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                  {warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
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
          {repeatPrompt && (
            <div className="admin-alert" role="alert" style={{ flexWrap: "wrap" }}>
              <AlertTriangle size={18} /> {repeatPrompt}
              <div className="admin-button-row" style={{ width: "100%" }}>
                <button
                  type="button"
                  className="admin-button"
                  disabled={sending}
                  onClick={() => void send(true)}
                >
                  Send anyway
                </button>
                <button type="button" className="admin-button" onClick={() => setRepeatPrompt("")}>
                  Cancel
                </button>
              </div>
            </div>
          )}
          <div className="admin-button-row">
            <button
              className="admin-button admin-button-primary"
              disabled={sending || !config?.configured || remaining === 0}
            >
              <Send size={15} /> {sending ? "Sending…" : "Send email"}
            </button>
          </div>
        </form>

        <section className="admin-content-panel admin-outreach-preview">
          <div className="admin-panel-heading" style={{ padding: "0 0 14px" }}>
            <div>
              <h2>Preview</h2>
              <p>
                <strong>Subject:</strong> {preview.subject}
              </p>
            </div>
          </div>
          <iframe
            title="Email preview"
            sandbox=""
            srcDoc={preview.html}
            className="admin-outreach-frame"
          />
        </section>
      </div>

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <h2>Sent</h2>
            <p>Every outreach email, newest first.</p>
          </div>
        </div>
        {history.length === 0 ? (
          <div className="admin-empty">
            <h3>No outreach yet</h3>
            <p>Emails you send will be listed here.</p>
          </div>
        ) : (
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>To</th>
                  <th>Subject</th>
                  <th>Design</th>
                  <th>Status</th>
                  <th>Sent</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td>
                      <span className="admin-invoice-name">{h.to_name || h.to_email}</span>
                      {h.to_name && <small>{h.to_email}</small>}
                    </td>
                    <td>{h.subject}</td>
                    <td>{h.template === "letter" ? "Letter" : "Card"}</td>
                    <td>
                      <span className={`admin-status ${h.status === "sent" ? "paid" : "overdue"}`}>
                        {h.status}
                      </span>
                      {h.error && <small>{h.error.slice(0, 80)}</small>}
                    </td>
                    <td>{new Date(h.created_at).toLocaleString("en-GB")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
