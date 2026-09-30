import { useCallback, useEffect, useState } from "react";
import { AlertCircle, ArrowUpRight, CircleCheck, RefreshCw, UserCheck, UserX } from "lucide-react";

type Expert = {
  id: string;
  email: string;
  full_name: string | null;
  headline: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  reviewed_at: string | null;
  slug: string | null;
  is_public: boolean | null;
};

export function ExpertsAdmin() {
  const [experts, setExperts] = useState<Expert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/experts");
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not load experts.");
      setExperts(data.experts ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load experts.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function act(expert: Expert, action: "approve" | "reject") {
    setBusy(expert.id + action);
    setError("");
    try {
      const response = await fetch(`/api/admin/experts/${expert.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not update expert.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update expert.");
    } finally {
      setBusy("");
    }
  }

  const pending = experts.filter((e) => e.status === "pending");
  const resolved = experts.filter((e) => e.status !== "pending");

  return (
    <section className="admin-panel">
      {error && (
        <div className="admin-alert" role="alert">
          <AlertCircle size={18} />
          {error}
        </div>
      )}
      <div className="admin-panel-heading">
        <div>
          <h2>
            Pending requests <span className="admin-count">{pending.length}</span>
          </h2>
          <p>Approve to grant access to Author Reports and Scout.</p>
        </div>
        <button
          className="admin-icon-button"
          aria-label="Refresh experts"
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
        </button>
      </div>
      {loading ? (
        <div className="admin-empty" role="status">
          Loading experts…
        </div>
      ) : error ? (
        <div className="admin-empty">
          <h3>Experts couldn’t be loaded</h3>
          <p>Fix the issue above, then refresh.</p>
        </div>
      ) : pending.length === 0 ? (
        <div className="admin-empty">
          <h3>No pending requests</h3>
          <p>New expert signups will show up here for approval.</p>
        </div>
      ) : (
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name / Email</th>
                <th>Requested</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {pending.map((e) => (
                <tr key={e.id}>
                  <td>
                    <span className="admin-invoice-name">{e.full_name || "Unnamed"}</span>
                    <small>{e.email}</small>
                    {e.headline && <small>{e.headline}</small>}
                  </td>
                  <td>{new Date(e.created_at).toLocaleDateString("en-GB")}</td>
                  <td>
                    <div className="admin-button-row">
                      <button
                        className="admin-button admin-button-primary"
                        disabled={!!busy}
                        onClick={() => void act(e, "approve")}
                      >
                        <UserCheck size={15} />
                        {busy === e.id + "approve" ? "Approving…" : "Approve"}
                      </button>
                      <button
                        className="admin-button text-destructive"
                        disabled={!!busy}
                        onClick={() => void act(e, "reject")}
                      >
                        <UserX size={15} />
                        {busy === e.id + "reject" ? "Rejecting…" : "Reject"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!loading && resolved.length > 0 && (
        <>
          <div className="admin-panel-heading">
            <div>
              <h2>Reviewed</h2>
              <p>Approved experts can publish a public profile from their dashboard.</p>
            </div>
          </div>
          <div className="admin-table-scroll">
            <table className="admin-table">
              <tbody>
                {resolved.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <span className="admin-invoice-name">{e.full_name || "Unnamed"}</span>
                      <small>{e.email}</small>
                    </td>
                    <td>
                      <span
                        className={`admin-status ${e.status === "approved" ? "paid" : "overdue"}`}
                      >
                        {e.status === "approved" ? (
                          <>
                            <CircleCheck size={12} /> Approved
                          </>
                        ) : (
                          "Rejected"
                        )}
                      </span>
                    </td>
                    <td>
                      {e.status === "approved" && e.is_public && e.slug ? (
                        <a
                          className="admin-text-button"
                          href={`/experts/${e.slug}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Public profile <ArrowUpRight size={14} />
                        </a>
                      ) : (
                        <span className="admin-delivery">
                          {e.status === "approved" ? "Profile not published" : "—"}
                        </span>
                      )}
                    </td>
                    <td>
                      <button
                        className={`admin-button ${e.status === "approved" ? "text-destructive" : ""}`}
                        disabled={!!busy}
                        onClick={() => void act(e, e.status === "approved" ? "reject" : "approve")}
                      >
                        {e.status === "approved"
                          ? busy === e.id + "reject"
                            ? "Revoking…"
                            : "Revoke access"
                          : busy === e.id + "approve"
                            ? "Approving…"
                            : "Approve"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
