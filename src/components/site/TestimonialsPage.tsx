import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Quote } from "lucide-react";
import { Container } from "@/components/site/Primitives";
import { CtaBand } from "@/components/site/CtaBand";
import { TestimonialStrip } from "@/components/site/TestimonialStrip";
import { fetchPublicContent } from "@/lib/public-content";
import { CTAS } from "@/config/brand";
import "./testimonials-page.css";

type MediaFilter = "all" | "image" | "video";

const TABS: { key: MediaFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "video", label: "Video" },
  { key: "image", label: "Screenshots" },
];

const TAB_COPY: Record<MediaFilter, string> = {
  all: "All testimonials",
  video: "Video testimonials",
  image: "Screenshots & reviews",
};

export function TestimonialsPage() {
  const [mediaType, setMediaType] = useState<MediaFilter>("all");

  const countQuery = useQuery({
    queryKey: ["public", "testimonials", "", "", ""],
    queryFn: ({ signal }) =>
      fetchPublicContent<{ items: { id: string }[] }>("/api/public/testimonials?", signal),
  });
  const count = countQuery.data?.items.length;

  return (
    <>
      <section className="tsp-hero">
        <div className="tsp-hero-grid" aria-hidden="true" />
        <Container className="relative z-10">
          <div className="tsp-hero-copy">
            <span className="tsp-hero-badge" aria-hidden="true">
              <Quote />
            </span>
            <p className="tsp-eyebrow">
              <span /> Client proof
            </p>
            <h1>What clients actually say</h1>
            <p className="tsp-hero-lede">
              Real screenshots and video, straight from the people we have worked with. No
              fabricated quotes, no invented numbers.
            </p>
            {typeof count === "number" ? (
              <p className="tsp-hero-count">
                {count} verified {count === 1 ? "testimonial" : "testimonials"} published
              </p>
            ) : null}
          </div>

          <div className="tsp-tabs" role="tablist" aria-label="Filter testimonials by type">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={mediaType === tab.key}
                className={mediaType === tab.key ? "active" : undefined}
                onClick={() => setMediaType(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </Container>
      </section>

      <TestimonialStrip
        key={mediaType}
        {...(mediaType === "all" ? {} : { mediaType })}
        eyebrow="Client proof"
        title={TAB_COPY[mediaType]}
      />

      <CtaBand
        title="Want results like these?"
        body="Start a project and we will map the first phase for your specific situation."
        primary={CTAS.primary}
        secondary={CTAS.work}
      />
    </>
  );
}
