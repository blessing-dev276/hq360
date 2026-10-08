import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type SalesView = "proposals" | "quotes" | "invoices";
const VIEWS: { id: SalesView; label: string; hint: string }[] = [
  { id: "proposals", label: "Proposals", hint: "Pitch the work" },
  { id: "quotes", label: "Quotes", hint: "Price it" },
  { id: "invoices", label: "Invoices", hint: "Get paid" },
];

/** One Sales tool: proposal → quote → invoice, in the order a deal moves. */
export function SalesTabs({
  view,
  onSelect,
  children,
}: {
  view: SalesView;
  onSelect: (view: SalesView) => void;
  children: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div
        role="tablist"
        aria-label="Sales"
        className="grid grid-cols-3 gap-1 rounded-2xl border border-border bg-card/60 p-1 sm:inline-grid"
      >
        {VIEWS.map((v, i) => (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={view === v.id}
            onClick={() => onSelect(v.id)}
            className={cn(
              "rounded-xl px-4 py-2.5 text-left transition sm:min-w-40",
              view === v.id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            <span className="block text-sm font-semibold">
              <span className="mr-1.5 opacity-60">{i + 1}</span>
              {v.label}
            </span>
            <span className="hidden text-xs opacity-75 sm:block">{v.hint}</span>
          </button>
        ))}
      </div>
      <div role="tabpanel">{children}</div>
    </div>
  );
}
