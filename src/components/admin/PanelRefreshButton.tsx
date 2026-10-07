import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";

/** Re-fetches all panel data in place: clears cached queries and remounts the page content. */
export function PanelRefreshButton({ onRefresh }: { onRefresh: () => void }) {
  const queryClient = useQueryClient();
  const [spinning, setSpinning] = useState(false);
  return (
    <button
      type="button"
      className="panel-theme-toggle"
      aria-label="Refresh data"
      title="Refresh data"
      disabled={spinning}
      onClick={async () => {
        setSpinning(true);
        onRefresh();
        await queryClient.invalidateQueries();
        window.setTimeout(() => setSpinning(false), 600);
      }}
    >
      <RefreshCw size={16} aria-hidden="true" className={spinning ? "animate-spin" : ""} />
    </button>
  );
}
