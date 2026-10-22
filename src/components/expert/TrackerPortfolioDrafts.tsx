import { useCallback, useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { actorHeaders, setTrackerAdminMode } from "./tracker-actor";

type Entry = {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  video_url: string | null;
  status: "draft" | "pending" | "approved" | "rejected";
};

/** Portfolio entries made from client trackers (with client consent). Drafts
 *  go live with one click, or straight away when auto publish is on. */
export function TrackerPortfolioDrafts({ admin = false }: { admin?: boolean }) {
  setTrackerAdminMode(admin);
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [autoPublish, setAutoPublish] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/expert/tracker-portfolio", { headers: actorHeaders() });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return setError(data.error || "Could not load entries.");
    setEntries(data.items);
    setAutoPublish(Boolean(data.autoPublish));
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function post(body: Record<string, unknown>) {
    setError("");
    const response = await fetch("/api/expert/tracker-portfolio", {
      method: "POST",
      headers: actorHeaders({ "content-type": "application/json" }),
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) setError(data.error || "Could not save.");
    await load();
  }

  if (entries === null && !error) return null;
  return (
    <section className="admin-content-panel" style={{ marginTop: "1.5rem" }}>
      <div className="admin-panel-heading" style={{ padding: "0 0 1rem" }}>
        <div>
          <h2>{admin ? "Portfolio entries from client trackers" : "From your client trackers"}</h2>
          <p>
            Completed items you marked Portfolio ready, from clients who agreed to portfolio use. Withdrawn consent
            removes an entry at once.
          </p>
        </div>
        {!admin && (<label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
          <input type="checkbox" checked={autoPublish} onChange={(e) => void post({ action: "autoPublish", value: e.target.checked })} />
          Auto publish new entries
        </label>)}
      </div>
      {error && (
        <div className="admin-alert" role="alert">
          <AlertCircle size={18} /> {error}
        </div>
      )}
      {entries?.length ? (
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 12 }}>
          {entries.map((entry) => (
            <li key={entry.id} style={{ border: "1px solid var(--admin-line, #ddd)", borderRadius: 12, padding: 12 }}>
              <b>{entry.title}</b> <small>{entry.status === "draft" ? "Draft" : entry.status === "approved" ? "Live on your profile" : entry.status}</small>
              <p style={{ whiteSpace: "pre-line" }}>{entry.description}</p>
              {entry.status === "draft" && (
                <button type="button" className="admin-button admin-button-primary" onClick={() => void post({ action: "approve", id: entry.id })}>
                  Approve and publish
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p>None yet.</p>
      )}
    </section>
  );
}
