import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * The HQ360 orbit motif: concentric rings, orbiting nodes and a central spark.
 * Abstract brand geometry — used as a hero graphic, section backdrop and
 * capability marker. Colour follows `currentColor`; the accent is the brand
 * orange. Motion is CSS-driven and disabled under prefers-reduced-motion.
 */
export function OrbitGraphic({
  className,
  animate = true,
  label,
}: {
  className?: string;
  animate?: boolean;
  label?: string;
}) {
  const accentId = useId();
  const accent = `url(#${accentId})`;
  return (
    <svg
      viewBox="0 0 200 200"
      className={cn("hq-orbit-graphic h-full w-full", className)}
      role={label ? "img" : "presentation"}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <defs>
        <linearGradient id={accentId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--brand)" />
          <stop offset="100%" stopColor="var(--brand-strong)" />
        </linearGradient>
      </defs>

      {/* Outer dashed ring */}
      <g className={cn(animate && "hq-spin-slower")} style={{ transformOrigin: "100px 100px" }}>
        <circle
          cx="100"
          cy="100"
          r="92"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.16"
          strokeWidth="1.5"
          strokeDasharray="2 8"
          strokeLinecap="round"
        />
        <circle cx="100" cy="8" r="3" fill={accent} />
      </g>

      {/* Mid ring with an accent arc + orbiting node */}
      <g className={cn(animate && "hq-spin-slow")} style={{ transformOrigin: "100px 100px" }}>
        <circle
          cx="100"
          cy="100"
          r="66"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.22"
          strokeWidth="1.5"
        />
        <path
          d="M100 34 A66 66 0 0 1 158 74"
          fill="none"
          stroke={accent}
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx="100" cy="34" r="4.5" fill={accent} />
      </g>

      {/* Inner ring */}
      <g className={cn(animate && "hq-spin-slower")} style={{ transformOrigin: "100px 100px" }}>
        <circle
          cx="100"
          cy="100"
          r="40"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.28"
          strokeWidth="1.5"
        />
        <circle cx="140" cy="100" r="3.5" fill="currentColor" fillOpacity="0.55" />
      </g>

      {/* Central spark / asterisk */}
      <g stroke={accent} strokeWidth="4" strokeLinecap="round">
        <line x1="100" y1="86" x2="100" y2="114" />
        <line x1="87.9" y1="93" x2="112.1" y2="107" />
        <line x1="87.9" y1="107" x2="112.1" y2="93" />
      </g>
    </svg>
  );
}
