import { useEffect, useRef, useState, type ReactNode } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  TRUSTPILOT,
  TRUSTPILOT_BUSINESS_UNIT_ID,
  TRUSTPILOT_PROFILE_URL,
  TRUSTPILOT_REVIEWS,
} from "@/data/trustpilot";

/** Trustpilot's own brand green — used only for the star rating, to read as an authentic badge. */
const TRUSTPILOT_GREEN = "#00b67a";

function Stars({ score, size = 14 }: { score: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden="true">
      {Array.from({ length: 5 }, (_, i) => {
        const filled = i < Math.round(score);
        return (
          <Star
            key={i}
            width={size}
            height={size}
            fill={filled ? TRUSTPILOT_GREEN : "none"}
            color={filled ? TRUSTPILOT_GREEN : "currentColor"}
            strokeWidth={filled ? 0 : 1.5}
          />
        );
      })}
    </span>
  );
}

/** Compact inline badge — score, stars and review count, linking out. Static (real) data, no script. */
export function TrustpilotBadge({
  className,
  tone = "default",
}: {
  className?: string;
  /** "dark" for use on a dark/carbon background (e.g. the footer). */
  tone?: "default" | "dark";
}) {
  const text = tone === "dark" ? "text-[oklch(0.88_0.008_90)]" : "text-foreground";
  const muted = tone === "dark" ? "text-[oklch(0.7_0.008_90)]" : "text-muted-foreground";
  return (
    <a
      href={TRUSTPILOT_PROFILE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-2 text-sm font-medium transition-opacity hover:opacity-80",
        text,
        className,
      )}
    >
      <Stars score={TRUSTPILOT.trustScore} />
      <span>
        {TRUSTPILOT.trustScore.toFixed(1)} on <span className="font-semibold">Trustpilot</span>
        <span className={muted}>
          {" "}
          &middot; {TRUSTPILOT.reviewCount} review{TRUSTPILOT.reviewCount === 1 ? "" : "s"}
        </span>
      </span>
    </a>
  );
}

/** A real review, rendered as a quote card. Renders nothing if there is no review to show. */
export function TrustpilotReviewCard({
  className,
  bare = false,
}: {
  className?: string;
  /** Strip the card's own border/background — for nesting inside another card. */
  bare?: boolean;
}) {
  const review = TRUSTPILOT_REVIEWS[0];
  if (!review) return null;
  return (
    <figure
      className={cn(!bare && "rounded-2xl border border-border bg-card p-6 sm:p-7", className)}
    >
      <div className="flex items-center justify-between gap-3">
        <Stars score={review.rating} size={15} />
        {review.verified ? (
          <span className="text-xs font-semibold tracking-[0.1em] text-muted-foreground uppercase">
            Verified
          </span>
        ) : null}
      </div>
      <blockquote className="mt-4">
        <p className="font-display text-base leading-snug">{review.title}</p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          &ldquo;{review.body}&rdquo;
        </p>
      </blockquote>
      <figcaption className="mt-5 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>
          {review.author} &middot; {review.date}
        </span>
        <a
          href={TRUSTPILOT_PROFILE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-foreground underline underline-offset-4 hover:text-brand"
        >
          Read on Trustpilot
        </a>
      </figcaption>
    </figure>
  );
}

/* ------------------------------------------------ live TrustBox widget */

declare global {
  interface Window {
    Trustpilot?: { loadFromElement: (el: Element, forceRefresh?: boolean) => void };
  }
}

// Trustpilot's official TrustBox "Mini" template — score, stars, review count, link out.
const MINI_TEMPLATE_ID = "53aa8807dec7e10d38f59f32";
const SCRIPT_SRC = "https://widget.trustpilot.com/bootstrap/v5/tp.widget.bootstrap.min.js";

let scriptPromise: Promise<void> | null = null;

/** Loads Trustpilot's bootstrap script once per page, however many widgets are on it. */
function loadTrustpilotScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.Trustpilot) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      if (window.Trustpilot) return resolve();
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("trustpilot_script_failed")));
      return;
    }
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("trustpilot_script_failed"));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/**
 * Trustpilot's own live TrustBox widget — pulls score, stars, review count
 * (and new reviews as they come in) straight from Trustpilot's servers. No
 * data here needs updating by hand. Falls back to `fallback` if the script
 * is blocked (ad blocker, offline, script CDN unreachable) or slow.
 */
function TrustpilotWidget({
  height = "150px",
  fallback,
}: {
  height?: string;
  fallback: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      if (!cancelled) setStatus((s) => (s === "loading" ? "error" : s));
    }, 6000);

    loadTrustpilotScript()
      .then(() => {
        if (cancelled) return;
        if (ref.current && window.Trustpilot) window.Trustpilot.loadFromElement(ref.current, true);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, []);

  if (status === "error") return <>{fallback}</>;

  return (
    <div className="relative" style={{ minHeight: height }}>
      {status === "loading" ? (
        <div
          className="route-skeleton-block absolute inset-0"
          role="status"
          aria-label="Loading live Trustpilot rating"
        />
      ) : null}
      <div
        ref={ref}
        className="trustpilot-widget"
        data-locale="en-US"
        data-template-id={MINI_TEMPLATE_ID}
        data-businessunit-id={TRUSTPILOT_BUSINESS_UNIT_ID}
        data-style-height={height}
        data-style-width="100%"
      >
        <a href={TRUSTPILOT_PROFILE_URL} target="_blank" rel="noopener noreferrer">
          Trustpilot
        </a>
      </div>
    </div>
  );
}

/**
 * The homepage Trustpilot card: a live score widget (auto-updates as reviews
 * come in) with the real review underneath, so the card never looks thin.
 * If the live widget can't load, both fall back to the static verified data.
 */
export function TrustpilotCard({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-border bg-card p-6 sm:p-7", className)}>
      <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
        On Trustpilot
      </p>
      <div className="mt-3">
        <TrustpilotWidget height="130px" fallback={<TrustpilotBadge />} />
      </div>
      <div className="mt-5 border-t border-border pt-5">
        <TrustpilotReviewCard bare />
      </div>
    </div>
  );
}
