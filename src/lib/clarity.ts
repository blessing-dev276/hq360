const CLARITY_PROJECT_ID = "yinl6bjt49";

/** Injects the Microsoft Clarity tag. Client-only; call after analytics consent. */
export function loadClarity(): void {
  if (typeof window === "undefined") return;
  if (document.getElementById("ms-clarity")) return;

  const w = window as unknown as { clarity?: { (...args: unknown[]): void; q?: unknown[] } };
  w.clarity =
    w.clarity ||
    function (...args: unknown[]) {
      (w.clarity!.q = w.clarity!.q || []).push(args);
    };

  const script = document.createElement("script");
  script.id = "ms-clarity";
  script.async = true;
  script.src = `https://www.clarity.ms/tag/${CLARITY_PROJECT_ID}?ref=bwt`;
  document.head.appendChild(script);
}
