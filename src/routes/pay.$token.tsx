import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, CheckCircle2, LockKeyhole, RefreshCw, Printer } from "lucide-react";
import { money } from "@/lib/payments/types";
import "@/components/admin/admin-workspace.css";
import "@/components/admin/buyer-invoice.css";

export const Route = createFileRoute("/pay/$token")({
  head: () => ({
    meta: [
      { title: "Your invoice | HQ360" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: BuyerInvoice,
});
type PaymentData = {
  invoice: {
    number: string;
    description: string;
    amount_minor: number;
    currency: "USD" | "NGN";
    due_date: string;
    status: string;
    provider_invoice_id: string;
    provider_status: string | null;
    environment: string;
  };
  checkout: { url: string };
};
function BuyerInvoice() {
  const { token } = Route.useParams();
  const [data, setData] = useState<PaymentData | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const load = useCallback(
    async (verify = false) => {
      setError("");
      try {
        const response = await fetch(`/api/pay/${encodeURIComponent(token)}`, {
          method: verify ? "POST" : "GET",
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        setData(result);
        if (verify)
          setNotice(
            result.invoice.status === "paid"
              ? "Your payment has been confirmed. Thank you."
              : "Your payment is not confirmed yet. If you have paid, please wait a moment and check again.",
          );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load invoice.");
      } finally {
        setLoading(false);
      }
    },
    [token],
  );
  useEffect(() => {
    setData(null);
    setLoading(true);
    void load();
  }, [load]);
  useEffect(() => {
    if (data?.invoice.status !== "pending") return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 15000);
    return () => window.clearInterval(timer);
  }, [data?.invoice.status, load]);
  async function verify() {
    setBusy(true);
    await load(true);
    setBusy(false);
  }
  return (
    <div className="buyer-invoice-page">
      <header>
        <a href="/" className="buyer-wordmark">
          HQ360<span>.</span>
        </a>
        <span>
          <LockKeyhole size={13} />
          Secure invoice
        </span>
      </header>
      <section className="buyer-invoice-card">
        {loading ? (
          <p role="status">Loading your invoice…</p>
        ) : !data ? (
          <>
            <h1>Invoice unavailable</h1>
            <p role="alert">{error}</p>
            <button className="admin-button" onClick={() => void load()}>
              Try again
            </button>
          </>
        ) : (
          <>
            {data.invoice.environment === "demo" && (
              <div className="buyer-test">TEST INVOICE · No real payment will be collected</div>
            )}
            <div className="buyer-invoice-heading">
              <div>
                <p className="admin-eyebrow">INVOICE {data.invoice.number}</p>
                <h1>
                  {data.invoice.status === "paid"
                    ? "Thank you for your payment."
                    : "Let’s make great things happen."}
                </h1>
              </div>
              <span className={`admin-status ${data.invoice.status}`}>
                {data.invoice.status === "paid"
                  ? "Paid"
                  : data.invoice.status === "refunded"
                    ? "Refunded"
                    : "Awaiting payment"}
              </span>
            </div>
            <div className="buyer-total">
              <span>{data.invoice.status === "paid" ? "Amount paid" : "Amount due"}</span>
              <strong>{money(data.invoice.amount_minor, data.invoice.currency)}</strong>
              <small>
                {data.invoice.currency === "USD" ? "USD · US dollars" : "NGN · Nigerian naira"}
              </small>
            </div>
            <dl className="buyer-details">
              <div>
                <dt>From</dt>
                <dd>HQ360</dd>
              </div>
              <div>
                <dt>Due date</dt>
                <dd>
                  {new Date(data.invoice.due_date + "T12:00:00").toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </dd>
              </div>
              <div>
                <dt>NOWPayments reference</dt>
                <dd>{data.invoice.provider_invoice_id}</dd>
              </div>
            </dl>
            <div className="buyer-description">
              <h2>Description</h2>
              <p>{data.invoice.description}</p>
            </div>
            {error && (
              <p className="admin-alert" role="alert">
                {error}
              </p>
            )}
            {notice && (
              <p className="admin-notice" role="status">
                {notice}
              </p>
            )}
            {data.invoice.status === "paid" ? (
              <div className="buyer-paid">
                <CheckCircle2 size={22} /> Payment confirmed by NOWPayments
              </div>
            ) : (
              <div className="buyer-actions">
                {data.invoice.status !== "refunded" && (
                  <a
                    className="admin-button admin-button-primary"
                    href={data.checkout.url}
                    rel="noreferrer"
                  >
                    Pay with crypto via NOWPayments <ArrowUpRight size={17} />
                  </a>
                )}
                <p className="admin-form-note">
                  Choose your cryptocurrency and network at checkout. Payment is confirmed after
                  processing completes.
                </p>
                {data.invoice.provider_status && (
                  <p className="admin-form-note">
                    Payment status: {data.invoice.provider_status.replaceAll("_", " ")}
                  </p>
                )}
                <button className="admin-text-button" disabled={busy} onClick={() => void verify()}>
                  <RefreshCw size={14} />
                  I’ve paid — check status
                </button>
              </div>
            )}
            <div className="buyer-invoice-foot">
              <span>
                <LockKeyhole size={12} /> Payments processed securely by NOWPayments
              </span>
              <button className="admin-text-button" onClick={() => window.print()}>
                <Printer size={14} />
                Print invoice
              </button>
            </div>
          </>
        )}
      </section>
      <footer>
        Questions about your invoice? <a href="mailto:ceo@hq360.space">Contact HQ360</a>
      </footer>
    </div>
  );
}
