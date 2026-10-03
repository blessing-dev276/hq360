import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import "@/components/admin/buyer-invoice.css";

export const Route = createFileRoute("/unsubscribe")({
  head: () => ({
    meta: [
      { title: "Unsubscribe | HQ360" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: Unsubscribe,
});

/** Confirm page for outreach unsubscribes. A button press (not the page
 *  load) unsubscribes, so email link scanners can't do it by accident. */
function Unsubscribe() {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const params = typeof window === "undefined" ? null : new URLSearchParams(window.location.search);
  const email = params?.get("e") ?? "";
  async function confirm() {
    setState("busy");
    const response = await fetch(
      `/api/outreach/unsubscribe?${new URLSearchParams({ e: email, t: params?.get("t") ?? "" })}`,
      { method: "POST" },
    ).catch(() => null);
    setState(response?.ok ? "done" : "error");
  }
  return (
    <div className="buyer-invoice-page">
      <div className="buyer-invoice-shell">
        <section className="buyer-invoice-card">
          <div className="buyer-stripe" aria-hidden="true" />
          <div className="buyer-card-inner" style={{ textAlign: "center" }}>
            <img
              src="/logo-text.png"
              width={120}
              height={60}
              alt="HQ360"
              style={{ margin: "0 auto", width: 120, height: "auto" }}
            />
            {state === "done" ? (
              <div className="buyer-greeting">
                <h1>You're unsubscribed.</h1>
                <p>{email || "This address"} won't receive outreach emails from HQ360 again.</p>
              </div>
            ) : (
              <>
                <div className="buyer-greeting">
                  <h1>Unsubscribe from HQ360 emails?</h1>
                  <p>
                    {email ? <strong>{email}</strong> : "This address"} will no longer receive
                    outreach emails from HQ360.
                  </p>
                </div>
                {state === "error" && (
                  <p className="buyer-message error" role="alert">
                    That link didn't work. Reply to our email with “unsubscribe” and we'll remove
                    you.
                  </p>
                )}
                <div className="buyer-actions">
                  <button
                    type="button"
                    className="buyer-pay"
                    style={{ border: 0, cursor: "pointer" }}
                    disabled={state === "busy" || !email}
                    onClick={() => void confirm()}
                  >
                    {state === "busy" ? "Unsubscribing…" : "Unsubscribe"}
                  </button>
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
