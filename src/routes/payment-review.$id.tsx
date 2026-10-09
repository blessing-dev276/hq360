import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { money } from "@/lib/payments/types";

export const Route = createFileRoute("/payment-review/$id")({
  head: () => ({
    meta: [
      { title: "Review bank receipt | HQ360" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: ReceiptReview,
});
type Review = {
  receipt: {
    id: string;
    status: string;
    submitted_at: string;
    reviewed_at: string | null;
    bank_reference: string | null;
    admin_note: string | null;
  };
  invoice: {
    id: string;
    number: string;
    buyer_name: string;
    buyer_email: string;
    description: string;
    amount_minor: number;
    currency: "USD" | "EUR";
    bank_transfer_amount_minor: number | null;
    status: string;
    payment_id: string | null;
  };
};
function ReceiptReview() {
  const { id } = Route.useParams();
  const [data, setData] = useState<Review | null>(null);
  const [error, setError] = useState("");
  const [unauthorized, setUnauthorized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reference, setReference] = useState("");
  const [checked, setChecked] = useState(false);
  const [note, setNote] = useState("");
  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/staff/payment-receipts/${encodeURIComponent(id)}`);
      const result = await response.json();
      if (response.status === 401) {
        setUnauthorized(true);
        throw new Error("Sign in as Admin or Founder to review this receipt.");
      }
      if (!response.ok) throw new Error(result.error || "Could not load receipt.");
      setUnauthorized(false);
      setData(result);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load receipt.");
    }
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);
  async function act(action: "approve" | "reject") {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/staff/payment-receipts/${encodeURIComponent(id)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, reference, bank_checked: checked, note }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not review receipt.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not review receipt.");
    } finally {
      setBusy(false);
    }
  }
  const inv = data?.invoice;
  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-10 text-white">
      <div className="mx-auto max-w-2xl rounded-2xl border border-white/15 bg-neutral-900 p-6 sm:p-8">
        <a href="/" className="text-xl font-bold">
          HQ360
        </a>
        <h1 className="mt-8 text-2xl font-bold">Review bank transfer screenshot</h1>
        {error && (
          <p role="alert" className="mt-5 rounded-lg bg-red-900/40 p-4">
            {error}
          </p>
        )}
        {unauthorized && (
          <p className="mt-4">
            <a className="underline" href="/admin">
              Admin sign in
            </a>{" "}
            ·{" "}
            <a className="underline" href="/expert">
              Founder sign in
            </a>
            . Return to this email link after signing in.
          </p>
        )}
        {inv && (
          <>
            <div className="mt-6 space-y-2 text-sm">
              <p>
                <strong>Invoice:</strong> {inv.number}
              </p>
              <p>
                <strong>Buyer:</strong> {inv.buyer_name} ({inv.buyer_email})
              </p>
              <p>
                <strong>Invoice total:</strong> {money(inv.amount_minor, inv.currency)}
              </p>
              <p>
                <strong>Expected bank receipt:</strong>{" "}
                {money(inv.bank_transfer_amount_minor ?? inv.amount_minor, "EUR")}
              </p>
              <p>
                <strong>Submitted:</strong> {new Date(data.receipt.submitted_at).toLocaleString()}
              </p>
              <p>
                <strong>Status:</strong> {data.receipt.status}
              </p>
            </div>
            <img
              className="mt-6 max-h-[650px] w-full rounded-lg border border-white/15 object-contain"
              src={`/api/staff/payment-receipts/${encodeURIComponent(id)}/image`}
              alt={`Payment screenshot for ${inv.number}`}
            />
            {data.receipt.status === "submitted" && (
              <div className="mt-6 space-y-4">
                <p className="text-sm text-amber-200">
                  A screenshot alone does not confirm payment. Check the actual bank receipt before
                  approving.
                </p>
                <label className="flex items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => setChecked(e.target.checked)}
                  />{" "}
                  I checked the bank account and confirmed the full EUR amount was received.
                </label>
                <label className="block text-sm">
                  Bank transaction reference
                  <input
                    className="mt-2 w-full rounded-lg border border-white/20 bg-neutral-800 p-3"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    maxLength={200}
                  />
                </label>
                <button
                  className="rounded-lg bg-orange-600 px-5 py-3 font-semibold disabled:opacity-50"
                  disabled={busy || !checked || reference.trim().length < 3}
                  onClick={() => void act("approve")}
                >
                  Confirm payment
                </button>
                <label className="block text-sm">
                  Rejection note (optional)
                  <input
                    className="mt-2 w-full rounded-lg border border-white/20 bg-neutral-800 p-3"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={500}
                  />
                </label>
                <button
                  className="rounded-lg border border-white/30 px-5 py-3 disabled:opacity-50"
                  disabled={busy}
                  onClick={() => void act("reject")}
                >
                  Reject screenshot
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
