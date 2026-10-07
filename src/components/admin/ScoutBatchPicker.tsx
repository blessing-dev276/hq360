import { useMemo, useState } from "react";
import { BookOpen, Check, Search } from "lucide-react";
import { ARC_SOURCES } from "@/lib/scout/arc-sources";
import { cn } from "@/lib/utils";

export type PickerBatch = {
  id: string;
  label: string;
  created_at: string;
  sources: string[];
  genre: string | null;
  item_count: number;
};

const SOURCES: { key: string; name: string }[] = [
  { key: "reedsy_discovery", name: "Reedsy Discovery" },
  { key: "readers_favorite", name: "Readers’ Favorite" },
  ...Object.entries(ARC_SOURCES).map(([key, spec]) => ({ key, name: spec.name })),
];
const sourceName = (key: string | undefined) =>
  SOURCES.find((s) => s.key === key)?.name ?? "Manual";

/** The batch's subject: its genre, or its label minus the leading source. */
function batchTitle(batch: PickerBatch) {
  if (batch.genre?.trim()) return batch.genre.trim();
  const parts = batch.label.split(" · ");
  return (parts.length > 1 ? parts.slice(1).join(" · ") : batch.label).trim();
}

function ago(value: string) {
  const seconds = (Date.now() - new Date(value).getTime()) / 1000;
  if (!Number.isFinite(seconds)) return "";
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))} min ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} h ago`;
  if (seconds < 86400 * 7) return `${Math.round(seconds / 86400)} d ago`;
  return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

const INITIAL = 9;

/** Card grid for choosing a saved Scout batch: source tabs with counts, a
 *  search, and one card per batch (source, subject, size, recency). */
export function ScoutBatchPicker({
  batches,
  source,
  onSourceChange,
  selectedId,
  onSelect,
  disabled,
  lockArcSources,
}: {
  batches: PickerBatch[];
  source: string;
  onSourceChange: (source: string) => void;
  selectedId: string | null;
  onSelect: (batch: PickerBatch) => void;
  disabled?: boolean;
  /** ARC sources can't be opened while a search is running. */
  lockArcSources?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const withItems = useMemo(() => batches.filter((b) => b.item_count > 0), [batches]);
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of withItems) for (const s of b.sources) map.set(s, (map.get(s) ?? 0) + 1);
    return map;
  }, [withItems]);
  const tabs = [
    { key: "all", name: "All", count: withItems.length },
    ...SOURCES.filter((s) => counts.get(s.key)).map((s) => ({ ...s, count: counts.get(s.key)! })),
  ];
  const q = query.trim().toLowerCase();
  const matching = withItems.filter(
    (b) =>
      (source === "all" || b.sources.includes(source)) &&
      (!q || `${b.label} ${b.genre ?? ""}`.toLowerCase().includes(q)),
  );
  const shown = showAll || q ? matching : matching.slice(0, INITIAL);

  return (
    <div className="scout-picker">
      <div className="scout-picker-bar">
        <div className="scout-picker-tabs" role="tablist" aria-label="Filter batches by source">
          {tabs.map((tab) => {
            const locked = lockArcSources && tab.key in ARC_SOURCES;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={source === tab.key}
                className={cn("scout-picker-tab", source === tab.key && "active")}
                disabled={disabled || locked}
                onClick={() => {
                  onSourceChange(tab.key);
                  setShowAll(false);
                }}
              >
                {tab.name}
                <span>{tab.count}</span>
              </button>
            );
          })}
        </div>
        <label className="scout-picker-search">
          <Search size={15} aria-hidden="true" />
          <input
            type="search"
            aria-label="Search batches"
            placeholder="Search genre or search…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>

      {matching.length === 0 ? (
        <div className="scout-picker-empty">
          <BookOpen size={20} aria-hidden="true" />
          <p>
            {withItems.length === 0
              ? "No saved batches yet. Run a search above and it will appear here."
              : q
                ? `No batches match “${query}”.`
                : "No batches from this source yet."}
          </p>
        </div>
      ) : (
        <>
          <ul className="scout-picker-grid" aria-label="Saved batches">
            {shown.map((batch) => {
              const active = batch.id === selectedId;
              const key = batch.sources[0];
              return (
                <li key={batch.id}>
                  <button
                    type="button"
                    className={cn("scout-batch-card", active && "active")}
                    aria-pressed={active}
                    disabled={disabled}
                    onClick={() => onSelect(batch)}
                  >
                    <span className="scout-batch-top">
                      <span className={`scout-batch-source src-${key ?? "manual"}`}>
                        {sourceName(key)}
                      </span>
                      {active && (
                        <span className="scout-batch-open">
                          <Check size={13} aria-hidden="true" /> Open
                        </span>
                      )}
                    </span>
                    <strong title={batch.label}>{batchTitle(batch)}</strong>
                    <span className="scout-batch-meta">
                      <span className="scout-batch-count">
                        <b>{batch.item_count}</b> {batch.item_count === 1 ? "book" : "books"}
                      </span>
                      <time
                        dateTime={batch.created_at}
                        title={new Date(batch.created_at).toLocaleString()}
                      >
                        {ago(batch.created_at)}
                      </time>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {!showAll && !q && matching.length > INITIAL && (
            <button type="button" className="scout-picker-more" onClick={() => setShowAll(true)}>
              Show all {matching.length} batches
            </button>
          )}
        </>
      )}
    </div>
  );
}
