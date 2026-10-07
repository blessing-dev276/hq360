import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { loadClarity } from "@/lib/clarity";
import { loadGoogleAnalytics } from "@/lib/google-analytics";

const KEY = "hq360-cookie-consent";

function loadAnalytics() {
  loadClarity();
  loadGoogleAnalytics();
}

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const consent = window.localStorage.getItem(KEY);
      if (!consent) setVisible(true);
      else if (consent === "accepted") loadAnalytics();
    } catch {
      /* storage blocked — do not show */
    }
  }, []);

  function decide(value: "accepted" | "declined") {
    try {
      window.localStorage.setItem(KEY, value);
    } catch {
      /* ignore */
    }
    if (value === "accepted") loadAnalytics();
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card px-5 py-4 shadow-lift sm:px-6 lg:px-8"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          We use a small number of cookies to understand how the site is used. Nothing is sold. See
          the{" "}
          <Link to="/privacy" className="text-brand underline underline-offset-4">
            privacy policy
          </Link>
          .
        </p>
        <div className="flex shrink-0 gap-3">
          <button
            type="button"
            onClick={() => decide("declined")}
            className="rounded-full border border-border px-5 py-2 text-sm font-medium text-foreground hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={() => decide("accepted")}
            className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
