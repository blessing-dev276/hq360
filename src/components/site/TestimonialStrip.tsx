import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Play, X } from "lucide-react";
import { Section, SectionHeader } from "@/components/site/Primitives";
import { Reveal } from "@/components/site/Reveal";
import { CaseStudySkeleton } from "@/components/site/loading/RouteLoading";
import { fetchPublicContent } from "@/lib/public-content";
import "./testimonial-strip.css";

type Testimonial = {
  id: string;
  title: string;
  quote: string | null;
  media_type: "image" | "video";
  media_url: string;
  thumbnail_url: string | null;
};

/**
 * Renders published testimonials for an industry and/or a capability.
 * Distinct from PortfolioStrip: a testimonial is proof of reputation, not a
 * delivered work sample. Screenshots and client testimonial videos share the
 * same table — pass `mediaType` to show only one kind. Managed from
 * /admin > Testimonials. Renders nothing when there is nothing to show.
 */
export function TestimonialStrip({
  id,
  industry,
  capability,
  mediaType,
  eyebrow = "What clients say",
  title = "Testimonials",
  tone = "base",
}: {
  id?: string;
  industry?: string;
  capability?: string;
  /** Show only screenshots or only videos. Omit to show both. */
  mediaType?: "image" | "video";
  eyebrow?: string;
  title?: string;
  tone?: "base" | "raised";
}) {
  const params = new URLSearchParams();
  if (industry) params.set("industry", industry);
  if (capability) params.set("capability", capability);
  if (mediaType) params.set("mediaType", mediaType);
  const query = useQuery({
    queryKey: ["public", "testimonials", industry ?? "", capability ?? "", mediaType ?? ""],
    queryFn: ({ signal }) =>
      fetchPublicContent<{ items: Testimonial[] }>(
        `/api/public/testimonials?${params.toString()}`,
        signal,
      ),
  });
  const items = query.data?.items;
  const [openId, setOpenId] = useState<string | null>(null);
  const openItem = items?.find((it) => it.id === openId);

  if (items?.length === 0) return null;

  return (
    <Section id={id} tone={tone}>
      <SectionHeader eyebrow={eyebrow} title={title} />
      {query.isPending ? (
        <div role="status" aria-busy="true">
          <span className="sr-only">Loading testimonials</span>
          <div aria-hidden="true">
            <CaseStudySkeleton cardsOnly />
          </div>
        </div>
      ) : !items && query.isError ? (
        <div className="public-content-error mt-10">
          <p>Testimonials couldn&rsquo;t load just now.</p>
          <button type="button" className="route-retry-button" onClick={() => void query.refetch()}>
            Try again
          </button>
        </div>
      ) : (
        <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {items?.map((it, i) => (
            <li key={it.id}>
              <Reveal delay={i * 35} className="h-full">
                <button type="button" className="tst-card" onClick={() => setOpenId(it.id)}>
                  <span className="tst-shot">
                    {it.media_type === "video" ? (
                      <>
                        <video
                          src={it.media_url}
                          poster={it.thumbnail_url ?? undefined}
                          controlsList="nodownload"
                          onContextMenu={(event) => event.preventDefault()}
                          muted
                          playsInline
                          preload="metadata"
                        />
                        <span className="tst-play" aria-hidden="true">
                          <Play />
                        </span>
                      </>
                    ) : (
                      <img src={it.media_url} alt={it.title} loading="lazy" decoding="async" />
                    )}
                  </span>
                  <span className="tst-caption">{it.title}</span>
                </button>
              </Reveal>
            </li>
          ))}
        </ul>
      )}

      {openItem ? <TestimonialViewer item={openItem} onClose={() => setOpenId(null)} /> : null}
    </Section>
  );
}

function TestimonialViewer({ item, onClose }: { item: Testimonial; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className="tst-viewer"
      aria-label={item.title}
      onClose={onClose}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="tst-viewer-shell">
        <header className="tst-viewer-bar">
          <span className="tst-viewer-title">{item.title}</span>
          <button type="button" onClick={onClose} className="tst-viewer-close" aria-label="Close">
            <X aria-hidden="true" />
          </button>
        </header>
        <div className="tst-viewer-scroll">
          {item.media_type === "video" ? (
            <video
              src={item.media_url}
              poster={item.thumbnail_url ?? undefined}
              controls
              controlsList="nodownload"
              onContextMenu={(event) => event.preventDefault()}
              autoPlay
              playsInline
              className="tst-viewer-img"
            />
          ) : (
            <img
              src={item.media_url}
              alt={item.title}
              className="tst-viewer-img"
              decoding="async"
            />
          )}
          {item.quote ? <p className="tst-viewer-quote">{item.quote}</p> : null}
        </div>
      </div>
    </dialog>
  );
}
