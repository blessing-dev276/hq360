import { LoadingRegion, Skeleton } from "@/components/ui/skeleton";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, CheckCircle2, LockKeyhole, RefreshCw, Printer } from "lucide-react";
import { money, paymentKind, providerLabel, type Invoice } from "@/lib/payments/types";
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
    provider: Invoice["provider"];
    provider_invoice_id: string;
    provider_status: string | null;
    environment: string;
    buyer_name?: string;
    created_at?: string;
    paid_at?: string | null;
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
  const inv = data?.invoice;
  const first = inv?.buyer_name?.trim().split(/\s+/)[0];
  const status =
    inv?.status === "paid"
      ? "Paid"
      : inv?.status === "refunded"
        ? "Refunded"
        : inv?.status === "cancelled"
          ? "Cancelled"
          : "Awaiting payment";
  return (
    <div className="buyer-invoice-page">
      <div className="buyer-invoice-shell">
        {inv?.environment === "demo" && (
          <div className="buyer-test">Test invoice: no real payment will be collected.</div>
        )}
        <section className="buyer-invoice-card">
          <div className="buyer-stripe" aria-hidden="true" />
          {loading ? (
            <LoadingRegion label="Loading your invoice" className="buyer-card-inner">
              <span className="hq-skel-row" style={{ justifyContent: "space-between" }}>
                <Skeleton width={120} height={36} />
                <Skeleton width={90} height={30} />
              </span>
              <Skeleton width={110} height={14} style={{ marginTop: 28 }} />
              <Skeleton width="80%" height={12} style={{ marginTop: 10 }} />
              <Skeleton height={112} radius={16} style={{ marginTop: 24 }} />
              <span className="hq-skel-stack" style={{ marginTop: 24, gap: 18 }}>
                {[0, 1, 2, 3].map((i) => (
                  <span key={i} className="hq-skel-row" style={{ justifyContent: "space-between" }}>
                    <Skeleton width="28%" height={12} />
                    <Skeleton width="34%" height={12} />
                  </span>
                ))}
              </span>
              <Skeleton variant="pill" width={200} height={50} style={{ margin: "30px auto 0" }} />
            </LoadingRegion>
          ) : !inv || !data ? (
            <div className="buyer-empty">
              <h1>Invoice unavailable</h1>
              <p role="alert">{error}</p>
              <button className="buyer-link" onClick={() => void load()}>
                <RefreshCw size={14} /> Try again
              </button>
            </div>
          ) : (
            <div className="buyer-card-inner">
              <div className="buyer-head">
                <a href="/" aria-label="HQ360 home">
                  <img src="/logo-text.webp" width={120} height={60} alt="HQ360" />
                </a>
                <div className="buyer-number">
                  Invoice
                  <strong>{inv.number}</strong>
                </div>
              </div>

              <div className="buyer-greeting">
                <h1>{first ? `Hi ${first},` : "Hello,"}</h1>
                <p>
                  {inv.status === "paid"
                    ? "Thank you, your payment has been received. Keep this page for your records."
                    : inv.status === "cancelled"
                      ? "This invoice was cancelled and can no longer be paid."
                      : "Thank you for working with HQ360. Here's your invoice. You can review it and pay securely below."}
                </p>
              </div>

              <div className={`buyer-total${inv.status === "paid" ? " paid" : ""}`}>
                <div>
                  <p className="buyer-total-label">
                    {inv.status === "paid" ? "Amount paid" : "Amount due"}
                  </p>
                  <p className="buyer-total-amount">{money(inv.amount_minor, inv.currency)}</p>
                  <p className="buyer-total-sub">
                    {inv.status === "paid" && inv.paid_at
                      ? `Paid ${longDate(inv.paid_at)}`
                      : `Due ${longDate(inv.due_date)}`}
                  </p>
                </div>
                <span className={`buyer-status ${inv.status === "draft" ? "pending" : inv.status}`}>
                  {status}
                </span>
              </div>

              <dl className="buyer-details">
                <div className="buyer-for-row">
                  <dt className="buyer-for-label">For</dt>
                  <dd className="buyer-for">{inv.description}</dd>
                </div>
                {inv.buyer_name && (
                  <div>
                    <dt>Billed to</dt>
                    <dd>{inv.buyer_name}</dd>
                  </div>
                )}
                {inv.created_at && (
                  <div>
                    <dt>Invoice date</dt>
                    <dd>{longDate(inv.created_at)}</dd>
                  </div>
                )}
                <div>
                  <dt>Due date</dt>
                  <dd>{longDate(inv.due_date)}</dd>
                </div>
                <div>
                  <dt>Payment method</dt>
                  <dd>{providerLabel(inv.provider)}</dd>
                </div>
                <div>
                  <dt>Reference</dt>
                  <dd>{inv.provider_invoice_id}</dd>
                </div>
              </dl>

              {error && (
                <p className="buyer-message error" role="alert">
                  {error}
                </p>
              )}
              {notice && (
                <p className="buyer-message info" role="status">
                  {notice}
                </p>
              )}

              {inv.status === "paid" ? (
                <div className="buyer-paid">
                  <CheckCircle2 size={20} /> Payment confirmed by {providerLabel(inv.provider)}
                </div>
              ) : inv.status === "cancelled" || inv.status === "refunded" ? null : (
                <div className="buyer-actions">
                  <a className="buyer-pay" href={data.checkout.url} rel="noreferrer">
                    {paymentKind(inv.provider) === "crypto" ? "Pay with crypto" : "Pay invoice"}
                    <ArrowUpRight size={17} />
                  </a>
                  <p className="buyer-note">
                    {paymentKind(inv.provider) === "crypto"
                      ? `You'll choose your cryptocurrency and network on ${providerLabel(inv.provider)}'s secure checkout.`
                      : `You'll pay by card or bank transfer on ${providerLabel(inv.provider)}'s secure checkout.`}
                    {inv.provider_status
                      ? ` Payment status: ${inv.provider_status.replaceAll("_", " ")}.`
                      : ""}
                  </p>
                  <button className="buyer-link" disabled={busy} onClick={() => void verify()}>
                    <RefreshCw size={14} />
                    I’ve paid, check status
                  </button>
                </div>
              )}

              <div className="buyer-closing">
                <span>
                  <LockKeyhole size={13} /> Secured by {providerLabel(inv.provider)}. Questions?{" "}
                  <a href="mailto:ceo@hq360.space">Contact HQ360</a>
                </span>
                <button
                  className="buyer-link"
                  style={{ marginTop: 0 }}
                  onClick={() => window.print()}
                >
                  <Printer size={14} /> Print
                </button>
              </div>
            </div>
          )}
        </section>
        <footer className="buyer-foot">
          HQ360 · <a href="https://www.hq360.space">hq360.space</a>
        </footer>
      </div>
    </div>
  );
}

function longDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      });
}
