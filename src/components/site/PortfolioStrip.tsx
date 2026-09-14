import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, X } from "lucide-react";
import { Section, SectionHeader } from "@/components/site/Primitives";
import { Reveal } from "@/components/site/Reveal";
import { CaseStudySkeleton } from "@/components/site/loading/RouteLoading";
import { fetchPublicContent } from "@/lib/public-content";
import "./portfolio-strip.css";

type PortfolioItem = {
  id: string;
  title: string;
  description: string | null;
  media_type: "image" | "video";
  media_url: string;
  thumbnail_url: string | null;
  external_link: string | null;
};

/**
 * Renders published portfolio items (quick visual proof — a screenshot, not
 * a full write-up) for an industry and/or a capability. Managed from
 * /admin > Work > Quick gallery items, alongside the full case studies at
 * /work — one "Work" section in the admin, two depths of content. Renders
 * nothing when there is nothing to show. Clicking an item opens a
 * full-screen viewer — full-page website screenshots scroll inside it at
 * readable width.
 */
export function PortfolioStrip({
  industry,
  capability,
  eyebrow = "Selected work",
  title = "Selected work",
  tone = "base",
}: {
  industry?: string;
  capability?: string;
  eyebrow?: string;
  title?: string;
  tone?: "base" | "raised";
}) {
  const params = new URLSearchParams();
  if (industry) params.set("industry", industry);
  if (capability) params.set("capability", capability);
  const query = useQuery({
    queryKey: ["public", "portfolio", industry ?? "", capability ?? ""],
    queryFn: ({ signal }) =>
      fetchPublicContent<{ items: PortfolioItem[] }>(
        `/api/public/portfolio?${params.toString()}`,
        signal,
      ),
  });
  const items = query.data?.items;
  const [openId, setOpenId] = useState<string | null>(null);
  const activeIndex = items?.findIndex((it) => it.id === openId) ?? -1;

  if (items?.length === 0) return null;

  return (
    <Section tone={tone}>
      <SectionHeader eyebrow={eyebrow} title={title} />
      {query.isPending ? (
        <div role="status" aria-busy="true">
          <span className="sr-only">Loading selected work</span>
          <div aria-hidden="true">
            <CaseStudySkeleton cardsOnly />
          </div>
        </div>
      ) : !items && query.isError ? (
        <div className="public-content-error mt-10">
          <p>Selected work couldn’t load just now.</p>
          <button type="button" className="route-retry-button" onClick={() => void query.refetch()}>
            Try again
          </button>
        </div>
      ) : (
        <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items?.map((it, i) => (
            <li key={it.id}>
              <Reveal delay={i * 35} className="h-full">
                <PortfolioCard item={it} onOpen={() => setOpenId(it.id)} />
              </Reveal>
            </li>
          ))}
        </ul>
      )}

      {items && activeIndex >= 0 ? (
        <PortfolioViewer
          items={items}
          index={activeIndex}
          onIndex={(n) => setOpenId(items[n]?.id ?? null)}
          onClose={() => setOpenId(null)}
        />
      ) : null}
    </Section>
  );
}

function PortfolioCard({ item, onOpen }: { item: PortfolioItem; onOpen: () => void }) {
  return (
    <button type="button" className="pf-card" onClick={onOpen} aria-haspopup="dialog">
      <span className="pf-card-frame">
        <span className="pf-card-chrome" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="pf-card-shot">
          {item.media_type === "video" ? (
            <video
              src={item.media_url}
              poster={item.thumbnail_url ?? undefined}
              muted
              playsInline
              preload="metadata"
            />
          ) : (
            <img
              src={item.media_url}
              alt={item.title}
              loading="lazy"
              decoding="async"
              width={1200}
              height={900}
            />
          )}
        </span>
        <span className="pf-card-cue" aria-hidden="true">
          {item.media_type === "video" ? "Play" : "View full page"}
          <ArrowUpRight />
        </span>
      </span>
      <span className="pf-card-meta">
        <span className="pf-card-title">{item.title}</span>
        {item.description ? <span className="pf-card-desc">{item.description}</span> : null}
      </span>
    </button>
  );
}

function PortfolioViewer({
  items,
  index,
  onIndex,
  onClose,
}: {
  items: PortfolioItem[];
  index: number;
  onIndex: (n: number) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const item = items[index]!;

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

  // Reset scroll to the top of the screenshot whenever the item changes.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [index]);

  function onKeyDown(e: React.KeyboardEvent<HTMLDialogElement>) {
    if (e.key === "ArrowRight" && index < items.length - 1) onIndex(index + 1);
    if (e.key === "ArrowLeft" && index > 0) onIndex(index - 1);
  }

  return (
    <dialog
      ref={ref}
      className="pf-viewer"
      aria-label={`${item.title} — full view`}
      onClose={onClose}
      onCancel={onClose}
      onKeyDown={onKeyDown}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="pf-viewer-shell">
        <header className="pf-viewer-bar">
          <span className="pf-viewer-chrome" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className="pf-viewer-title">{item.title}</span>
          <span className="pf-viewer-actions">
            {items.length > 1 ? (
              <span className="pf-viewer-count" aria-live="polite">
                {index + 1} / {items.length}
              </span>
            ) : null}
            {item.external_link ? (
              <a
                href={item.external_link}
                target="_blank"
                rel="noopener noreferrer"
                className="pf-viewer-visit"
              >
                Visit site <ArrowUpRight aria-hidden="true" />
              </a>
            ) : null}
            <button type="button" onClick={onClose} className="pf-viewer-close" aria-label="Close">
              <X aria-hidden="true" />
            </button>
          </span>
        </header>
        <div className="pf-viewer-scroll" ref={scrollRef}>
          {item.media_type === "video" ? (
            <video
              key={item.id}
              src={item.media_url}
              poster={item.thumbnail_url ?? undefined}
              controls
              autoPlay
              playsInline
              className="pf-viewer-video"
            />
          ) : (
            <img
              key={item.id}
              src={item.media_url}
              alt={item.title}
              className="pf-viewer-img"
              decoding="async"
            />
          )}
        </div>
        {items.length > 1 ? (
          <>
            <button
              type="button"
              className="pf-viewer-nav prev"
              disabled={index === 0}
              onClick={() => onIndex(index - 1)}
              aria-label="Previous project"
            >
              ‹
            </button>
            <button
              type="button"
              className="pf-viewer-nav next"
              disabled={index === items.length - 1}
              onClick={() => onIndex(index + 1)}
              aria-label="Next project"
            >
              ›
            </button>
          </>
        ) : null}
      </div>
    </dialog>
  );
}
