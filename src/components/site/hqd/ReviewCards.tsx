import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BadgeCheck, Star, X } from "lucide-react";
import { platformLabel } from "@/lib/expert-reviews";

export type PublicReview = {
  id: string;
  client_name: string;
  platform: string;
  rating: number | null;
  review_text: string;
  review_date: string | null;
  screenshot_url: string;
};

function formatDate(value: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="hqd-review-stars" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={15} aria-hidden="true" className={n <= rating ? "on" : ""} />
      ))}
    </span>
  );
}

/** Lightbox showing the original review screenshot. */
function VerifyDialog({ review, onClose }: { review: PublicReview; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [onClose]);
  return createPortal(
    <div className="hqd dark">
      <div
        className="hqd-review-backdrop"
        role="presentation"
        onClick={(event) => event.target === event.currentTarget && onClose()}
      >
        <div
          className="hqd-review-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`review-${review.id}`}
        >
          <div className="hqd-review-dialog-head">
            <div>
              <p className="hqd-review-verified">
                <BadgeCheck size={16} aria-hidden="true" /> Verified by HQ360
              </p>
              <h2 id={`review-${review.id}`}>
                {review.client_name} · {platformLabel(review.platform)}
              </h2>
            </div>
            <button
              ref={closeRef}
              type="button"
              className="hqd-review-close"
              aria-label="Close"
              onClick={onClose}
            >
              <X size={18} />
            </button>
          </div>
          <img
            src={review.screenshot_url}
            alt={`Screenshot of ${review.client_name}'s original review`}
          />
          <p className="hqd-review-dialog-note">
            Original review screenshot supplied by the expert and checked by HQ360 before
            publishing.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ReviewCard({ review, onVerify }: { review: PublicReview; onVerify: () => void }) {
  const date = formatDate(review.review_date);
  return (
    <article className="hqd-review-card">
      <header>
        <span className={`hqd-review-platform hqd-review-platform--${review.platform}`}>
          {platformLabel(review.platform)}
        </span>
        {review.rating ? <Stars rating={review.rating} /> : null}
      </header>
      <blockquote>“{review.review_text}”</blockquote>
      <footer>
        <div>
          <strong>{review.client_name}</strong>
          {date && <small>{date}</small>}
        </div>
        <button type="button" className="hqd-review-verify" onClick={onVerify}>
          <BadgeCheck size={15} aria-hidden="true" /> Verify review
        </button>
      </footer>
    </article>
  );
}

export function ReviewCards({ reviews }: { reviews: PublicReview[] }) {
  const [open, setOpen] = useState<PublicReview | null>(null);
  return (
    <>
      <div className="hqd-review-grid">
        {reviews.map((review) => (
          <ReviewCard key={review.id} review={review} onVerify={() => setOpen(review)} />
        ))}
      </div>
      {open && <VerifyDialog review={open} onClose={() => setOpen(null)} />}
    </>
  );
}
