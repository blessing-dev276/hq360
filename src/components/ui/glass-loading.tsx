import { Loader2 } from "lucide-react";
import {
  LoadingRegion,
  SkeletonForm,
  SkeletonGrid,
  SkeletonList,
  SkeletonProfile,
  SkeletonStats,
  SkeletonTable,
  SkeletonText,
} from "@/components/ui/skeleton";

export type LoadingVariant = "text" | "cards" | "table" | "list" | "profile" | "form" | "stats";

/** In-place loading feedback for a panel: a short status line (with optional
 *  progress) above a shimmer skeleton shaped like the content that's coming.
 *  Built on the shared skeleton system; no backdrop blur (cheap to paint).
 *  `cards` is kept for existing callers and means `variant="cards"`. */
export function GlassLoading({
  label = "Loading…",
  cards = false,
  variant,
  rows,
  cols,
  progress,
}: {
  label?: string;
  cards?: boolean;
  variant?: LoadingVariant;
  rows?: number;
  cols?: number;
  progress?: { done: number; total: number } | undefined;
}) {
  const kind: LoadingVariant = variant ?? (cards ? "cards" : "text");
  return (
    <LoadingRegion label={label} delay={progress ? 0 : 140}>
      <div className="flex items-center gap-2.5 pb-4 text-sm text-muted-foreground">
        <Loader2 aria-hidden="true" className="size-4 text-brand motion-safe:animate-spin" />
        <span aria-hidden="true">{label}</span>
      </div>
      {progress && (
        <progress
          aria-label={label}
          value={progress.done}
          max={Math.max(1, progress.total)}
          className="mb-4 h-1.5 w-full accent-primary"
        />
      )}
      {kind === "cards" ? (
        <SkeletonGrid count={rows ?? 2} />
      ) : kind === "table" ? (
        <SkeletonTable rows={rows ?? 5} cols={cols ?? 4} />
      ) : kind === "list" ? (
        <SkeletonList rows={rows ?? 4} />
      ) : kind === "profile" ? (
        <SkeletonProfile />
      ) : kind === "form" ? (
        <SkeletonForm />
      ) : kind === "stats" ? (
        <SkeletonStats />
      ) : (
        <SkeletonText lines={rows ?? 3} />
      )}
    </LoadingRegion>
  );
}

/** Alias with a clearer name for new code. */
export { GlassLoading as LoadingPanel };
