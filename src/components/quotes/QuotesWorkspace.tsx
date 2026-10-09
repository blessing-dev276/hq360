import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Copy,
  Download,
  Eye,
  FileText,
  Link2,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import { GlassLoading } from "@/components/ui/glass-loading";
import { QuoteDocument } from "./QuoteDocument";
import {
  MAX_PACKAGES,
  QUOTE_CURRENCIES,
  QUOTE_TEMPLATES,
  blankPackage,
  formatPrice,
  newQuote,
  type Quote,
  type QuoteCurrency,
  type QuotePackage,
} from "@/lib/quotes";
import "./quotes-workspace.css";

type Saved = Quote & { id: string; token: string; views: number; updated_at: string };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Something went wrong. Please try again.");
  return data as T;
}

function ago(value: string) {
  const s = (Date.now() - new Date(value).getTime()) / 1000;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  if (s < 86400 * 7) return `${Math.round(s / 86400)} d ago`;
  return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function priceRange(q: Quote) {
  const prices = q.packages.map((p) => p.price).filter((p) => p > 0);
  if (!prices.length) return "No prices yet";
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);
  return lo === hi
    ? formatPrice(lo, q.currency)
    : `${formatPrice(lo, q.currency)} – ${formatPrice(hi, q.currency)}`;
}

const linkFor = (token: string) => `${window.location.origin}/quote/${token}`;

/** Quotes tool for admins and experts with the Sales ("invoices") permission. */
export function QuotesWorkspace() {
  const [items, setItems] = useState<Saved[] | null>(null);
  const [me, setMe] = useState({ name: "HQ360", admin: false });
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Quote | null>(null);
  // Opening a quote via "Create invoice" goes straight to the invoice form.
  const [invoiceOnOpen, setInvoiceOnOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api<{ items: Saved[]; me: { name: string; admin: boolean } }>(
        "/api/admin/quotes",
      );
      setItems(data.items);
      setMe(data.me);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  if (editing)
    return (
      <QuoteEditor
        initial={editing}
        isAdmin={me.admin}
        startInvoice={invoiceOnOpen}
        onBack={() => {
          setEditing(null);
          setInvoiceOnOpen(false);
          void load();
        }}
      />
    );

  return (
    <div className="qw">
      <div className="qw-listhead">
        <div>
          <h2>Quotes</h2>
          <p>
            When a buyer asks “how much?”, build a branded price page in a minute. Share a link, or
            send a PDF or image.
          </p>
        </div>
        <button
          className="admin-button admin-button-primary"
          onClick={() => setEditing(newQuote(me.name))}
        >
          <Plus size={16} /> New quote
        </button>
      </div>
      {error && (
        <div className="admin-alert" role="alert">
          <AlertCircle size={18} /> {error}
        </div>
      )}
      {items === null ? (
        !error && <GlassLoading label="Loading quotes…" variant="cards" rows={3} />
      ) : items.length === 0 ? (
        <div className="qw-empty">
          <FileText size={26} aria-hidden="true" />
          <h3>No quotes yet</h3>
          <p>Create your first quote: add the client, the work and one or more packages.</p>
          <button
            className="admin-button admin-button-primary"
            onClick={() => setEditing(newQuote(me.name))}
          >
            <Plus size={16} /> New quote
          </button>
        </div>
      ) : (
        <ul className="qw-grid">
          {items.map((q) => (
            <li key={q.id}>
              <QuoteCard
                quote={q}
                showOwner={me.admin}
                onOpen={() => {
                  setInvoiceOnOpen(false);
                  setEditing(q);
                }}
                onInvoice={() => {
                  setInvoiceOnOpen(true);
                  setEditing(q);
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function QuoteCard({
  quote,
  onOpen,
  onInvoice,
  showOwner,
}: {
  quote: Saved;
  onOpen: () => void;
  onInvoice: () => void;
  showOwner: boolean;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="qw-card">
      <button type="button" className="qw-card-main" onClick={onOpen}>
        <span className="qw-card-client">{quote.client_name || "No client name"}</span>
        <strong>{quote.project_title || "Untitled quote"}</strong>
        <span className="qw-card-price">{priceRange(quote)}</span>
        <span className="qw-card-meta">
          {quote.packages.length} {quote.packages.length === 1 ? "package" : "packages"} ·{" "}
          {quote.views} {quote.views === 1 ? "view" : "views"} · {ago(quote.updated_at)}
          {showOwner && quote.prepared_by ? ` · ${quote.prepared_by}` : ""}
        </span>
      </button>
      <button
        type="button"
        className="qw-card-link"
        onClick={() =>
          void navigator.clipboard.writeText(linkFor(quote.token)).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          })
        }
      >
        {copied ? <Check size={14} /> : <Link2 size={14} />} {copied ? "Copied" : "Copy link"}
      </button>
      {["USD", "EUR"].includes(quote.currency) && (
        <button type="button" className="qw-card-link qw-card-invoice" onClick={onInvoice}>
          <FileText size={14} /> Create invoice
        </button>
      )}
    </div>
  );
}

function QuoteEditor({
  initial,
  onBack,
  isAdmin,
  startInvoice = false,
}: {
  initial: Quote;
  onBack: () => void;
  isAdmin: boolean;
  startInvoice?: boolean;
}) {
  const [quote, setQuote] = useState<Quote>(initial);
  const [saved, setSaved] = useState<Quote>(initial);
  const [busy, setBusy] = useState<"" | "save" | "pdf" | "png" | "link" | "delete" | "convert">("");
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [converting, setConverting] = useState(startInvoice);
  const [conversionMethod, setConversionMethod] = useState<
    "bank_transfer" | "flutterwave" | "nowpayments"
  >(initial.currency === "EUR" ? "bank_transfer" : "flutterwave");
  const [conversionPackage, setConversionPackage] = useState(() => {
    const premium = initial.packages.findIndex((pkg) => pkg.name.toLowerCase() === "premium");
    return premium >= 0
      ? premium
      : Math.max(
          0,
          initial.packages.findIndex((pkg) => pkg.recommended),
        );
  });
  const [conversionResult, setConversionResult] = useState("");
  const [mobileView, setMobileView] = useState<"edit" | "preview">("edit");
  const exportRef = useRef<HTMLDivElement>(null);
  const dirty = useMemo(() => JSON.stringify(quote) !== JSON.stringify(saved), [quote, saved]);

  const set = <K extends keyof Quote>(key: K, value: Quote[K]) =>
    setQuote((q) => ({ ...q, [key]: value }));
  const setPkg = (i: number, patch: Partial<QuotePackage>) =>
    setQuote((q) => ({
      ...q,
      packages: q.packages.map((p, j) =>
        j === i
          ? { ...p, ...patch }
          : patch.recommended
            ? { ...p, recommended: false } // only one recommended package
            : p,
      ),
    }));

  function notify(message: string) {
    setFlash(message);
    setTimeout(() => setFlash(""), 2200);
  }

  /** Saves if needed and returns the stored quote (with its link token). */
  async function save(): Promise<Quote | null> {
    setError("");
    if (!dirty && quote.id) return quote;
    setBusy((b) => b || "save");
    try {
      const body = JSON.stringify({
        prepared_by: quote.prepared_by,
        client_name: quote.client_name,
        project_title: quote.project_title,
        intro: quote.intro,
        currency: quote.currency,
        packages: quote.packages.map((p) => ({
          ...p,
          price: Number(p.price) || 0,
          original_price: Number(p.original_price) || null,
        })),
        notes: quote.notes,
        valid_until: quote.valid_until || null,
      });
      const { item } = await api<{ item: Quote }>(
        quote.id ? `/api/admin/quotes/${quote.id}` : "/api/admin/quotes",
        { method: quote.id ? "PUT" : "POST", body },
      );
      setQuote(item);
      setSaved(item);
      return item;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy("");
    }
  }

  async function copyLink() {
    setBusy("link");
    const stored = await save();
    if (stored?.token) {
      await navigator.clipboard.writeText(linkFor(stored.token));
      notify("Link copied. Send it to your buyer.");
    }
    setBusy("");
  }

  async function exportAs(kind: "pdf" | "png") {
    setBusy(kind);
    const stored = await save();
    try {
      if (stored && exportRef.current) {
        const m = await import("@/lib/quote-export");
        const title = stored.project_title || stored.client_name || "quote";
        await (kind === "pdf"
          ? m.downloadQuotePdf(exportRef.current, title)
          : m.downloadQuoteImage(exportRef.current, title));
      }
    } catch {
      setError("Export failed. Please try again.");
    } finally {
      setBusy("");
    }
  }

  async function remove() {
    if (!quote.id) return onBack();
    if (!window.confirm("Delete this quote? Its link will stop working.")) return;
    setBusy("delete");
    try {
      await api(`/api/admin/quotes/${quote.id}`, { method: "DELETE" });
      onBack();
    } catch (e) {
      setError((e as Error).message);
      setBusy("");
    }
  }

  async function convert(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    // Save first, so the invoice always matches what's on screen.
    const stored = dirty || !quote.id ? await save() : quote;
    if (!stored?.id) return;
    setBusy("convert");
    setError("");
    try {
      const result = await api<{
        kind: "invoice" | "request";
        invoice?: { number: string };
        existing: boolean;
      }>(`/api/admin/quotes/${stored.id}/invoice`, {
        method: "POST",
        body: JSON.stringify({
          package_index: conversionPackage,
          buyer_email: fields.get("buyer_email"),
          buyer_phone: fields.get("buyer_phone"),
          due_date: fields.get("due_date"),
          bank_transfer_amount_minor: fields.get("bank_transfer_amount")
            ? Math.round(Number(fields.get("bank_transfer_amount")) * 100)
            : undefined,
          payment_method: fields.get("payment_method"),
          split: fields.get("payment_terms") === "split",
          ...(fields.get("balance_due_date")
            ? { balance_due_date: fields.get("balance_due_date") }
            : {}),
        }),
      });
      setConversionResult(
        result.kind === "invoice"
          ? `${result.existing ? "Existing" : "Draft"} invoice ${result.invoice?.number ?? ""} is in Payments. Review and issue it there before sending.`
          : result.existing
            ? "An invoice request for this quote already exists. Check Invoice requests for its status."
            : "Invoice request sent to admin. You can track it in Invoice requests.",
      );
      setConverting(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  function applyTemplate(key: string) {
    const template = QUOTE_TEMPLATES.find((t) => t.key === key);
    if (!template) return;
    const hasContent = quote.packages.some((p) => p.price > 0 || p.features.some(Boolean));
    if (hasContent && !window.confirm("Replace the current packages with this layout?")) return;
    set("packages", template.packages());
  }

  return (
    <div className="qw">
      <div className="qw-bar">
        <button
          type="button"
          className="scout-batch-back"
          onClick={() => {
            if (dirty && !window.confirm("Leave without saving your changes?")) return;
            onBack();
          }}
        >
          <ArrowLeft size={15} /> All quotes
        </button>
        <span className={`qw-state${dirty ? " is-dirty" : ""}`}>
          {busy === "save"
            ? "Saving…"
            : dirty
              ? "Unsaved changes"
              : quote.id
                ? "Saved"
                : "New quote"}
        </span>
        <div className="qw-actions">
          <button
            className="admin-button admin-button-primary"
            disabled={Boolean(busy) || !["USD", "EUR"].includes(quote.currency)}
            title={
              ["USD", "EUR"].includes(quote.currency)
                ? "Turn this quote into an invoice"
                : "Invoices support USD or EUR quotes"
            }
            onClick={async () => {
              setConversionResult("");
              // Unsaved changes are saved first, so the invoice matches the quote.
              if (dirty || !quote.id) {
                const stored = await save();
                if (!stored) return;
              }
              setConverting(true);
            }}
          >
            <FileText size={15} /> Create invoice
          </button>
          <button className="admin-button" disabled={Boolean(busy)} onClick={() => void save()}>
            {busy === "save" ? "Saving…" : "Save"}
          </button>
          <button className="admin-button" disabled={Boolean(busy)} onClick={() => void copyLink()}>
            <Link2 size={15} /> {busy === "link" ? "Saving…" : "Copy link"}
          </button>
          <button
            className="admin-button"
            disabled={Boolean(busy)}
            onClick={() => void exportAs("png")}
          >
            <Download size={15} /> {busy === "png" ? "Preparing…" : "Image"}
          </button>
          <button
            className="admin-button admin-button-primary"
            disabled={Boolean(busy)}
            onClick={() => void exportAs("pdf")}
          >
            <FileText size={15} /> {busy === "pdf" ? "Preparing…" : "Download PDF"}
          </button>
        </div>
      </div>
      {error && (
        <div className="admin-alert" role="alert">
          <AlertCircle size={18} /> {error}
        </div>
      )}
      {conversionResult && (
        <div className="admin-notice" role="status">
          <Check size={18} /> {conversionResult}
          {isAdmin && <a href="/admin#payments">Open Payments</a>}
        </div>
      )}
      {converting && (
        <form className="admin-invoice-form qw-convert" onSubmit={convert}>
          <h3>Invoice from this quote</h3>
          <p>
            Select the agreed package. The buyer will see its full price in {quote.currency}. If
            using bank transfer for a USD quote, enter the separate EUR amount you agreed with the
            buyer.
          </p>
          <div className="admin-form-grid">
            <label>
              Agreed package
              <select
                value={conversionPackage}
                onChange={(e) => setConversionPackage(Number(e.target.value))}
              >
                {quote.packages.map((pkg, i) => (
                  <option key={i} value={i}>
                    {pkg.name} — {formatPrice(pkg.price, quote.currency)}
                  </option>
                ))}
              </select>
            </label>
            {isAdmin && (
              <label>
                Payment terms
                <select name="payment_terms" defaultValue="split">
                  <option value="split">50% to start, 50% on delivery</option>
                  <option value="full">Full payment</option>
                </select>
              </label>
            )}
            <label>
              Payment method
              <select
                name="payment_method"
                value={quote.currency === "EUR" ? "bank_transfer" : conversionMethod}
                onChange={(e) => setConversionMethod(e.target.value as typeof conversionMethod)}
              >
                {quote.currency === "EUR" ? (
                  <option value="bank_transfer">EUR bank transfer (SEPA)</option>
                ) : (
                  <>
                    <option value="flutterwave">Card / hosted checkout (USD)</option>
                    <option value="bank_transfer">
                      Bank transfer (invoice USD, pay agreed EUR)
                    </option>
                    <option value="nowpayments">Crypto checkout</option>
                  </>
                )}
              </select>
            </label>
            {quote.currency === "USD" && conversionMethod === "bank_transfer" && (
              <label>
                Agreed transfer amount (EUR)
                <input
                  name="bank_transfer_amount"
                  type="number"
                  min="0.01"
                  max="100000000"
                  step="0.01"
                  required
                  placeholder="0.00"
                />
              </label>
            )}
            <label>
              Buyer email
              <input name="buyer_email" type="email" required maxLength={254} />
            </label>
            <label>
              Buyer phone (optional)
              <input name="buyer_phone" type="tel" minLength={7} maxLength={25} />
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
          <div className="admin-button-row">
            <button
              className="admin-button admin-button-primary"
              disabled={Boolean(busy) || !quote.packages[conversionPackage]?.price}
              type="submit"
            >
              {busy === "convert"
                ? "Creating…"
                : isAdmin
                  ? "Create draft invoice"
                  : "Request invoice"}
            </button>
            <button
              className="admin-button"
              type="button"
              disabled={Boolean(busy)}
              onClick={() => setConverting(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {flash && (
        <div className="admin-notice" role="status">
          <Check size={18} /> {flash}
        </div>
      )}

      <div className="qw-switch" role="tablist" aria-label="Editor view">
        {(["edit", "preview"] as const).map((v) => (
          <button
            key={v}
            role="tab"
            aria-selected={mobileView === v}
            className={mobileView === v ? "active" : ""}
            onClick={() => setMobileView(v)}
          >
            {v === "edit" ? (
              "Edit"
            ) : (
              <>
                <Eye size={14} /> Preview
              </>
            )}
          </button>
        ))}
      </div>

      <div className={`qw-editor show-${mobileView}`}>
        <div className="qw-form">
          <section className="qw-section">
            <h3>
              <span>1</span> Client &amp; project
            </h3>
            <div className="qw-row">
              <label>
                Client name
                <input
                  value={quote.client_name}
                  maxLength={160}
                  placeholder="e.g. Racheal Eniola"
                  onChange={(e) => set("client_name", e.target.value)}
                />
              </label>
              <label>
                Project title
                <input
                  value={quote.project_title}
                  maxLength={200}
                  placeholder="e.g. Book launch & Amazon visibility"
                  onChange={(e) => set("project_title", e.target.value)}
                />
              </label>
            </div>
            <label>
              Short message
              <textarea
                rows={3}
                maxLength={1500}
                value={quote.intro}
                onChange={(e) => set("intro", e.target.value)}
              />
            </label>
          </section>

          <section className="qw-section">
            <div className="qw-section-head">
              <h3>
                <span>2</span> Packages
              </h3>
              <label className="qw-currency">
                Currency
                <select
                  value={quote.currency}
                  onChange={(e) => set("currency", e.target.value as QuoteCurrency)}
                >
                  {QUOTE_CURRENCIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="qw-templates">
              <span>Start from:</span>
              {QUOTE_TEMPLATES.map((t) => (
                <button key={t.key} type="button" onClick={() => applyTemplate(t.key)}>
                  {t.label}
                </button>
              ))}
            </div>
            {quote.packages.map((pkg, i) => (
              <div key={i} className={`qw-pkg${pkg.recommended ? " is-recommended" : ""}`}>
                <div className="qw-row qw-row-3">
                  <label>
                    Package name
                    <input
                      value={pkg.name}
                      maxLength={80}
                      onChange={(e) => setPkg(i, { name: e.target.value })}
                    />
                  </label>
                  <label>
                    Price ({quote.currency})
                    <input
                      type="number"
                      min={0}
                      step="any"
                      inputMode="decimal"
                      value={pkg.price || ""}
                      placeholder="0"
                      onChange={(e) => setPkg(i, { price: Number(e.target.value) })}
                    />
                  </label>
                  <label>
                    Was (optional, shown slashed)
                    <input
                      type="number"
                      min={0}
                      step="any"
                      inputMode="decimal"
                      value={pkg.original_price || ""}
                      placeholder="e.g. 900"
                      onChange={(e) =>
                        setPkg(i, { original_price: Number(e.target.value) || null })
                      }
                    />
                  </label>
                  <label>
                    Delivery
                    <input
                      value={pkg.delivery}
                      maxLength={80}
                      placeholder="e.g. 2 weeks"
                      onChange={(e) => setPkg(i, { delivery: e.target.value })}
                    />
                  </label>
                </div>
                <label>
                  What’s included <small>(one per line)</small>
                  <textarea
                    rows={4}
                    value={pkg.features.join("\n")}
                    placeholder={"Amazon listing review\nKeyword research\nLaunch plan"}
                    onChange={(e) => setPkg(i, { features: e.target.value.split("\n") })}
                  />
                </label>
                <div className="qw-pkg-actions">
                  <button
                    type="button"
                    className={pkg.recommended ? "is-on" : ""}
                    aria-pressed={pkg.recommended}
                    onClick={() => setPkg(i, { recommended: !pkg.recommended })}
                  >
                    <Star size={14} /> {pkg.recommended ? "Recommended" : "Mark recommended"}
                  </button>
                  <button
                    type="button"
                    disabled={quote.packages.length >= MAX_PACKAGES}
                    onClick={() =>
                      set("packages", [
                        ...quote.packages.slice(0, i + 1),
                        { ...pkg, name: `${pkg.name} copy`, recommended: false },
                        ...quote.packages.slice(i + 1),
                      ])
                    }
                  >
                    <Copy size={14} /> Duplicate
                  </button>
                  <button
                    type="button"
                    className="is-danger"
                    disabled={quote.packages.length <= 1}
                    onClick={() =>
                      set(
                        "packages",
                        quote.packages.filter((_, j) => j !== i),
                      )
                    }
                  >
                    <Trash2 size={14} /> Remove
                  </button>
                </div>
              </div>
            ))}
            {quote.packages.length < MAX_PACKAGES && (
              <button
                type="button"
                className="qw-add"
                onClick={() =>
                  set("packages", [
                    ...quote.packages,
                    blankPackage(`Package ${quote.packages.length + 1}`),
                  ])
                }
              >
                <Plus size={15} /> Add package
              </button>
            )}
          </section>

          <section className="qw-section">
            <h3>
              <span>3</span> Notes &amp; validity
            </h3>
            <label>
              Notes &amp; terms <small>(payment, revisions, what’s not included)</small>
              <textarea
                rows={3}
                maxLength={2000}
                value={quote.notes}
                onChange={(e) => set("notes", e.target.value)}
              />
            </label>
            <div className="qw-row">
              <label>
                Prepared by
                <input
                  value={quote.prepared_by}
                  maxLength={160}
                  onChange={(e) => set("prepared_by", e.target.value)}
                />
              </label>
              <label>
                Valid until
                <input
                  type="date"
                  value={quote.valid_until ?? ""}
                  onChange={(e) => set("valid_until", e.target.value || null)}
                />
              </label>
            </div>
          </section>

          {quote.id && (
            <button
              type="button"
              className="qw-delete"
              disabled={Boolean(busy)}
              onClick={() => void remove()}
            >
              <Trash2 size={14} /> Delete quote
            </button>
          )}
        </div>

        <div className="qw-preview" aria-label="Live preview">
          <p className="qw-preview-label">
            <Eye size={14} /> Live preview — what your buyer sees
          </p>
          <div className="qw-preview-frame">
            <QuoteDocument quote={quote} />
          </div>
        </div>
      </div>

      {/* Fixed-width copy used for PDF/image export, so files look the same on any screen. */}
      <div className="qw-export" aria-hidden="true">
        <QuoteDocument quote={quote} ref={exportRef} />
      </div>
    </div>
  );
}
