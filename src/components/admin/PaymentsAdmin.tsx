import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  Plus,
  Trash2,
  Search,
  Download,
  FileText,
  ArrowUpRight,
  Copy,
  Mail,
  RefreshCw,
  CreditCard,
  CircleCheck,
  Clock3,
  AlertCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { invoiceStatus, money, type Invoice, type PaymentSetup } from "@/lib/payments/types";

async function call(url: string, body?: unknown) {
  const response = await fetch(
    url,
    body
      ? {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }
      : {},
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}
export function PaymentsAdmin() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [setup, setSetup] = useState<PaymentSetup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [busy, setBusy] = useState("");
  const createId = useRef("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/invoices");
      const data = await response.json();
      setSetup(data.setup ?? null);
      if (!response.ok) throw new Error(data.error);
      setInvoices(data.invoices);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load invoices.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  function merge(invoice: Invoice) {
    setInvoices((list) =>
      [invoice, ...list.filter((i) => i.id !== invoice.id)].sort((a, b) =>
        b.created_at.localeCompare(a.created_at),
      ),
    );
    setSelected(invoice);
  }
  async function action(invoice: Invoice, action: "issue" | "send" | "verify") {
    setBusy(action);
    setError("");
    setNotice("");
    try {
      const data = await call(`/api/admin/invoices/${invoice.id}`, { action });
      merge(data.invoice);
      setNotice(
        action === "send"
          ? `Invoice emailed to ${invoice.buyer_email}.`
          : action === "issue"
            ? "Invoice issued. Your buyer’s payment link is ready."
            : data.invoice.status === "paid"
              ? "Payment verified by NOWPayments."
              : "Payment is not confirmed yet. You can check again shortly.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update invoice.");
    } finally {
      setBusy("");
    }
  }
  async function removeDraft(invoice: Invoice) {
    if (!window.confirm(`Delete draft ${invoice.number}? This cannot be undone.`)) return;
    setBusy("delete");
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/invoices/${invoice.id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not delete draft.");
      setInvoices((list) => list.filter((item) => item.id !== invoice.id));
      setSelected(null);
      setNotice(`Draft ${invoice.number} deleted.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete draft.");
    } finally {
      setBusy("");
    }
  }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy("create");
    setError("");
    try {
      const amount = Number(form.get("amount"));
      const data = await call("/api/admin/invoices", {
        id: createId.current,
        buyer_name: form.get("buyer_name"),
        buyer_email: form.get("buyer_email"),
        buyer_phone: form.get("buyer_phone"),
        description: form.get("description"),
        amount_minor: Math.round(amount * 100),
        due_date: form.get("due_date"),
      });
      merge(data.invoice);
      setCreating(false);
      setNotice("Draft saved. Review the details, then issue your invoice.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create invoice.");
    } finally {
      setBusy("");
    }
  }
  const visible = invoices.filter(
    (i) =>
      (filter === "all" || invoiceStatus(i) === filter) &&
      `${i.number} ${i.buyer_name} ${i.buyer_email} ${i.provider_invoice_id || ""}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const sum = (status: string) =>
    invoices
      .filter((i) => i.status === status && i.currency === "USD")
      .reduce((s, i) => s + i.amount_minor, 0);
  function exportCsv() {
    const escape = (value: string) =>
      `"${(/^[=+@\-\t\r]/.test(value) ? "'" + value : value).replaceAll('"', '""')}"`;
    const rows = [
      ["Invoice", "Buyer", "Email", "Amount", "Currency", "Due date", "Status", "Provider invoice"],
      ...visible.map((i) => [
        i.number,
        i.buyer_name,
        i.buyer_email,
        (i.amount_minor / 100).toFixed(2),
        i.currency,
        i.due_date,
        invoiceStatus(i),
        i.provider_invoice_id || "",
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob([rows.map((row) => row.map(escape).join(",")).join("\r\n")], {
        type: "text/csv;charset=utf-8;",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "hq360-invoices.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  const feedback = (
    <>
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
    </>
  );
  return (
    <>
      <div className="admin-payment-toolbar">
        <div className="admin-provider">
          <span className="admin-provider-mark">N</span>
          <div>
            NOWPayments <small>{setup?.configured ? "Configured" : "Setup required"}</small>
          </div>
          <span className={`admin-status ${setup?.environment === "live" ? "paid" : "draft"}`}>
            {setup?.environment === "live" ? "Live mode" : "Test mode"}
          </span>
        </div>
        <div className="admin-button-row">
          <button className="admin-button" disabled={!visible.length} onClick={exportCsv}>
            <Download size={16} />
            Export
          </button>
          <button
            className="admin-button admin-button-primary"
            onClick={() => {
              createId.current = crypto.randomUUID();
              setError("");
              setNotice("");
              setCreating(true);
            }}
          >
            <Plus size={17} />
            Create invoice
          </button>
        </div>
      </div>
      {!creating && !selected && feedback}
      {setup && !setup.configured && (
        <div className="admin-setup">
          <CreditCard size={22} />
          <div>
            <strong>Your payment workspace is ready.</strong>
            <p>
              You can save drafts now. Connect your NOWPayments merchant credentials to issue
              invoices and accept payments.
            </p>
          </div>
          <a href="https://account.nowpayments.io/" target="_blank" rel="noreferrer">
            NOWPayments setup <ArrowUpRight size={15} />
          </a>
        </div>
      )}
      <div className="admin-stats">
        {[
          {
            label: "Total received",
            amount: sum("paid"),
            icon: CircleCheck,
            note: "Verified payments",
          },
          {
            label: "Outstanding",
            amount: sum("pending"),
            icon: Clock3,
            note: "Issued and awaiting payment",
          },
          {
            label: "Draft invoices",
            amount: sum("draft"),
            icon: FileText,
            note: "Ready for your review",
          },
        ].map(({ label, amount, icon: Icon, note }) => (
          <div className="admin-stat" key={label}>
            <div>
              {label}
              <Icon size={18} />
            </div>
            <strong>{loading ? "—" : money(amount)}</strong>
            <small>{note} · USD only · latest 1,000 invoices</small>
          </div>
        ))}
      </div>
      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <h2>
              Invoices <span className="admin-count">{invoices.length}</span>
            </h2>
            <p>Every invoice. Every payment. One place.</p>
          </div>
          <button
            className="admin-icon-button"
            aria-label="Refresh invoices"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
        <div className="admin-table-toolbar">
          <div className="admin-filters" aria-label="Filter invoices">
            {["all", "draft", "pending", "paid", "overdue", "refunded"].map((value) => (
              <button
                key={value}
                aria-pressed={filter === value}
                className={filter === value ? "active" : ""}
                onClick={() => setFilter(value)}
              >
                {value === "all" ? "All invoices" : value}
              </button>
            ))}
          </div>
          <label className="admin-search">
            <Search size={16} />
            <input
              aria-label="Search invoices"
              placeholder="Search invoices…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
        {loading ? (
          <div className="admin-empty" role="status">
            Loading invoices…
          </div>
        ) : visible.length ? (
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Invoice / Buyer</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Due date</th>
                  <th>Delivery</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <button
                        className="admin-invoice-name"
                        onClick={() => {
                          setSelected(i);
                          setError("");
                          setNotice("");
                        }}
                      >
                        {i.number}
                      </button>
                      <small>{i.buyer_name}</small>
                    </td>
                    <td className="admin-numeric">{money(i.amount_minor, i.currency)}</td>
                    <td>
                      <span className={`admin-status ${invoiceStatus(i)}`}>{invoiceStatus(i)}</span>
                    </td>
                    <td>
                      {new Date(i.due_date + "T12:00:00").toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td>
                      <span className="admin-delivery">{i.sent_at ? "Emailed" : "Not sent"}</span>
                    </td>
                    <td>
                      <button
                        className="admin-icon-button"
                        aria-label={`View ${i.number}`}
                        onClick={() => setSelected(i)}
                      >
                        <ArrowUpRight size={17} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="admin-empty">
            <span className="admin-empty-icon">
              <FileText size={26} />
            </span>
            <h3>
              {search || filter !== "all"
                ? "No matching invoices"
                : "Good business starts with a great invoice"}
            </h3>
            <p>
              {search || filter !== "all"
                ? "Try another search or filter."
                : "Create your first invoice, share it with your buyer, and track payment here."}
            </p>
          </div>
        )}
        <div className="admin-table-footer">
          Showing {visible.length} of {invoices.length} invoices
          <span>Currency shown per invoice</span>
        </div>
      </section>
      <Dialog
        open={creating}
        onOpenChange={(value) => {
          if (!busy) setCreating(value);
        }}
      >
        <DialogContent className="admin-dialog">
          <DialogHeader>
            <DialogTitle>Create an invoice</DialogTitle>
            <DialogDescription>A polished invoice. A simple way to get paid.</DialogDescription>
          </DialogHeader>
          {feedback}
          <form onSubmit={create} className="admin-invoice-form">
            <div className="admin-form-grid">
              <label>
                Buyer name
                <input
                  name="buyer_name"
                  required
                  minLength={2}
                  maxLength={150}
                  placeholder="Full name or business"
                />
              </label>
              <label>
                Email address
                <input
                  name="buyer_email"
                  required
                  type="email"
                  maxLength={254}
                  placeholder="buyer@example.com"
                />
              </label>
              <label>
                Phone number
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
                  required
                  type="date"
                  defaultValue={new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)}
                />
              </label>
            </div>
            <label>
              What is this invoice for?
              <textarea
                name="description"
                required
                minLength={3}
                maxLength={1000}
                rows={3}
                placeholder="Service or product, scope and any agreed details"
              />
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
            <p className="admin-form-note">
              Save a draft first. You’ll review it before issuing or emailing it.
            </p>
            <button className="admin-button admin-button-primary" disabled={!!busy}>
              {busy === "create" ? "Saving…" : "Save draft"}
              <ArrowUpRight size={16} />
            </button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!selected && !creating}
        onOpenChange={(value) => {
          if (!value && !busy) setSelected(null);
        }}
      >
        <DialogContent className="admin-dialog">
          <DialogHeader>
            <DialogTitle>Invoice {selected?.number}</DialogTitle>
            <DialogDescription>Review details and manage your buyer’s payment.</DialogDescription>
          </DialogHeader>
          {feedback}
          {selected && (
            <>
              <div className="admin-invoice-summary">
                <span className={`admin-status ${invoiceStatus(selected)}`}>
                  {invoiceStatus(selected)}
                </span>
                <strong>{money(selected.amount_minor, selected.currency)}</strong>
                <p>{selected.description}</p>
              </div>
              <dl className="admin-invoice-details">
                <div>
                  <dt>Bill to</dt>
                  <dd>
                    {selected.buyer_name}
                    <small>{selected.buyer_email}</small>
                  </dd>
                </div>
                <div>
                  <dt>Due date</dt>
                  <dd>{selected.due_date}</dd>
                </div>
                <div>
                  <dt>NOWPayments reference</dt>
                  <dd>{selected.provider_invoice_id || "Not issued yet"}</dd>
                </div>
                <div>
                  <dt>Provider status</dt>
                  <dd>{selected.provider_status?.replaceAll("_", " ") || "No payment yet"}</dd>
                </div>
                <div>
                  <dt>Environment</dt>
                  <dd>{selected.environment === "demo" ? "Test — no real payments" : "Live"}</dd>
                </div>
              </dl>
              <div className="admin-button-row flex-wrap">
                {selected.status === "draft" && !selected.provider_invoice_id && (
                  <button
                    className="admin-button text-destructive"
                    disabled={!!busy}
                    onClick={() => void removeDraft(selected)}
                  >
                    <Trash2 size={15} />
                    {busy === "delete" ? "Deleting…" : "Delete draft"}
                  </button>
                )}
                {!selected.provider_invoice_id ? (
                  <button
                    className="admin-button admin-button-primary"
                    disabled={!!busy || !setup?.configured}
                    onClick={() => void action(selected, "issue")}
                  >
                    {busy === "issue" ? "Issuing…" : "Issue with NOWPayments"}
                    <ArrowUpRight size={16} />
                  </button>
                ) : (
                  <>
                    <button
                      className="admin-button"
                      disabled={!!busy}
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(
                            `${window.location.origin}/pay/${selected.payment_token}`,
                          );
                          setNotice("Payment link copied.");
                        } catch {
                          setError("Could not copy. Open the buyer invoice to copy its address.");
                        }
                      }}
                    >
                      <Copy size={15} />
                      Copy link
                    </button>
                    <a
                      className="admin-button"
                      href={`/pay/${selected.payment_token}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View invoice <ArrowUpRight size={15} />
                    </a>
                    {!["paid", "refunded"].includes(selected.status) && (
                      <>
                        <button
                          className="admin-button admin-button-primary"
                          disabled={!!busy || !setup?.emailConfigured}
                          onClick={() => void action(selected, "send")}
                        >
                          <Mail size={15} />
                          {busy === "send"
                            ? "Sending…"
                            : selected.sent_at
                              ? "Resend invoice"
                              : "Send invoice"}
                        </button>
                        <button
                          className="admin-button"
                          disabled={!!busy}
                          onClick={() => void action(selected, "verify")}
                        >
                          <RefreshCw size={15} />
                          {busy === "verify" ? "Checking…" : "Check payment"}
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
              {!setup?.emailConfigured && (
                <p className="admin-form-note">
                  Email delivery is not connected. Configure transactional email or share the
                  payment link directly.
                </p>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
