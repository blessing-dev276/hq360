const GA_MEASUREMENT_ID = "G-N45HJR5LCC";

/** Injects the GA4 gtag.js tag. Client-only; call after analytics consent. */
export function loadGoogleAnalytics(): void {
  if (typeof window === "undefined") return;
  if (document.getElementById("ga4-gtag")) return;

  const w = window as unknown as { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };
  w.dataLayer = w.dataLayer || [];
  w.gtag = function gtag(...args: unknown[]) {
    w.dataLayer!.push(args);
  };
  w.gtag("js", new Date());
  w.gtag("config", GA_MEASUREMENT_ID);

  const script = document.createElement("script");
  script.id = "ga4-gtag";
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);
}

/** Consent-aware conversion events; never include contact details or free-text input. */
export function trackConversion(
  event: "project_inquiry_submitted" | "visibility_check_submitted",
  service?: string,
) {
  if (typeof window === "undefined") return;
  try {
    if (localStorage.getItem("hq360-cookie-consent") !== "accepted") return;
    const analytics = window as unknown as { gtag?: (...args: unknown[]) => void };
    analytics.gtag?.("event", event, service ? { service } : {});
  } catch {
    /* Storage or analytics may be unavailable. */
  }
}
