import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** In-place loading feedback that preserves space and respects reduced motion. */
export function GlassLoading({
  label = "Loading…",
  cards = false,
  progress,
}: {
  label?: string;
  cards?: boolean;
  progress?: { done: number; total: number } | undefined;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="relative overflow-hidden rounded-2xl border border-border/60 bg-background/60 p-5 shadow-sm backdrop-blur-xl"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-12 right-0 size-40 rounded-full bg-primary/5 blur-3xl"
      />
      <div className="relative flex items-center gap-3 text-sm font-medium">
        <Loader2 aria-hidden="true" className="size-4 motion-safe:animate-spin" />
        {label}
      </div>
      {progress && (
        <progress
          aria-label={label}
          value={progress.done}
          max={Math.max(1, progress.total)}
          className="mt-4 h-1.5 w-full accent-primary"
        />
      )}
      <div
        aria-hidden="true"
        className={cn("mt-5 grid gap-4 motion-safe:animate-pulse", cards && "sm:grid-cols-2")}
      >
        {Array.from({ length: cards ? 2 : 1 }, (_, index) => (
          <div
            key={index}
            className="space-y-3 rounded-xl border border-border/40 bg-background/40 p-4"
          >
            <div className="h-4 w-2/5 rounded bg-primary/10" />
            <div className="h-3 w-4/5 rounded bg-primary/5" />
            {cards && (
              <>
                <div className="h-3 w-3/5 rounded bg-primary/5" />
                <div className="h-14 rounded-lg bg-primary/5" />
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
