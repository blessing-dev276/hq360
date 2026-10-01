import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  CircleCheck,
  Globe,
  Linkedin,
  Link2,
  MapPin,
  RefreshCw,
  Trash2,
  UserCheck,
  UserX,
} from "lucide-react";
import { getCoreService, getAudience } from "@/data/agency";

type ProfileStatus = "draft" | "submitted" | "approved" | "changes_requested";

type Expert = {
  id: string;
  email: string;
  full_name: string | null;
  headline: string | null;
  bio: string | null;
  photo_url: string | null;
  specialties: string[] | null;
  location: string | null;
  website_url: string | null;
  linkedin_url: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  reviewed_at: string | null;
  slug: string | null;
  is_public: boolean | null;
  profile_status: ProfileStatus;
  profile_submitted_at: string | null;
  profile_review_note: string | null;
  claimed_team_member_id: string | null;
};

type TeamMember = { id: string; name: string; title: string; claimed_by_expert_id: string | null };

type PortfolioItem = {
  id: string;
  expert_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  external_link: string | null;
  service_slugs: string[];
  audience_slugs: string[];
  status: "pending" | "approved" | "rejected";
  expert_profiles: { full_name: string | null; email: string; slug: string | null } | null;
};

function ProfilePreview({ expert }: { expert: Expert }) {
  return (
    <div
      style={{
        display: "grid",
        gap: "0.6rem",
        padding: "1rem 1.25rem",
        background: "var(--card-2)",
        borderRadius: 10,
        fontSize: 12,
      }}
    >
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
        {expert.photo_url ? (
          <img
            src={expert.photo_url}
            alt=""
            style={{ width: 48, height: 48, borderRadius: 12, objectFit: "cover" }}
          />
        ) : null}
        <div>
          <strong className="admin-invoice-name">{expert.full_name || "Unnamed"}</strong>
          <p style={{ color: "var(--muted-foreground)" }}>{expert.headline || "No headline yet"}</p>
        </div>
      </div>
      {expert.bio && <p style={{ color: "var(--muted-foreground)" }}>{expert.bio}</p>}
      {expert.specialties && expert.specialties.length > 0 && (
        <p>
          <strong>Specialties: </strong>
          {expert.specialties.join(", ")}
        </p>
      )}
      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          flexWrap: "wrap",
          color: "var(--muted-foreground)",
        }}
      >
        {expert.location && (
          <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
            <MapPin size={12} /> {expert.location}
          </span>
        )}
        {expert.website_url && (
          <a
            href={expert.website_url}
            target="_blank"
            rel="noreferrer"
            style={{ display: "inline-flex", gap: 4, alignItems: "center" }}
          >
            <Globe size={12} /> Website
          </a>
        )}
        {expert.linkedin_url && (
          <a
            href={expert.linkedin_url}
            target="_blank"
            rel="noreferrer"
            style={{ display: "inline-flex", gap: 4, alignItems: "center" }}
          >
            <Linkedin size={12} /> LinkedIn
          </a>
        )}
      </div>
    </div>
  );
}

export function ExpertsAdmin() {
  const [experts, setExperts] = useState<Expert[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [claimPick, setClaimPick] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [expertsRes, teamRes, portfolioRes] = await Promise.all([
        fetch("/api/admin/experts"),
        fetch("/api/admin/team"),
        fetch("/api/admin/expert-portfolio"),
      ]);
      const expertsData = await expertsRes.json().catch(() => ({}));
      if (!expertsRes.ok) throw new Error(expertsData.error || "Could not load experts.");
      setExperts(expertsData.experts ?? []);
      const teamData = await teamRes.json().catch(() => ({}));
      if (teamRes.ok) setTeam(teamData.members ?? []);
      const portfolioData = await portfolioRes.json().catch(() => ({}));
      if (portfolioRes.ok) setPortfolioItems(portfolioData.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load experts.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function act(
    expert: Expert,
    action: "approve" | "reject" | "delete" | "publish" | "unpublish" | "request_changes" | "claim",
    extra?: Record<string, unknown>,
  ) {
    setBusy(expert.id + action);
    setError("");
    try {
      const response = await fetch(`/api/admin/experts/${expert.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
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

  function remove(expert: Expert) {
    if (
      !window.confirm(
        `Permanently delete ${expert.full_name || expert.email}? This deletes their login and expert profile for good — it cannot be undone.`,
      )
    )
      return;
    void act(expert, "delete");
  }

  function requestChanges(expert: Expert) {
    const note = window.prompt("What should they change? (shown to the expert)") ?? "";
    void act(expert, "request_changes", { note });
  }

  async function portfolioAct(item: PortfolioItem, action: "approve" | "reject" | "delete") {
    setBusy(item.id + action);
    setError("");
    try {
      const response = await fetch(`/api/admin/expert-portfolio/${item.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not update this item.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update this item.");
    } finally {
      setBusy("");
    }
  }

  const pending = experts.filter((e) => e.status === "pending");
  const resolved = experts.filter((e) => e.status !== "pending");
  const unclaimedTeam = team.filter((m) => !m.claimed_by_expert_id);
  const pendingPortfolio = portfolioItems.filter((i) => i.status === "pending");
  const reviewedPortfolio = portfolioItems.filter((i) => i.status !== "pending");

  function ClaimControls({ expert }: { expert: Expert }) {
    if (expert.claimed_team_member_id || unclaimedTeam.length === 0) return null;
    return (
      <div className="admin-button-row" style={{ marginTop: "0.6rem" }}>
        <select
          value={claimPick[expert.id] ?? ""}
          onChange={(e) => setClaimPick((p) => ({ ...p, [expert.id]: e.target.value }))}
          className="admin-search"
          style={{ padding: "8px 10px" }}
        >
          <option value="">Link to team profile…</option>
          {unclaimedTeam.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} — {m.title}
            </option>
          ))}
        </select>
        <button
          className="admin-icon-button"
          disabled={!!busy || !claimPick[expert.id]}
          aria-label="Link team profile"
          onClick={() =>
            claimPick[expert.id] &&
            void act(expert, "claim", { team_member_id: claimPick[expert.id] })
          }
        >
          <Link2 size={15} />
        </button>
      </div>
    );
  }

  function PublishControls({ expert }: { expert: Expert }) {
    return (
      <div className="admin-button-row" style={{ marginTop: "0.6rem" }}>
        {expert.is_public ? (
          <button
            className="admin-button text-destructive"
            disabled={!!busy}
            onClick={() => void act(expert, "unpublish")}
          >
            {busy === expert.id + "unpublish" ? "Unpublishing…" : "Unpublish"}
          </button>
        ) : (
          <button
            className="admin-button admin-button-primary"
            disabled={!!busy}
            onClick={() => void act(expert, "publish")}
          >
            {busy === expert.id + "publish" ? "Publishing…" : "Publish profile"}
          </button>
        )}
        {!expert.is_public && (
          <button className="admin-button" disabled={!!busy} onClick={() => requestChanges(expert)}>
            Request changes
          </button>
        )}
      </div>
    );
  }

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
                      <button
                        className="admin-icon-button text-destructive"
                        aria-label="Delete permanently"
                        disabled={!!busy}
                        onClick={() => remove(e)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <ClaimControls expert={e} />
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
              <p>
                Preview and publish an approved expert's profile. Portfolio items need separate
                approval below.
              </p>
            </div>
          </div>
          <div className="admin-table-scroll">
            <table className="admin-table">
              <tbody>
                {resolved.map((e) => (
                  <tr key={e.id}>
                    <td style={{ verticalAlign: "top" }}>
                      <span className="admin-invoice-name">{e.full_name || "Unnamed"}</span>
                      <small>{e.email}</small>
                    </td>
                    <td style={{ verticalAlign: "top" }}>
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
                      {e.status === "approved" && (
                        <div style={{ marginTop: 6 }}>
                          <span className={`admin-status ${e.is_public ? "paid" : "pending"}`}>
                            {e.is_public ? "Published" : "Not published"}
                          </span>
                        </div>
                      )}
                    </td>
                    <td style={{ verticalAlign: "top" }}>
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
                    <td style={{ verticalAlign: "top" }}>
                      <div className="admin-button-row">
                        <button
                          className={`admin-button ${e.status === "approved" ? "text-destructive" : ""}`}
                          disabled={!!busy}
                          onClick={() =>
                            void act(e, e.status === "approved" ? "reject" : "approve")
                          }
                        >
                          {e.status === "approved"
                            ? busy === e.id + "reject"
                              ? "Revoking…"
                              : "Revoke access"
                            : busy === e.id + "approve"
                              ? "Approving…"
                              : "Approve"}
                        </button>
                        <button
                          className="admin-text-button"
                          onClick={() => setExpanded(expanded === e.id ? null : e.id)}
                        >
                          {expanded === e.id ? "Hide preview" : "Preview"}
                        </button>
                        <button
                          className="admin-icon-button text-destructive"
                          aria-label="Delete permanently"
                          disabled={!!busy}
                          onClick={() => remove(e)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                      {e.status === "approved" && <PublishControls expert={e} />}
                      {e.status === "approved" && <ClaimControls expert={e} />}
                      {expanded === e.id && (
                        <div style={{ marginTop: "0.75rem" }}>
                          <ProfilePreview expert={e} />
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!loading && (
        <>
          <div className="admin-panel-heading" style={{ marginTop: "1.5rem" }}>
            <div>
              <h2>
                Portfolio submissions <span className="admin-count">{pendingPortfolio.length}</span>
              </h2>
              <p>Approve an item to show it on that expert's public profile.</p>
            </div>
          </div>
          {portfolioItems.length === 0 ? (
            <div className="admin-empty">
              <h3>No portfolio items yet</h3>
              <p>Items experts submit will show up here for approval.</p>
            </div>
          ) : (
            <div className="admin-table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Expert</th>
                    <th>Tags</th>
                    <th>Status</th>
                    <th>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[...pendingPortfolio, ...reviewedPortfolio].map((item) => {
                    const tags = [
                      ...item.service_slugs.map((s) => getCoreService(s)?.name).filter(Boolean),
                      ...item.audience_slugs.map((s) => getAudience(s)?.name).filter(Boolean),
                    ] as string[];
                    return (
                      <tr key={item.id}>
                        <td>
                          <span className="admin-invoice-name">{item.title}</span>
                          {item.description && <small>{item.description.slice(0, 80)}</small>}
                        </td>
                        <td>
                          {item.expert_profiles?.full_name || item.expert_profiles?.email || "—"}
                        </td>
                        <td style={{ maxWidth: 220, whiteSpace: "normal" }}>
                          {tags.join(", ") || "—"}
                        </td>
                        <td>
                          <span
                            className={`admin-status ${
                              item.status === "approved"
                                ? "paid"
                                : item.status === "rejected"
                                  ? "overdue"
                                  : "pending"
                            }`}
                          >
                            {item.status === "approved"
                              ? "Live"
                              : item.status === "rejected"
                                ? "Rejected"
                                : "Pending"}
                          </span>
                        </td>
                        <td>
                          <div className="admin-button-row">
                            {item.status !== "approved" && (
                              <button
                                className="admin-button admin-button-primary"
                                disabled={!!busy}
                                onClick={() => void portfolioAct(item, "approve")}
                              >
                                {busy === item.id + "approve" ? "Approving…" : "Approve"}
                              </button>
                            )}
                            {item.status !== "rejected" && (
                              <button
                                className="admin-button text-destructive"
                                disabled={!!busy}
                                onClick={() => void portfolioAct(item, "reject")}
                              >
                                {busy === item.id + "reject" ? "Rejecting…" : "Reject"}
                              </button>
                            )}
                            <button
                              className="admin-icon-button text-destructive"
                              aria-label="Delete"
                              disabled={!!busy}
                              onClick={() => {
                                if (window.confirm(`Delete "${item.title}"?`))
                                  void portfolioAct(item, "delete");
                              }}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
