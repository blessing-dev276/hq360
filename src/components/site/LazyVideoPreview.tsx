import "@/components/ui/skeleton/skeleton.css";
import { useEffect, useRef, useState } from "react";

/** Muted first-frame preview for a video card. The <video> (which fetches
 *  the start of the file even with preload="metadata") is only created once
 *  the card is near the viewport; until then a poster image or a neutral
 *  block holds the same space. */
export function LazyVideoPreview({ src, poster }: { src: string; poster?: string | null }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    if (!("IntersectionObserver" in window)) {
      setNear(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [near]);
  return (
    <span ref={ref} style={{ display: "contents" }}>
      {near ? (
        <video
          src={src}
          poster={poster ?? undefined}
          controlsList="nodownload"
          onContextMenu={(event) => event.preventDefault()}
          muted
          playsInline
          preload="metadata"
        />
      ) : poster ? (
        <img src={poster} alt="" loading="lazy" decoding="async" />
      ) : (
        <span
          aria-hidden="true"
          className="hq-skel no-shimmer"
          style={{ width: "100%", height: "100%" }}
        />
      )}
    </span>
  );
}
