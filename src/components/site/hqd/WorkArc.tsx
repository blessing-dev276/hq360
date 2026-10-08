import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchPublicContent } from "@/lib/public-content";
import { toCaseStudyShape, type SerializedCaseStudy } from "@/lib/case-study-view";
import { CASE_STUDIES, type CaseStudy } from "@/data/work";
import { useExpertProof } from "@/lib/expert-proof";
import { expertProof, buildAgencyProof, type PortfolioProof } from "@/lib/agency-work";

/**
 * A concave, auto-drifting arc of project images. Positions are written straight
 * to the DOM each frame (no React re-render); drag to scrub, hover to pause.
 */
export function WorkArc() {
  const portfolio = useQuery({
    queryKey: ["agency", "portfolio"],
    queryFn: ({ signal }) =>
      fetchPublicContent<{ items: PortfolioProof[] }>("/api/public/portfolio", signal),
  });
  const cases = useQuery({
    queryKey: ["public", "case-studies"],
    queryFn: ({ signal }) =>
      fetchPublicContent<{ items: SerializedCaseStudy[] }>("/api/public/case-studies", signal),
  });
  const studies =
    cases.data?.items.map((item) => toCaseStudyShape(item) as CaseStudy) ?? CASE_STUDIES;
  // Work HQ360 experts added (approved), credited to them.
  const experts = useExpertProof();
  const withImages = [
    ...buildAgencyProof(portfolio.data?.items ?? [], studies),
    ...expertProof(experts.data?.portfolio ?? []),
  ].filter((item) => item.image);
  // Show each actual project once, including when the collection is small.
  const cards = withImages;

  const stageRef = useRef<HTMLDivElement>(null);
  const count = cards.length;

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !count) return;
    const items = Array.from(stage.querySelectorAll<HTMLElement>(".hqd-arc-card"));
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let pos = 0;
    let last = performance.now();
    let raf = 0;
    let hovering = false;
    let dragging: { x: number; pos: number } | null = null;
    let onScreen = true;

    const layout = () => {
      const width = items[0]?.offsetWidth ?? 200;
      const spacing = width * 1.04;
      for (let i = 0; i < items.length; i++) {
        let d = (((i - pos) % count) + count) % count;
        if (d > count / 2) d -= count;
        const abs = Math.abs(d);
        const x = d * spacing;
        const z = Math.pow(abs, 1.5) * 16;
        const rotate = -d * 7.5;
        const el = items[i]!;
        el.style.transform = `translate(-50%, -50%) translate3d(${x.toFixed(1)}px, 0, ${z.toFixed(1)}px) rotateY(${rotate.toFixed(2)}deg)`;
        el.style.opacity = abs > 4.8 ? "0" : "1";
        el.style.zIndex = String(100 + Math.round(abs * 10));
      }
    };

    const tick = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      if (count > 5 && !reduced && !hovering && !dragging) pos += dt * 0.00028;
      layout();
      raf = onScreen ? requestAnimationFrame(tick) : 0;
    };

    const observer = new IntersectionObserver(([entry]) => {
      onScreen = Boolean(entry?.isIntersecting);
      if (onScreen && !raf) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    });
    observer.observe(stage);

    const spacing = () => (items[0]?.offsetWidth ?? 200) * 1.04;
    const down = (e: PointerEvent) => {
      dragging = { x: e.clientX, pos };
      stage.setAttribute("data-dragging", "");
      stage.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      pos = dragging.pos - (e.clientX - dragging.x) / spacing();
      if (reduced) layout();
    };
    const up = () => {
      dragging = null;
      stage.removeAttribute("data-dragging");
    };
    const enter = () => (hovering = true);
    const leave = () => (hovering = false);
    stage.addEventListener("pointerdown", down);
    stage.addEventListener("pointermove", move);
    stage.addEventListener("pointerup", up);
    stage.addEventListener("pointercancel", up);
    stage.addEventListener("pointerenter", enter);
    stage.addEventListener("pointerleave", leave);
    layout();
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      stage.removeEventListener("pointerdown", down);
      stage.removeEventListener("pointermove", move);
      stage.removeEventListener("pointerup", up);
      stage.removeEventListener("pointercancel", up);
      stage.removeEventListener("pointerenter", enter);
      stage.removeEventListener("pointerleave", leave);
    };
  }, [count]);

  if (!count) return <div className="hqd-arc" aria-hidden="true" />;

  return (
    <div
      ref={stageRef}
      className="hqd-arc"
      role="region"
      aria-roledescription="carousel"
      aria-label="Selected project images. Drag to explore."
    >
      {cards.map((item, i) => (
        <figure
          key={`${item.id}-${i}`}
          className="hqd-arc-card"
          aria-hidden={i >= withImages.length}
        >
          <img
            src={item.image}
            alt={i < withImages.length ? item.title : ""}
            loading="lazy"
            draggable={false}
          />
          <figcaption>{item.title}</figcaption>
        </figure>
      ))}
    </div>
  );
}
