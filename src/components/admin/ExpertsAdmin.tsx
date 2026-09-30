import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CircleCheck, UserCheck, UserX } from "lucide-react";

type Expert = {
  id: string;
  email: string;
  full_name: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  reviewed_at: string | null;
};

export function ExpertsAdmin() {
  const [experts, setExperts] = useState<Expert[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/admin/experts");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setExperts(data.experts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load experts.");
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
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update expert.");
    } finally {
      setBusy("");
    }
  }

  const pending = experts?.filter((e) => e.status === "pending") ?? [];
  const resolved = experts?.filter((e) => e.status !== "pending") ?? [];

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
      </div>
      {experts === null ? (
        <div className="admin-empty" role="status">
          Loading experts…
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
      {resolved.length > 0 && (
        <>
          <div className="admin-panel-heading">
            <div>
              <h2>Reviewed</h2>
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
