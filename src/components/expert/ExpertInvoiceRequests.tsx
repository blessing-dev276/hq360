import { GlassLoading } from "@/components/ui/glass-loading";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AlertCircle, Check, CircleCheck, Copy, Send } from "lucide-react";
import { money } from "@/lib/payments/types";

type InvoiceRequest = {
  id: string;
  buyer_name: string;
  buyer_email: string;
  buyer_phone: string;
  description: string;
  amount_minor: number;
  due_date: string;
  payment_type: "card" | "crypto";
  status: "pending" | "fulfilled" | "declined";
  admin_note: string | null;
  created_at: string;
  invoice: { number: string; status: string; pay_url: string | null } | null;
};

function CopyPayLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="admin-button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
        } catch {
          window.prompt("Copy this invoice link:", url);
          return;
        }
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {copied ? "Copied" : "Copy invoice link"}
    </button>
  );
}

function StatusBadge({ status }: { status: InvoiceRequest["status"] }) {
  const tone = status === "fulfilled" ? "paid" : status === "declined" ? "overdue" : "pending";
  const label =
    status === "fulfilled"
      ? "Invoice created"
      : status === "declined"
        ? "Declined"
        : "Pending review";
  return <span className={`admin-status ${tone}`}>{label}</span>;
}

export function ExpertInvoiceRequests() {
  const [requests, setRequests] = useState<InvoiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/expert/invoice-requests");
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not load your invoice requests.");
      setRequests(data.requests ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your invoice requests.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const form = new FormData(event.currentTarget);
    try {
      const amount = Number(form.get("amount"));
      const response = await fetch("/api/expert/invoice-requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          buyer_name: form.get("buyer_name"),
          buyer_email: form.get("buyer_email"),
          buyer_phone: form.get("buyer_phone"),
          description: form.get("description"),
          amount_minor: Math.round(amount * 100),
          due_date: form.get("due_date"),
          payment_type: form.get("payment_type"),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not submit this request.");
      setShowForm(false);
      setNotice("Request sent. Admin will review it and create the invoice.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit this request.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-content-panel">
      <div className="admin-panel-heading" style={{ padding: "0 0 1.5rem" }}>
        <div>
          <h2>Request an invoice</h2>
          <p>Have a client ready to pay? Send the details and admin will create the invoice.</p>
        </div>
        {!showForm && (
          <button className="admin-button admin-button-primary" onClick={() => setShowForm(true)}>
            New request
          </button>
        )}
      </div>
      {error && (
        <div className="admin-alert" role="alert">
          <AlertCircle size={18} />
          {error}
        </div>
      )}
      {notice && (
        <div className="admin-notice" role="status">
          <CircleCheck size={18} />
          {notice}
        </div>
      )}

      {showForm && (
        <form className="admin-invoice-form" onSubmit={submit} style={{ marginBottom: "1.5rem" }}>
          <div className="admin-form-grid">
            <label>
              Client name
              <input name="buyer_name" required minLength={2} maxLength={150} />
            </label>
            <label>
              Client email
              <input name="buyer_email" type="email" required maxLength={254} />
            </label>
            <label>
              Client phone
              <input
                name="buyer_phone"
                type="tel"
                required
                minLength={7}
                maxLength={25}
                placeholder="+234…"
              />
            </label>
            <label>
              Due date
              <input
                name="due_date"
                type="date"
                required
                defaultValue={new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)}
              />
            </label>
          </div>
          <label>
            What is this invoice for?
            <textarea name="description" required minLength={3} maxLength={1000} rows={3} />
          </label>
          <label>
            Amount (USD)
            <input
              name="amount"
              type="number"
              required
              min="0.01"
              max="100000000"
              step="0.01"
              placeholder="0.00"
            />
          </label>
          <div>
            <strong style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
              How should the client pay?
            </strong>
            <div
              className="admin-segmented"
              style={{ marginTop: "0.5rem", display: "inline-flex" }}
            >
              <label style={{ padding: "8px 13px", display: "flex", alignItems: "center", gap: 6 }}>
                <input type="radio" name="payment_type" value="card" defaultChecked /> Card
              </label>
              <label style={{ padding: "8px 13px", display: "flex", alignItems: "center", gap: 6 }}>
                <input type="radio" name="payment_type" value="crypto" /> Crypto
              </label>
            </div>
          </div>
          <div className="admin-button-row">
            <button className="admin-button admin-button-primary" disabled={busy}>
              <Send size={14} />
              {busy ? "Sending…" : "Send request"}
            </button>
            <button type="button" className="admin-button" onClick={() => setShowForm(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <GlassLoading label="Loading your invoice requests…" variant="table" rows={3} />
      ) : requests.length === 0 ? (
        !showForm && (
          <div className="admin-empty">
            <h3>No invoice requests yet</h3>
            <p>Request an invoice when a client of yours is ready to pay.</p>
          </div>
        )
      ) : (
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Invoice link</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td>
                    <span className="admin-invoice-name">{r.buyer_name}</span>
                    <small>{r.buyer_email}</small>
                    <small>{r.description.slice(0, 80)}</small>
                  </td>
                  <td className="admin-numeric">{money(r.amount_minor)}</td>
                  <td>
                    <StatusBadge status={r.status} />
                    {r.status === "declined" && r.admin_note && (
                      <div style={{ marginTop: 4 }}>
                        <small>Reason: {r.admin_note}</small>
                      </div>
                    )}
                  </td>
                  <td>
                    {r.invoice?.pay_url ? (
                      <>
                        <CopyPayLink url={r.invoice.pay_url} />
                        <small>
                          {r.invoice.number} · {r.invoice.status}
                        </small>
                      </>
                    ) : r.invoice ? (
                      <small>{r.invoice.number} · being prepared</small>
                    ) : (
                      <small>—</small>
                    )}
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
