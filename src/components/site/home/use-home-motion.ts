import { useEffect, useRef } from "react";

/** One observer per homepage; text stays visible in SSR and without JavaScript. */
export function useHomeMotion() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root || !window.IntersectionObserver) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sections = root.querySelectorAll<HTMLElement>("[data-ambient]");
    const reveals = root.querySelectorAll<HTMLElement>("[data-home-reveal]");
    const visible = new Set<Element>();
    const sync = () => {
      sections.forEach((el) => {
        el.dataset.running = String(visible.has(el) && !document.hidden && !media.matches);
      });
      if (media.matches) reveals.forEach((el) => el.classList.remove("reveal-pending"));
    };
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.target.hasAttribute("data-ambient")) {
            if (entry.isIntersecting) visible.add(entry.target);
            else visible.delete(entry.target);
          }
          if (entry.isIntersecting && entry.target.hasAttribute("data-home-reveal")) {
            entry.target.classList.remove("reveal-pending");
            if (!entry.target.hasAttribute("data-ambient")) observer.unobserve(entry.target);
          }
        }
        sync();
      },
      { threshold: 0.08 },
    );
    sections.forEach((el) => observer.observe(el));
    reveals.forEach((el) => {
      if (!media.matches && el.getBoundingClientRect().top > window.innerHeight)
        el.classList.add("reveal-pending");
      observer.observe(el);
    });
    document.addEventListener("visibilitychange", sync);
    media.addEventListener("change", sync);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
      media.removeEventListener("change", sync);
    };
  }, []);
  return ref;
}
