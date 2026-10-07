import type React from "react";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import "./skeleton.css";

// HQ360 skeleton system. Every loading placeholder on the site is built from
// <Skeleton>, so there is one shimmer implementation (skeleton.css). The
// composed pieces below mirror real layouts (stat tiles, tables, cards,
// profiles, forms) so content lands without shifting.

type Size = number | string;
const px = (value: Size | undefined) => (typeof value === "number" ? `${value}px` : value);

export function Skeleton({
  width,
  height = 12,
  radius,
  variant = "rect",
  shimmer = true,
  speed,
  className,
  style,
  ...rest
}: Omit<React.HTMLAttributes<HTMLSpanElement>, "style"> & {
  width?: Size;
  height?: Size;
  radius?: Size;
  variant?: "rect" | "circle" | "pill";
  shimmer?: boolean;
  /** Seconds per sweep (default 1.6). */
  speed?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      {...rest}
      aria-hidden="true"
      className={cn(
        "hq-skel",
        variant === "circle" && "is-circle",
        variant === "pill" && "is-pill",
        !shimmer && "no-shimmer",
        className,
      )}
      style={{
        width: px(width ?? (variant === "circle" ? height : "100%")),
        height: px(height),
        ...(radius !== undefined ? { borderRadius: px(radius) } : {}),
        ...(speed ? ({ "--hq-skel-speed": `${speed}s` } as CSSProperties) : {}),
        ...style,
      }}
    />
  );
}

/** Lines of text; the last line is shorter, like a real paragraph. */
export function SkeletonText({
  lines = 3,
  lineHeight = 12,
  lastWidth = "62%",
}: {
  lines?: number;
  lineHeight?: number;
  lastWidth?: string;
}) {
  return (
    <span className="hq-skel-stack" aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          height={lineHeight}
          width={i === lines - 1 && lines > 1 ? lastWidth : "100%"}
        />
      ))}
    </span>
  );
}

export function SkeletonAvatar({ size = 40 }: { size?: number }) {
  return <Skeleton variant="circle" height={size} />;
}

/** Matches .admin-stat tiles: label, big number, caption. */
export function SkeletonStat() {
  return (
    <div className="admin-stat" aria-hidden="true">
      <Skeleton width="45%" height={11} />
      <Skeleton width="55%" height={30} style={{ margin: "18px 0 10px" }} />
      <Skeleton width="70%" height={10} />
    </div>
  );
}

export function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <div className={cn("admin-stats", count === 4 && "admin-stats-4")} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonStat key={i} />
      ))}
    </div>
  );
}

/** Generic content card: optional media, title, text and tag row. */
export function SkeletonCard({ media = false, lines = 2 }: { media?: boolean; lines?: number }) {
  return (
    <div className="hq-skel-card" aria-hidden="true">
      {media && <Skeleton height={150} radius={12} />}
      <Skeleton width="60%" height={16} />
      <SkeletonText lines={lines} />
      <span className="hq-skel-row">
        <Skeleton variant="pill" width={72} height={22} />
        <Skeleton variant="pill" width={56} height={22} />
      </span>
    </div>
  );
}

export function SkeletonGrid({
  count = 4,
  min = "16rem",
  children,
}: {
  count?: number;
  min?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className="hq-skel-grid"
      aria-hidden="true"
      style={{ "--hq-skel-min": min } as CSSProperties}
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>{children ?? <SkeletonCard />}</div>
      ))}
    </div>
  );
}

/** Table: header row plus body rows; the first column carries a sub-line. */
export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  const template = `2fr ${"1fr ".repeat(Math.max(0, cols - 1))}`.trim();
  return (
    <div
      className="hq-skel-table"
      aria-hidden="true"
      style={{ "--hq-skel-cols": template } as CSSProperties}
    >
      {Array.from({ length: rows + 1 }, (_, r) => (
        <div key={r}>
          {Array.from({ length: cols }, (_, c) =>
            r === 0 ? (
              <Skeleton key={c} width={c === 0 ? "40%" : "60%"} height={9} />
            ) : c === 0 ? (
              <span key={c} className="hq-skel-stack" style={{ gap: 6 }}>
                <Skeleton width="70%" height={12} />
                <Skeleton width="45%" height={9} />
              </span>
            ) : (
              <Skeleton key={c} width={c === cols - 1 ? "55%" : "75%"} height={12} />
            ),
          )}
        </div>
      ))}
    </div>
  );
}

/** List of rows with an avatar, two lines and an action, e.g. review queues. */
export function SkeletonList({ rows = 4, avatar = true }: { rows?: number; avatar?: boolean }) {
  return (
    <div className="hq-skel-stack" style={{ gap: 0 }} aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="hq-skel-row"
          style={{ padding: "14px 0", borderBottom: "1px solid var(--border, transparent)" }}
        >
          {avatar && <SkeletonAvatar size={36} />}
          <span className="hq-skel-stack" style={{ flex: 1, gap: 6 }}>
            <Skeleton width="38%" height={12} />
            <Skeleton width="62%" height={9} />
          </span>
          <Skeleton variant="pill" width={84} height={30} />
        </div>
      ))}
    </div>
  );
}

/** Labelled inputs in a two-column grid, then a button. */
export function SkeletonForm({ fields = 4 }: { fields?: number }) {
  return (
    <div className="hq-skel-stack" style={{ gap: 18 }} aria-hidden="true">
      <div
        style={{
          display: "grid",
          gap: 18,
          gridTemplateColumns: "repeat(auto-fit, minmax(14rem, 1fr))",
        }}
      >
        {Array.from({ length: fields }, (_, i) => (
          <span key={i} className="hq-skel-stack" style={{ gap: 8 }}>
            <Skeleton width="35%" height={10} />
            <Skeleton height={42} radius={12} />
          </span>
        ))}
      </div>
      <Skeleton height={96} radius={12} />
      <Skeleton variant="pill" width={150} height={40} />
    </div>
  );
}

/** Profile header: avatar, name, headline, tags. */
export function SkeletonProfile() {
  return (
    <div className="hq-skel-card" aria-hidden="true">
      <span className="hq-skel-row">
        <SkeletonAvatar size={72} />
        <span className="hq-skel-stack" style={{ flex: 1 }}>
          <Skeleton width="45%" height={18} />
          <Skeleton width="65%" height={12} />
        </span>
      </span>
      <SkeletonText lines={3} />
      <span className="hq-skel-row">
        <Skeleton variant="pill" width={80} height={24} />
        <Skeleton variant="pill" width={64} height={24} />
        <Skeleton variant="pill" width={92} height={24} />
      </span>
    </div>
  );
}

/** True only after `delay` ms, so near-instant loads don't flash a skeleton. */
export function useDelayed(active: boolean, delay = 140) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!active) {
      setShown(false);
      return;
    }
    const id = window.setTimeout(() => setShown(true), delay);
    return () => window.clearTimeout(id);
  }, [active, delay]);
  return shown;
}

/** Accessible wrapper: announces one polite "loading" message while the
 *  visual skeleton stays hidden from assistive tech. Holds the space from the
 *  first render (no collapse), but only paints the shimmer after a short
 *  delay so fast responses don't flash. */
export function LoadingRegion({
  label,
  children,
  delay = 140,
  className,
}: {
  label: string;
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const shown = useDelayed(true, delay);
  return (
    <div role="status" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      <div style={shown ? undefined : { visibility: "hidden" }}>{children}</div>
    </div>
  );
}
