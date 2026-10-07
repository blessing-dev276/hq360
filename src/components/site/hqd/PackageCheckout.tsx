import { useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, ArrowUpRight, LockKeyhole, X } from "lucide-react";
import type { Plan } from "@/data/pricing";
import { planKey } from "@/data/pricing";

/** "Pay now" for a website package: collects buyer details, then hands off
 *  to the secure /pay page with a NOWPayments crypto checkout. */
export function PackageCheckout({ plan, featured }: { plan: Plan; featured?: boolean }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && !busy && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          plan: planKey(plan),
          buyer_name: form.get("buyer_name"),
          buyer_email: form.get("buyer_email"),
          buyer_phone: form.get("buyer_phone"),
          website: form.get("website") || undefined,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.payUrl)
        throw new Error(data.error || "Checkout is unavailable right now. Please try again.");
      window.location.assign(data.payUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout is unavailable right now.");
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={`hqd-pay ${featured ? "hqd-pay--light" : ""}`}
        onClick={() => setOpen(true)}
      >
        <span>Pay now</span>
        <ArrowRight size={17} strokeWidth={2.2} aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          // Portal out of the card: its hover transform would otherwise trap
          // position:fixed. The .hqd wrapper keeps the site's theme tokens.
          <div className="hqd dark">
            <div
              className="hqd-checkout-backdrop"
              role="presentation"
              onClick={(event) => event.target === event.currentTarget && !busy && setOpen(false)}
            >
              <div
                className="hqd-form-shell hqd-checkout"
                role="dialog"
                aria-modal="true"
                aria-labelledby={`checkout-${planKey(plan)}`}
              >
                <button
                  type="button"
                  className="hqd-checkout-close"
                  aria-label="Close"
                  disabled={busy}
                  onClick={() => setOpen(false)}
                >
                  <X size={18} />
                </button>
                <p className="hqd-hero-kicker" style={{ margin: 0 }}>
                  {plan.name} package
                </p>
                <h2
                  id={`checkout-${planKey(plan)}`}
                  className="hqd-lede"
                  style={{ fontSize: "2rem" }}
                >
                  {plan.price}{" "}
                  <small style={{ fontSize: "1rem", opacity: 0.6 }}>{plan.cadence}</small>
                </h2>
                <p className="hqd-note">
                  Pay securely with crypto via NOWPayments. We'll contact you to confirm your brief
                  and start the work.
                </p>
                <form
                  onSubmit={submit}
                  style={{ display: "grid", gap: "0.9rem", marginTop: "0.5rem" }}
                >
                  <label className="hqd-field">
                    Full name
                    <input
                      className="hqd-input"
                      name="buyer_name"
                      required
                      minLength={2}
                      maxLength={150}
                      autoComplete="name"
                    />
                  </label>
                  <label className="hqd-field">
                    Email
                    <input
                      className="hqd-input"
                      name="buyer_email"
                      type="email"
                      required
                      maxLength={254}
                      autoComplete="email"
                    />
                  </label>
                  <label className="hqd-field">
                    Phone
                    <input
                      className="hqd-input"
                      name="buyer_phone"
                      type="tel"
                      required
                      minLength={7}
                      maxLength={25}
                      placeholder="+234…"
                      autoComplete="tel"
                    />
                  </label>
                  <input
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                    aria-hidden="true"
                    style={{ position: "absolute", left: "-9999px", width: 1, height: 1 }}
                  />
                  {error && (
                    <p className="hqd-alert" role="alert">
                      {error}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={busy}
                    className="hqd-pill hqd-pill--orange"
                    style={{ justifyContent: "space-between", border: 0, cursor: "pointer" }}
                  >
                    <span>{busy ? "Preparing secure checkout…" : `Continue to payment`}</span>
                    <span className="hqd-pill-dot" aria-hidden="true">
                      <ArrowUpRight size={17} strokeWidth={2.4} />
                    </span>
                  </button>
                  <p className="hqd-note" style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <LockKeyhole size={13} aria-hidden="true" /> You'll review your invoice before
                    paying.
                  </p>
                </form>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
