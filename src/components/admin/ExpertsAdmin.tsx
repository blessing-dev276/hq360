import { Skeleton } from "@/components/ui/skeleton";
import { GlassLoading } from "@/components/ui/glass-loading";
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  BadgeCheck,
  CircleCheck,
  Crown,
  ImageUp,
  Images,
  Inbox,
  Link2,
  GraduationCap,
  Megaphone,
  KeyRound,
  Mail,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Unlink,
  UserCheck,
  UserPlus,
  UserRound,
  Users,
  UserX,
  X,
} from "lucide-react";
import { AUDIENCES, CORE_SERVICES, getAudience, getCoreService } from "@/data/agency";
import { EXPERT_FEATURES, EXPERT_ROLES, roleLabel } from "@/lib/expert-roles";
import { NUDGE_SIGNOFF, NUDGES, nudgeAvailableFor } from "@/lib/expert-nudges";
import { uploadAdminMedia } from "@/lib/admin-upload";
import { initials } from "@/lib/experts";

type ProfileStatus = "draft" | "submitted" | "approved" | "changes_requested";
type Expert = {
  id: string;
  email: string;
  full_name: string | null;
  headline: string | null;
  summary: string | null;
  bio: string | null;
  photo_url: string | null;
  specialties: string[] | null;
  location: string | null;
  website_url: string | null;
  linkedin_url: string | null;
  fiverr_url?: string | null;
  upwork_url?: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  slug: string | null;
  is_public: boolean | null;
  profile_status: ProfileStatus;
  profile_review_note: string | null;
  claimed_team_member_id: string | null;
  role: string;
  permissions: string[];
  is_founder: boolean;
  is_guest?: boolean;
  invited_at?: string | null;
  invite_expires_at?: string | null;
  academy_trainer?: boolean;
};
type TeamMember = { id: string; name: string; title: string; claimed_by_expert_id: string | null };
type SitePortfolioItem = { id: string; title: string };
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
  source_portfolio_item_id: string | null;
};
type ClientReview = {
  id: string;
  expert_id: string;
  client_name: string;
  screenshot_url: string;
  status: "pending" | "approved" | "rejected";
};
type TestimonialVideo = {
  id: string;
  expert_id: string;
  client_name: string;
  video_url: string;
  status: "pending" | "approved" | "rejected";
};
type Filter = "all" | "attention" | "published" | "unpublished" | "pending" | "rejected" | "guests";
type DrawerTab = "overview" | "profile" | "portfolio" | "access";
type ExpertAction =
  | "approve"
  | "reject"
  | "delete"
  | "publish"
  | "unpublish"
  | "request_changes"
  | "claim"
  | "unlink_team"
  | "assign_portfolio"
  | "set_access"
  | "update_profile"
  | "resend_invite"
  | "set_academy_trainer"
  | "nudge";

async function post(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}

function profileState(e: Expert): { label: string; tone: string } {
  if (e.is_guest) {
    if (e.status === "rejected") return { label: "Guest · suspended", tone: "overdue" };
    return e.invite_expires_at
      ? { label: "Guest · invite sent", tone: "pending" }
      : { label: "Guest", tone: "paid" };
  }
  if (e.status === "pending") return { label: "Awaiting approval", tone: "pending" };
  if (e.status === "rejected") return { label: "Rejected", tone: "overdue" };
  if (e.is_public) return { label: "Published", tone: "paid" };
  if (e.profile_status === "submitted") return { label: "Profile in review", tone: "pending" };
  if (e.profile_status === "changes_requested")
    return { label: "Changes requested", tone: "overdue" };
  return { label: "Not published", tone: "draft" };
}

function Avatar({ expert, size = 40 }: { expert: Expert; size?: number }) {
  return expert.photo_url ? (
    <img
      src={expert.photo_url}
      alt=""
      style={{
        width: size,
        height: size,
        borderRadius: size / 3.5,
        objectFit: "cover",
        flexShrink: 0,
      }}
    />
  ) : (
    <span
      className="admin-action-icon"
      style={{ width: size, height: size, fontWeight: 700, fontSize: size / 3, flexShrink: 0 }}
    >
      {initials(expert.full_name || expert.email)}
    </span>
  );
}

export function ExpertsAdmin() {
  const [experts, setExperts] = useState<Expert[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [videos, setVideos] = useState<TestimonialVideo[]>([]);
  const [reviews, setReviews] = useState<ClientReview[]>([]);
  const [sitePortfolio, setSitePortfolio] = useState<SitePortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>("overview");
  const [inviting, setInviting] = useState(false);
  // Bulk nudge: experts ticked in the list.
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [bulkNudge, setBulkNudge] = useState(false);
  const [inviteLink, setInviteLink] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [e, t, p, s, v, r] = await Promise.all([
        fetch("/api/admin/experts"),
        fetch("/api/admin/team"),
        fetch("/api/admin/expert-portfolio"),
        fetch("/api/admin/portfolio"),
        fetch("/api/admin/expert-testimonials"),
        fetch("/api/admin/expert-reviews"),
      ]);
      const ed = await e.json().catch(() => ({}));
      if (!e.ok) throw new Error(ed.error || "Could not load experts.");
      setExperts(ed.experts ?? []);
      const td = await t.json().catch(() => ({}));
      if (t.ok) setTeam(td.members ?? []);
      const pd = await p.json().catch(() => ({}));
      if (p.ok) setPortfolio(pd.items ?? []);
      const sd = await s.json().catch(() => ({}));
      if (s.ok) setSitePortfolio(sd.items ?? []);
      const vd = await v.json().catch(() => ({}));
      if (v.ok) setVideos(vd.items ?? []);
      const rd = await r.json().catch(() => ({}));
      if (r.ok) setReviews(rd.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load experts.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function run(key: string, task: () => Promise<unknown>, success?: string) {
    setBusy(key);
    setError("");
    setNotice("");
    try {
      await task();
      if (success) setNotice(success);
      await load();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      return false;
    } finally {
      setBusy("");
    }
  }
  const act = (
    expert: Expert,
    action: ExpertAction,
    extra?: Record<string, unknown>,
    success?: string,
  ) =>
    run(
      expert.id + action,
      () => post(`/api/admin/experts/${expert.id}`, { action, ...extra }),
      success,
    );
  const portfolioAct = (
    item: PortfolioItem,
    action: "approve" | "reject" | "delete" | "update",
    extra?: Record<string, unknown>,
  ) =>
    run(item.id + action, () =>
      post(`/api/admin/expert-portfolio/${item.id}`, { action, ...extra }),
    );

  const videoAct = (video: TestimonialVideo, action: "approve" | "reject") =>
    run(
      video.id + action,
      () => post(`/api/admin/expert-testimonials/${video.id}`, { action }),
      action === "approve" ? "Video approved." : "Video rejected.",
    );

  const reviewAct = (review: ClientReview, action: "approve" | "reject") =>
    run(
      review.id + action,
      () => post(`/api/admin/expert-reviews/${review.id}`, { action }),
      action === "approve" ? "Review verified." : "Review rejected.",
    );

  function remove(expert: Expert) {
    if (
      window.confirm(
        `Permanently delete ${expert.full_name || expert.email}? This deletes their login and expert profile for good — it cannot be undone.`,
      )
    ) {
      setSelectedId(null);
      void act(expert, "delete", undefined, "Expert deleted.");
    }
  }
  function requestChanges(expert: Expert) {
    const note = window.prompt("What should they change? (shown to the expert)");
    if (note !== null) void act(expert, "request_changes", { note }, "Changes requested.");
  }

  const founder = experts.find((e) => e.is_founder) ?? null;
  const itemsByExpert = useMemo(() => {
    const map = new Map<string, PortfolioItem[]>();
    for (const item of portfolio)
      map.set(item.expert_id, [...(map.get(item.expert_id) ?? []), item]);
    return map;
  }, [portfolio]);
  const needsAction = (e: Expert) =>
    e.status === "pending" ||
    (e.status === "approved" && e.profile_status === "submitted" && !e.is_public) ||
    (itemsByExpert.get(e.id) ?? []).some((i) => i.status === "pending");

  const pendingAccounts = experts.filter((e) => e.status === "pending");
  const submittedProfiles = experts.filter(
    (e) => e.status === "approved" && e.profile_status === "submitted" && !e.is_public,
  );
  const pendingItems = portfolio.filter((i) => i.status === "pending");
  const pendingVideos = videos.filter((v) => v.status === "pending");
  const pendingReviews = reviews.filter((r) => r.status === "pending");
  const attentionCount =
    pendingAccounts.length +
    submittedProfiles.length +
    pendingItems.length +
    pendingVideos.length +
    pendingReviews.length;

  const visible = experts.filter((e) => {
    const matches = `${e.full_name ?? ""} ${e.email} ${e.headline ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase());
    if (!matches) return false;
    if (filter === "guests") return !!e.is_guest;
    if (filter === "attention") return needsAction(e);
    if (filter === "published") return e.status === "approved" && !!e.is_public;
    if (filter === "unpublished") return e.status === "approved" && !e.is_public && !e.is_guest;
    if (filter === "pending") return e.status === "pending";
    if (filter === "rejected") return e.status === "rejected" && !e.is_guest;
    return true;
  });
  const selected = experts.find((e) => e.id === selectedId) ?? null;
  const expertName = (id: string) => {
    const e = experts.find((x) => x.id === id);
    return e?.full_name || e?.email || "Expert";
  };
  function open(expert: Expert, tab: DrawerTab = "overview") {
    setSelectedId(expert.id);
    setDrawerTab(tab);
    setNotice("");
  }

  const feedback = (
    <>
      {error && (
        <div className="admin-alert" role="alert">
          <AlertCircle size={18} /> {error}
        </div>
      )}
      {notice && (
        <div className="admin-notice" role="status">
          <CircleCheck size={18} /> {notice}
        </div>
      )}
    </>
  );

  return (
    <div style={{ display: "grid", gap: 22 }}>
      {!selected && !inviting && feedback}

      <div
        className="admin-stats"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}
      >
        <Stat
          loading={loading && experts.length === 0}
          label="Experts"
          icon={Users}
          value={experts.filter((e) => !e.is_guest).length}
          note={`${experts.filter((e) => e.status === "approved" && !e.is_guest).length} approved · ${experts.filter((e) => e.is_guest).length} guests`}
        />
        <Stat
          loading={loading && experts.length === 0}
          label="Needs your action"
          icon={Inbox}
          value={attentionCount}
          note="Accounts, profiles and portfolio"
        />
        <Stat
          loading={loading && experts.length === 0}
          label="Published profiles"
          icon={BadgeCheck}
          value={experts.filter((e) => e.is_public).length}
          note="Live on /experts"
        />
        <Stat
          loading={loading && experts.length === 0}
          label="Portfolio live"
          icon={Images}
          value={portfolio.filter((i) => i.status === "approved").length}
          note={`${pendingItems.length} waiting for review`}
        />
      </div>

      <FounderCard
        founder={founder}
        team={team}
        busy={busy}
        onOpen={(tab) => founder && open(founder, tab)}
        onClaim={(email, teamMemberId) =>
          run(
            "founder",
            () => post("/api/admin/founder", { email, team_member_id: teamMemberId }),
            "Founder profile claimed. You can now edit it.",
          )
        }
      />

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <h2>
              Needs your action <span className="admin-count">{attentionCount}</span>
            </h2>
            <p>Everything waiting on you, in one place.</p>
          </div>
          <button
            className="admin-icon-button"
            aria-label="Refresh"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
        {loading && experts.length === 0 ? (
          <div style={{ padding: "0 25px 20px" }}>
            <GlassLoading label="Loading what needs your action…" variant="list" rows={3} />
          </div>
        ) : attentionCount === 0 ? (
          <div className="admin-empty">
            <h3>You're all caught up</h3>
            <p>
              New sign-ups, profiles sent for review, portfolio items and testimonial videos will
              appear here.
            </p>
          </div>
        ) : (
          <div className="admin-queue">
            {pendingAccounts.map((e) => (
              <QueueRow
                key={`a-${e.id}`}
                expert={e}
                title={e.full_name || e.email}
                detail={`New expert account · ${e.headline || e.email}`}
                onOpen={() => open(e)}
              >
                <button
                  className="admin-button admin-button-primary"
                  disabled={!!busy}
                  onClick={() => void act(e, "approve", undefined, "Account approved.")}
                >
                  <UserCheck size={15} /> Approve
                </button>
                <button
                  className="admin-button text-destructive"
                  disabled={!!busy}
                  onClick={() => void act(e, "reject", undefined, "Account rejected.")}
                >
                  <UserX size={15} /> Reject
                </button>
              </QueueRow>
            ))}
            {submittedProfiles.map((e) => (
              <QueueRow
                key={`p-${e.id}`}
                expert={e}
                title={e.full_name || e.email}
                detail="Profile sent for review"
                onOpen={() => open(e, "profile")}
              >
                <button className="admin-button" onClick={() => open(e, "profile")}>
                  Review
                </button>
                <button
                  className="admin-button admin-button-primary"
                  disabled={!!busy}
                  onClick={() => void act(e, "publish", undefined, "Profile published.")}
                >
                  Publish
                </button>
              </QueueRow>
            ))}
            {pendingReviews.map((review) => {
              const owner = experts.find((x) => x.id === review.expert_id);
              return (
                <QueueRow
                  key={`r-${review.id}`}
                  expert={owner}
                  title={`Review from ${review.client_name}`}
                  detail={`Client review from ${expertName(review.expert_id)} · check it matches the screenshot`}
                  onOpen={() => window.open(review.screenshot_url, "_blank", "noopener")}
                >
                  <a
                    className="admin-button"
                    href={review.screenshot_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Screenshot
                  </a>
                  <button
                    className="admin-button admin-button-primary"
                    disabled={!!busy}
                    onClick={() => void reviewAct(review, "approve")}
                  >
                    Verify
                  </button>
                  <button
                    className="admin-button text-destructive"
                    disabled={!!busy}
                    onClick={() => void reviewAct(review, "reject")}
                  >
                    Reject
                  </button>
                </QueueRow>
              );
            })}
            {pendingVideos.map((video) => {
              const owner = experts.find((x) => x.id === video.expert_id);
              return (
                <QueueRow
                  key={`v-${video.id}`}
                  expert={owner}
                  title={`Video from ${video.client_name}`}
                  detail={`Testimonial video from ${expertName(video.expert_id)}`}
                  onOpen={() => window.open(video.video_url, "_blank", "noopener")}
                >
                  <a
                    className="admin-button"
                    href={video.video_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Watch
                  </a>
                  <button
                    className="admin-button admin-button-primary"
                    disabled={!!busy}
                    onClick={() => void videoAct(video, "approve")}
                  >
                    Approve
                  </button>
                  <button
                    className="admin-button text-destructive"
                    disabled={!!busy}
                    onClick={() => void videoAct(video, "reject")}
                  >
                    Reject
                  </button>
                </QueueRow>
              );
            })}
            {pendingItems.map((item) => {
              const owner = experts.find((x) => x.id === item.expert_id);
              return (
                <QueueRow
                  key={`i-${item.id}`}
                  expert={owner}
                  title={item.title}
                  detail={`Portfolio item from ${expertName(item.expert_id)}`}
                  onOpen={() => owner && open(owner, "portfolio")}
                >
                  <button
                    className="admin-button admin-button-primary"
                    disabled={!!busy}
                    onClick={() => void portfolioAct(item, "approve")}
                  >
                    Approve
                  </button>
                  <button
                    className="admin-button text-destructive"
                    disabled={!!busy}
                    onClick={() => void portfolioAct(item, "reject")}
                  >
                    Reject
                  </button>
                </QueueRow>
              );
            })}
          </div>
        )}
      </section>

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <h2>
              All experts <span className="admin-count">{experts.length}</span>
            </h2>
            <p>Open an expert to manage their account, profile, portfolio and access.</p>
          </div>
          <button
            className="admin-button admin-button-primary"
            onClick={() => {
              setInviting(true);
              setInviteLink("");
              setError("");
              setNotice("");
            }}
          >
            <UserPlus size={15} /> Invite guest
          </button>
        </div>
        {picked.size > 0 && (
          <div
            role="region"
            aria-label="Selected experts"
            className="admin-drawer-card"
            style={{
              margin: "0 25px 12px",
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              position: "sticky",
              top: 8,
              zIndex: 5,
            }}
          >
            <strong style={{ flex: 1 }}>
              {picked.size} expert{picked.size === 1 ? "" : "s"} selected
            </strong>
            <button className="admin-button" onClick={() => setPicked(new Set())}>
              Clear
            </button>
            <button
              className="admin-button admin-button-primary"
              onClick={() => setBulkNudge(true)}
            >
              <Megaphone size={15} /> Nudge {picked.size}
            </button>
          </div>
        )}
        <div className="admin-table-toolbar">
          <div className="admin-filters" aria-label="Filter experts">
            {(
              [
                ["all", "All"],
                ["attention", "Needs action"],
                ["published", "Published"],
                ["unpublished", "Not published"],
                ["pending", "Awaiting approval"],
                ["rejected", "Rejected"],
                ["guests", "Guests"],
              ] as [Filter, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                className={filter === value ? "active" : ""}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="admin-search">
            <Search size={16} />
            <input
              aria-label="Search experts"
              placeholder="Search experts…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
        {loading && experts.length === 0 ? (
          <div style={{ padding: "0 25px 20px" }}>
            <GlassLoading label="Loading experts…" variant="table" rows={5} />
          </div>
        ) : visible.length === 0 ? (
          <div className="admin-empty">
            <h3>{experts.length ? "No matching experts" : "No experts yet"}</h3>
            <p>
              {experts.length
                ? "Try another search or filter."
                : "New expert sign-ups will appear here."}
            </p>
          </div>
        ) : (
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>
                    {(() => {
                      const ids = visible.filter((e) => e.status === "approved").map((e) => e.id);
                      const all = ids.length > 0 && ids.every((id) => picked.has(id));
                      return (
                        <input
                          type="checkbox"
                          aria-label="Select all approved experts shown"
                          checked={all}
                          disabled={!ids.length}
                          onChange={() =>
                            setPicked((p) => {
                              const next = new Set(p);
                              for (const id of ids) {
                                if (all) next.delete(id);
                                else next.add(id);
                              }
                              return next;
                            })
                          }
                        />
                      );
                    })()}
                  </th>
                  <th>Expert</th>
                  <th>Status</th>
                  <th>Role</th>
                  <th>Portfolio</th>
                  <th>
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((e) => {
                  const state = profileState(e);
                  const items = itemsByExpert.get(e.id) ?? [];
                  return (
                    <tr key={e.id} style={{ cursor: "pointer" }} onClick={() => open(e)}>
                      <td onClick={(ev) => ev.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label={`Select ${e.full_name || e.email}`}
                          disabled={e.status !== "approved"}
                          title={
                            e.status !== "approved" ? "Only approved experts can be nudged" : ""
                          }
                          checked={picked.has(e.id)}
                          onChange={() =>
                            setPicked((p) => {
                              const next = new Set(p);
                              if (next.has(e.id)) next.delete(e.id);
                              else next.add(e.id);
                              return next;
                            })
                          }
                        />
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                          <Avatar expert={e} />
                          <div>
                            <span className="admin-invoice-name">
                              {e.full_name || "Unnamed"}{" "}
                              {e.is_founder && (
                                <Crown
                                  size={13}
                                  style={{ display: "inline", color: "var(--brand)" }}
                                  aria-label="Founder"
                                />
                              )}
                            </span>
                            <small>{e.email}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`admin-status ${state.tone}`}>{state.label}</span>
                      </td>
                      <td>
                        {e.is_guest
                          ? toolList(e.permissions)
                          : e.status === "approved"
                            ? roleLabel(e.role)
                            : "—"}
                      </td>
                      <td>
                        {items.filter((i) => i.status === "approved").length} live
                        {items.some((i) => i.status === "pending") && (
                          <small>
                            {items.filter((i) => i.status === "pending").length} pending
                          </small>
                        )}
                      </td>
                      <td>
                        <button
                          className="admin-icon-button"
                          aria-label={`Open ${e.full_name || e.email}`}
                        >
                          <ArrowUpRight size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {bulkNudge && (
        <BulkNudgeDialog
          experts={experts.filter((e) => picked.has(e.id))}
          suggestionsFor={(e) =>
            nudgeSuggestions(
              e,
              itemsByExpert.get(e.id) ?? [],
              videos.filter((v) => v.expert_id === e.id).length,
              reviews.filter((r) => r.expert_id === e.id).length,
            )
          }
          onClose={() => setBulkNudge(false)}
          onSent={(message) => {
            setBulkNudge(false);
            setPicked(new Set());
            setNotice(message);
          }}
        />
      )}
      {inviting && (
        <InviteGuestDrawer
          busy={busy}
          feedback={feedback}
          link={inviteLink}
          onClose={() => {
            setInviting(false);
            setInviteLink("");
          }}
          onInvite={(input) =>
            run("invite-guest", async () => {
              const data = await post("/api/admin/expert-guests", input);
              setInviteLink(data.link);
              setNotice(
                data.emailed
                  ? `Invite emailed to ${input.email}.`
                  : "Guest created, but the email didn't send. Copy the invite link below and share it yourself.",
              );
              return data;
            })
          }
        />
      )}

      {selected && (
        <div
          className="admin-drawer-backdrop"
          role="presentation"
          onClick={(ev) => ev.target === ev.currentTarget && !busy && setSelectedId(null)}
        >
          <aside
            className="admin-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={selected.full_name || selected.email}
          >
            <div className="admin-drawer-head">
              <Avatar expert={selected} size={56} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <h2 style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {selected.full_name || "Unnamed"}
                  {selected.is_founder && <span className="admin-status paid">Founder</span>}
                </h2>
                <small>{selected.email}</small>
                <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                  <span className={`admin-status ${profileState(selected).tone}`}>
                    {profileState(selected).label}
                  </span>
                  {selected.status === "approved" && !selected.is_guest && (
                    <span className="admin-status draft">{roleLabel(selected.role)}</span>
                  )}
                </div>
              </div>
              <button
                className="admin-icon-button"
                aria-label="Close"
                disabled={!!busy}
                onClick={() => setSelectedId(null)}
              >
                <X size={17} />
              </button>
            </div>
            <div className="admin-segmented" style={{ alignSelf: "start" }}>
              {(
                (selected.is_guest
                  ? [
                      ["overview", "Overview"],
                      ["access", "Tools"],
                    ]
                  : [
                      ["overview", "Overview"],
                      ["profile", "Profile"],
                      ["portfolio", "Portfolio"],
                      ["access", "Access"],
                    ]) as [DrawerTab, string][]
              ).map(([value, label]) => (
                <button
                  key={value}
                  className={drawerTab === value ? "active" : ""}
                  onClick={() => setDrawerTab(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            {feedback}
            {drawerTab === "overview" && selected.is_guest && (
              <GuestOverview
                expert={selected}
                busy={busy}
                onAct={(action, success) => void act(selected, action, undefined, success)}
                onResend={() =>
                  void run(selected.id + "resend_invite", async () => {
                    const data = await post(`/api/admin/experts/${selected.id}`, {
                      action: "resend_invite",
                    });
                    setInviteLink(data.link);
                    setNotice(
                      data.emailed
                        ? "A new invite was emailed. The old link no longer works."
                        : "New link created, but the email didn't send. Copy it below.",
                    );
                    return data;
                  })
                }
                inviteLink={inviteLink}
                onDelete={() => remove(selected)}
              />
            )}
            {drawerTab === "overview" && selected.status === "approved" && (
              <NudgeCard
                key={`nudge-${selected.id}`}
                expert={selected}
                busy={busy}
                suggested={nudgeSuggestions(
                  selected,
                  itemsByExpert.get(selected.id) ?? [],
                  videos.filter((v) => v.expert_id === selected.id).length,
                  reviews.filter((r) => r.expert_id === selected.id).length,
                )}
                onSend={(keys, note) =>
                  act(
                    selected,
                    "nudge",
                    { keys, note },
                    `Nudge sent to ${selected.full_name || selected.email}: ${keys.length} item${keys.length === 1 ? "" : "s"}, by notification and email.`,
                  )
                }
              />
            )}
            {drawerTab === "overview" && !selected.is_guest && (
              <OverviewTab
                expert={selected}
                team={team}
                busy={busy}
                onAct={(action, extra, success) => void act(selected, action, extra, success)}
                onRequestChanges={() => requestChanges(selected)}
                onDelete={() => remove(selected)}
              />
            )}
            {drawerTab === "profile" && (
              <ProfileTab
                key={selected.id}
                expert={selected}
                busy={busy}
                onSave={(profile) => act(selected, "update_profile", { profile }, "Profile saved.")}
                onPublish={() =>
                  void act(
                    selected,
                    selected.is_public ? "unpublish" : "publish",
                    undefined,
                    selected.is_public ? "Profile unpublished." : "Profile published.",
                  )
                }
                onRequestChanges={() => requestChanges(selected)}
              />
            )}
            {drawerTab === "portfolio" && (
              <PortfolioTab
                expert={selected}
                items={itemsByExpert.get(selected.id) ?? []}
                sitePortfolio={sitePortfolio}
                assignedSourceIds={
                  new Set(
                    portfolio.map((i) => i.source_portfolio_item_id).filter(Boolean) as string[],
                  )
                }
                busy={busy}
                onItem={(item, action, extra) => portfolioAct(item, action, extra)}
                onAssign={(id) =>
                  act(
                    selected,
                    "assign_portfolio",
                    { portfolio_item_id: id },
                    "Portfolio item assigned.",
                  )
                }
                onCreate={(item) =>
                  run(
                    "create-item",
                    () => post("/api/admin/expert-portfolio", { expert_id: selected.id, item }),
                    "Portfolio item added.",
                  )
                }
              />
            )}
            {drawerTab === "access" && (
              <div style={{ display: "grid", gap: 16, marginBottom: 16 }}>
                {!selected.is_guest && selected.status === "approved" && (
                  <DrawerCard
                    icon={GraduationCap}
                    title="Author Scout Academy trainer"
                    text={
                      selected.academy_trainer
                        ? "On. They're a trainer in the Academy (same login), shown as the trainer with their profile name, photo and headline, and their Perplexity key powers the Practice Room."
                        : "Make this expert a trainer in the Academy. Their profile details are shown as the trainer, and their Perplexity key is used."
                    }
                  >
                    <button
                      className={`admin-button${selected.academy_trainer ? "" : " admin-button-primary"}`}
                      disabled={!!busy}
                      onClick={() =>
                        void act(
                          selected,
                          "set_academy_trainer",
                          { on: !selected.academy_trainer },
                          selected.academy_trainer
                            ? "Removed as Academy trainer."
                            : "Now an Academy trainer.",
                        )
                      }
                    >
                      <GraduationCap size={15} />{" "}
                      {selected.academy_trainer ? "Remove as trainer" : "Make Academy trainer"}
                    </button>
                  </DrawerCard>
                )}
                <ExpertKeyCard key={`key-${selected.id}`} expertId={selected.id} />
              </div>
            )}
            {drawerTab === "access" && (
              <AccessTab
                key={selected.id}
                expert={selected}
                busy={busy}
                onSave={(role, permissions) =>
                  void act(selected, "set_access", { role, permissions }, "Access updated.")
                }
              />
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  icon: Icon,
  value,
  note,
  loading = false,
}: {
  label: string;
  icon: typeof Users;
  value: number;
  note: string;
  loading?: boolean;
}) {
  return (
    <div className="admin-stat">
      <div>
        {label} <Icon size={18} />
      </div>
      {loading ? (
        <>
          <Skeleton width="40%" height={30} style={{ margin: "18px 0 10px" }} />
          <Skeleton width="65%" height={10} />
        </>
      ) : (
        <>
          <strong className="hq-fade-in">{value}</strong>
          <small className="hq-fade-in">{note}</small>
        </>
      )}
    </div>
  );
}

function QueueRow({
  expert,
  title,
  detail,
  onOpen,
  children,
}: {
  expert?: Expert | undefined;
  title: string;
  detail: string;
  onOpen: () => void;
  children: ReactNode;
}) {
  return (
    <div className="admin-queue-row">
      {expert ? (
        <Avatar expert={expert} size={36} />
      ) : (
        <span className="admin-action-icon" style={{ width: 36, height: 36 }} />
      )}
      <button className="admin-queue-main" onClick={onOpen}>
        <strong>{title}</strong>
        <small>{detail}</small>
      </button>
      <div className="admin-button-row">{children}</div>
    </div>
  );
}

function FounderCard({
  founder,
  team,
  busy,
  onOpen,
  onClaim,
}: {
  founder: Expert | null;
  team: TeamMember[];
  busy: string;
  onOpen: (tab: DrawerTab) => void;
  onClaim: (email: string, teamMemberId: string) => Promise<boolean>;
}) {
  const suggested = team.find((m) => /founder/i.test(m.title)) ?? team[0];
  const [teamId, setTeamId] = useState("");
  const [email, setEmail] = useState("ceo@hq360.space");
  if (founder)
    return (
      <section className="admin-feature" style={{ minHeight: 0 }}>
        <div
          style={{
            display: "flex",
            gap: 18,
            alignItems: "center",
            flexWrap: "wrap",
            position: "relative",
            zIndex: 1,
          }}
        >
          <Avatar expert={founder} size={64} />
          <div style={{ flex: 1, minWidth: 220 }}>
            <p className="admin-eyebrow">
              <Crown size={12} style={{ display: "inline" }} /> FOUNDER PROFILE
            </p>
            <h2 style={{ marginTop: 6 }}>{founder.full_name}</h2>
            <p style={{ margin: "4px 0 0" }}>{founder.headline || "Add a headline"}</p>
          </div>
          <div className="admin-button-row" style={{ flexWrap: "wrap" }}>
            <button className="admin-button admin-button-primary" onClick={() => onOpen("profile")}>
              <Pencil size={15} /> Edit profile
            </button>
            <button className="admin-button" onClick={() => onOpen("portfolio")}>
              <Images size={15} /> Portfolio
            </button>
            {founder.slug && (
              <a
                className="admin-button"
                href={`/experts/${founder.slug}`}
                target="_blank"
                rel="noreferrer"
              >
                View page <ArrowUpRight size={15} />
              </a>
            )}
          </div>
        </div>
      </section>
    );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onClaim(email, teamId || suggested?.id || "");
  }
  return (
    <section className="admin-panel">
      <div className="admin-panel-heading">
        <div>
          <h2 style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Crown size={16} /> Claim the founder profile
          </h2>
          <p>
            Turn the founder's team entry into a full profile you can edit — bio, photo, links and
            portfolio — from here. It keeps its place on the team page.
          </p>
        </div>
      </div>
      <form className="admin-invoice-form" style={{ padding: "0 25px 24px" }} onSubmit={submit}>
        <div className="admin-form-grid">
          <label>
            Team profile
            <select
              value={teamId || suggested?.id || ""}
              onChange={(e) => setTeamId(e.target.value)}
              required
            >
              {team.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} — {m.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Founder email (used for the login)
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
        </div>
        <div>
          <button className="admin-button admin-button-primary" disabled={!!busy || !team.length}>
            <Crown size={15} /> {busy === "founder" ? "Claiming…" : "Claim founder profile"}
          </button>
        </div>
      </form>
    </section>
  );
}

function OverviewTab({
  expert,
  team,
  busy,
  onAct,
  onRequestChanges,
  onDelete,
}: {
  expert: Expert;
  team: TeamMember[];
  busy: string;
  onAct: (action: ExpertAction, extra?: Record<string, unknown>, success?: string) => void;
  onRequestChanges: () => void;
  onDelete: () => void;
}) {
  const [pick, setPick] = useState("");
  const linked = team.find((m) => m.id === expert.claimed_team_member_id);
  const unclaimed = team.filter((m) => !m.claimed_by_expert_id);
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <DrawerCard
        icon={UserRound}
        title="Account"
        text={
          expert.status === "pending"
            ? "This expert is waiting for approval."
            : expert.status === "approved"
              ? "Approved — can sign in to the expert workspace."
              : "Rejected — cannot sign in."
        }
      >
        {expert.status !== "approved" && (
          <button
            className="admin-button admin-button-primary"
            disabled={!!busy}
            onClick={() => onAct("approve", undefined, "Account approved.")}
          >
            <UserCheck size={15} /> Approve
          </button>
        )}
        {expert.status !== "rejected" && !expert.is_founder && (
          <button
            className="admin-button text-destructive"
            disabled={!!busy}
            onClick={() =>
              onAct(
                "reject",
                undefined,
                expert.status === "approved" ? "Access revoked." : "Account rejected.",
              )
            }
          >
            <UserX size={15} /> {expert.status === "approved" ? "Revoke access" : "Reject"}
          </button>
        )}
        {!expert.is_founder && (
          <button
            className="admin-icon-button text-destructive"
            aria-label="Delete permanently"
            disabled={!!busy}
            onClick={onDelete}
          >
            <Trash2 size={15} />
          </button>
        )}
      </DrawerCard>

      {expert.status === "approved" && (
        <DrawerCard
          icon={BadgeCheck}
          title="Public profile"
          text={
            expert.is_public
              ? "Live on the experts page."
              : expert.profile_status === "submitted"
                ? "Sent for review — check the Profile tab, then publish."
                : expert.profile_status === "changes_requested"
                  ? `Changes requested${expert.profile_review_note ? `: "${expert.profile_review_note}"` : "."}`
                  : "Not published yet."
          }
        >
          <button
            className={`admin-button ${expert.is_public ? "text-destructive" : "admin-button-primary"}`}
            disabled={!!busy}
            onClick={() =>
              onAct(
                expert.is_public ? "unpublish" : "publish",
                undefined,
                expert.is_public ? "Profile unpublished." : "Profile published.",
              )
            }
          >
            {expert.is_public ? "Unpublish" : "Publish profile"}
          </button>
          {!expert.is_public && (
            <button className="admin-button" disabled={!!busy} onClick={onRequestChanges}>
              Request changes
            </button>
          )}
          {expert.is_public && expert.slug && (
            <a
              className="admin-button"
              href={`/experts/${expert.slug}`}
              target="_blank"
              rel="noreferrer"
            >
              View page <ArrowUpRight size={15} />
            </a>
          )}
        </DrawerCard>
      )}

      <DrawerCard
        icon={Link2}
        title="Team profile"
        text={
          linked
            ? `Linked to ${linked.name} — ${linked.title}. Shown in that team slot.`
            : "Link this expert to a team member you added manually. Team members become Associates."
        }
      >
        {linked ? (
          !expert.is_founder && (
            <button
              className="admin-button"
              disabled={!!busy}
              onClick={() => onAct("unlink_team", undefined, "Team profile unlinked.")}
            >
              <Unlink size={15} /> Unlink
            </button>
          )
        ) : unclaimed.length ? (
          <>
            <select
              className="admin-search"
              style={{ padding: "8px 10px" }}
              value={pick}
              onChange={(e) => setPick(e.target.value)}
            >
              <option value="">Choose a team member…</option>
              {unclaimed.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} — {m.title}
                </option>
              ))}
            </select>
            <button
              className="admin-button"
              disabled={!!busy || !pick}
              onClick={() =>
                onAct(
                  "claim",
                  { team_member_id: pick },
                  "Linked to the team — now an Associate with every expert tool.",
                )
              }
            >
              <Link2 size={15} /> Link
            </button>
          </>
        ) : (
          <small>Every team member is already linked.</small>
        )}
      </DrawerCard>
    </div>
  );
}

function DrawerCard({
  icon: Icon,
  title,
  text,
  children,
}: {
  icon: typeof Users;
  title: string;
  text: string;
  children?: ReactNode;
}) {
  return (
    <div className="admin-drawer-card">
      <div style={{ display: "flex", gap: 12 }}>
        <span className="admin-action-icon" style={{ width: 34, height: 34 }}>
          <Icon size={16} />
        </span>
        <div>
          <strong>{title}</strong>
          <p>{text}</p>
        </div>
      </div>
      {children && (
        <div className="admin-button-row" style={{ flexWrap: "wrap" }}>
          {children}
        </div>
      )}
    </div>
  );
}

function ProfileTab({
  expert,
  busy,
  onSave,
  onPublish,
  onRequestChanges,
}: {
  expert: Expert;
  busy: string;
  onSave: (profile: Record<string, unknown>) => Promise<boolean>;
  onPublish: () => void;
  onRequestChanges: () => void;
}) {
  const [photo, setPhoto] = useState(expert.photo_url ?? "");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [summary, setSummary] = useState(expert.summary ?? "");
  const [bio, setBio] = useState(expert.bio ?? "");

  async function upload(file: File) {
    setUploading(true);
    setUploadError("");
    try {
      setPhoto((await uploadAdminMedia(file, "team")).url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    void onSave({
      full_name: f.get("full_name"),
      headline: f.get("headline"),
      summary,
      bio,
      location: f.get("location"),
      specialties: String(f.get("specialties") || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      website_url: f.get("website_url"),
      linkedin_url: f.get("linkedin_url"),
      fiverr_url: f.get("fiverr_url"),
      upwork_url: f.get("upwork_url"),
      photo_url: photo,
    });
  }
  return (
    <form className="admin-invoice-form" onSubmit={submit}>
      {expert.status === "approved" &&
        !expert.is_founder &&
        expert.profile_status === "submitted" &&
        !expert.is_public && (
          <div className="admin-notice">
            This expert sent their profile for review.
            <div className="admin-button-row" style={{ marginLeft: "auto" }}>
              <button
                type="button"
                className="admin-button admin-button-primary"
                disabled={!!busy}
                onClick={onPublish}
              >
                Publish
              </button>
              <button
                type="button"
                className="admin-button"
                disabled={!!busy}
                onClick={onRequestChanges}
              >
                Request changes
              </button>
            </div>
          </div>
        )}
      <div className="admin-setup" style={{ marginBottom: 0 }}>
        {photo ? (
          <img
            src={photo}
            alt=""
            style={{ width: 64, height: 64, borderRadius: 16, objectFit: "cover" }}
          />
        ) : (
          <span className="admin-action-icon" style={{ width: 64, height: 64 }}>
            <ImageUp size={20} />
          </span>
        )}
        <div>
          <strong>Profile photo</strong>
          <p>{uploadError || "A clear, well-lit portrait. PNG, JPG or WebP."}</p>
        </div>
        <label className="admin-button" style={{ cursor: "pointer" }}>
          {uploading ? "Uploading…" : photo ? "Replace" : "Upload"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      <div className="admin-form-grid">
        <label>
          Full name
          <input
            name="full_name"
            required
            minLength={2}
            maxLength={150}
            defaultValue={expert.full_name ?? ""}
          />
        </label>
        <label>
          Headline
          <input name="headline" maxLength={160} defaultValue={expert.headline ?? ""} />
        </label>
        <label>
          Location
          <input name="location" maxLength={120} defaultValue={expert.location ?? ""} />
        </label>
        <label>
          Specialties (comma separated)
          <input name="specialties" defaultValue={(expert.specialties ?? []).join(", ")} />
        </label>
        <label>
          Website
          <input
            name="website_url"
            type="url"
            placeholder="https://"
            defaultValue={expert.website_url ?? ""}
          />
        </label>
        <label>
          LinkedIn
          <input
            name="linkedin_url"
            type="url"
            placeholder="https://www.linkedin.com/in/…"
            defaultValue={expert.linkedin_url ?? ""}
          />
        </label>
        <label>
          Fiverr
          <input
            name="fiverr_url"
            type="url"
            placeholder="https://www.fiverr.com/…"
            defaultValue={expert.fiverr_url ?? ""}
          />
        </label>
        <label>
          Upwork
          <input
            name="upwork_url"
            type="url"
            placeholder="https://www.upwork.com/freelancers/…"
            defaultValue={expert.upwork_url ?? ""}
          />
        </label>
      </div>
      <label>
        <span style={{ display: "flex", justifyContent: "space-between" }}>
          Short intro <small>{summary.length}/140</small>
        </span>
        <input
          maxLength={140}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="One line at the top of the public profile."
        />
      </label>
      <label>
        <span style={{ display: "flex", justifyContent: "space-between" }}>
          About <small>{bio.length}/1200</small>
        </span>
        <textarea rows={6} maxLength={1200} value={bio} onChange={(e) => setBio(e.target.value)} />
      </label>
      <div className="admin-button-row">
        <button className="admin-button admin-button-primary" disabled={!!busy || uploading}>
          {busy === expert.id + "update_profile" ? "Saving…" : "Save profile"}
        </button>
        {expert.slug && expert.is_public && (
          <a
            className="admin-button"
            href={`/experts/${expert.slug}`}
            target="_blank"
            rel="noreferrer"
          >
            View page <ArrowUpRight size={15} />
          </a>
        )}
      </div>
      <p className="admin-form-note">Your edits go live straight away on a published profile.</p>
    </form>
  );
}

type ItemDraft = {
  title: string;
  description: string;
  image_url: string;
  external_link: string;
  service_slugs: string[];
  audience_slugs: string[];
};
const EMPTY_ITEM: ItemDraft = {
  title: "",
  description: "",
  image_url: "",
  external_link: "",
  service_slugs: [],
  audience_slugs: [],
};

function PortfolioTab({
  expert,
  items,
  sitePortfolio,
  assignedSourceIds,
  busy,
  onItem,
  onAssign,
  onCreate,
}: {
  expert: Expert;
  items: PortfolioItem[];
  sitePortfolio: SitePortfolioItem[];
  assignedSourceIds: Set<string>;
  busy: string;
  onItem: (
    item: PortfolioItem,
    action: "approve" | "reject" | "delete" | "update",
    extra?: Record<string, unknown>,
  ) => Promise<boolean>;
  onAssign: (id: string) => Promise<boolean>;
  onCreate: (item: ItemDraft) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState<PortfolioItem | "new" | null>(null);
  const [assign, setAssign] = useState("");
  // A website portfolio item can belong to only one expert.
  const available = sitePortfolio.filter((s) => !assignedSourceIds.has(s.id));

  if (editing)
    return (
      <ItemForm
        initial={
          editing === "new"
            ? EMPTY_ITEM
            : {
                title: editing.title,
                description: editing.description ?? "",
                image_url: editing.image_url ?? "",
                external_link: editing.external_link ?? "",
                service_slugs: editing.service_slugs,
                audience_slugs: editing.audience_slugs,
              }
        }
        busy={busy}
        onCancel={() => setEditing(null)}
        onSubmit={async (draft) => {
          const ok =
            editing === "new"
              ? await onCreate(draft)
              : await onItem(editing, "update", { item: draft });
          if (ok) setEditing(null);
        }}
      />
    );

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div className="admin-button-row" style={{ flexWrap: "wrap" }}>
        <button className="admin-button admin-button-primary" onClick={() => setEditing("new")}>
          <Plus size={15} /> Add item
        </button>
        {available.length > 0 && (
          <>
            <select
              className="admin-search"
              style={{ padding: "8px 10px" }}
              value={assign}
              onChange={(e) => setAssign(e.target.value)}
            >
              <option value="">Assign from website portfolio…</option>
              {available.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
            <button
              className="admin-button"
              disabled={!!busy || !assign}
              onClick={async () => {
                if (await onAssign(assign)) setAssign("");
              }}
            >
              <Link2 size={15} /> Assign
            </button>
          </>
        )}
      </div>
      {items.length === 0 ? (
        <div className="admin-empty">
          <h3>No portfolio items</h3>
          <p>
            Add an item for {expert.full_name || "this expert"} or assign one from your website
            portfolio.
          </p>
        </div>
      ) : (
        items.map((item) => (
          <div key={item.id} className="admin-drawer-card">
            <div style={{ display: "flex", gap: 12 }}>
              {item.image_url ? (
                <img
                  src={item.image_url}
                  alt=""
                  style={{
                    width: 64,
                    height: 44,
                    borderRadius: 8,
                    objectFit: "cover",
                    flexShrink: 0,
                  }}
                />
              ) : (
                <span className="admin-action-icon" style={{ width: 64, height: 44 }}>
                  <Images size={16} />
                </span>
              )}
              <div style={{ minWidth: 0 }}>
                <strong>{item.title}</strong>
                <p>
                  {[
                    ...item.service_slugs.map((s) => getCoreService(s)?.name),
                    ...item.audience_slugs.map((s) => getAudience(s)?.name),
                  ]
                    .filter(Boolean)
                    .join(" · ") || (item.description ?? "").slice(0, 90)}
                </p>
                <span
                  className={`admin-status ${item.status === "approved" ? "paid" : item.status === "rejected" ? "overdue" : "pending"}`}
                >
                  {item.status === "approved"
                    ? "Live"
                    : item.status === "rejected"
                      ? "Rejected"
                      : "Pending review"}
                </span>
                {item.source_portfolio_item_id && <small> · Linked to website portfolio</small>}
              </div>
            </div>
            <div className="admin-button-row" style={{ flexWrap: "wrap" }}>
              {item.status !== "approved" && (
                <button
                  className="admin-button admin-button-primary"
                  disabled={!!busy}
                  onClick={() => void onItem(item, "approve")}
                >
                  Approve
                </button>
              )}
              {item.status === "pending" && (
                <button
                  className="admin-button text-destructive"
                  disabled={!!busy}
                  onClick={() => void onItem(item, "reject")}
                >
                  Reject
                </button>
              )}
              <button
                className="admin-icon-button"
                aria-label="Edit"
                onClick={() => setEditing(item)}
              >
                <Pencil size={15} />
              </button>
              <button
                className="admin-icon-button text-destructive"
                aria-label="Delete"
                disabled={!!busy}
                onClick={() =>
                  window.confirm(`Delete "${item.title}"?`) && void onItem(item, "delete")
                }
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function ItemForm({
  initial,
  busy,
  onCancel,
  onSubmit,
}: {
  initial: ItemDraft;
  busy: string;
  onCancel: () => void;
  onSubmit: (draft: ItemDraft) => Promise<void>;
}) {
  const [d, setD] = useState(initial);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const toggle = (list: string[], v: string) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
  return (
    <form
      className="admin-invoice-form"
      onSubmit={(e) => {
        e.preventDefault();
        void onSubmit(d);
      }}
    >
      <div className="admin-setup" style={{ marginBottom: 0 }}>
        {d.image_url ? (
          <img
            src={d.image_url}
            alt=""
            style={{ width: 80, height: 54, borderRadius: 10, objectFit: "cover" }}
          />
        ) : (
          <span className="admin-action-icon" style={{ width: 80, height: 54 }}>
            <ImageUp size={20} />
          </span>
        )}
        <div>
          <strong>Image</strong>
          <p>{uploadError || "Optional. PNG, JPG or WebP."}</p>
        </div>
        <label className="admin-button" style={{ cursor: "pointer" }}>
          {uploading ? "Uploading…" : d.image_url ? "Replace" : "Upload"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            disabled={uploading}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              setUploading(true);
              setUploadError("");
              try {
                const { url } = await uploadAdminMedia(file, "portfolio");
                setD((x) => ({ ...x, image_url: url }));
              } catch (err) {
                setUploadError(err instanceof Error ? err.message : "Upload failed.");
              } finally {
                setUploading(false);
              }
            }}
          />
        </label>
      </div>
      <label>
        Title
        <input
          required
          minLength={2}
          maxLength={150}
          value={d.title}
          onChange={(e) => setD({ ...d, title: e.target.value })}
        />
      </label>
      <label>
        <span style={{ display: "flex", justifyContent: "space-between" }}>
          Description <small>{d.description.length}/600</small>
        </span>
        <textarea
          rows={4}
          maxLength={600}
          value={d.description}
          onChange={(e) => setD({ ...d, description: e.target.value })}
        />
      </label>
      <label>
        Link (optional)
        <input
          type="url"
          placeholder="https://"
          value={d.external_link}
          onChange={(e) => setD({ ...d, external_link: e.target.value })}
        />
      </label>
      <TagPicker
        label="Related services"
        options={CORE_SERVICES.map((s) => [s.slug, s.name])}
        value={d.service_slugs}
        onToggle={(v) => setD({ ...d, service_slugs: toggle(d.service_slugs, v) })}
      />
      <TagPicker
        label="Related audiences"
        options={AUDIENCES.map((a) => [a.slug, a.name])}
        value={d.audience_slugs}
        onToggle={(v) => setD({ ...d, audience_slugs: toggle(d.audience_slugs, v) })}
      />
      <div className="admin-button-row">
        <button className="admin-button admin-button-primary" disabled={!!busy || uploading}>
          {busy ? "Saving…" : "Save item"}
        </button>
        <button type="button" className="admin-button" onClick={onCancel}>
          Cancel
        </button>
      </div>
      <p className="admin-form-note">Items you add or edit here go live straight away.</p>
    </form>
  );
}

function TagPicker({
  label,
  options,
  value,
  onToggle,
}: {
  label: string;
  options: [string, string][];
  value: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div>
      <strong style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{label}</strong>
      <div className="admin-filters" style={{ marginTop: 6 }}>
        {options.map(([slug, name]) => (
          <button
            type="button"
            key={slug}
            className={value.includes(slug) ? "active" : ""}
            aria-pressed={value.includes(slug)}
            onClick={() => onToggle(slug)}
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}

function AccessTab({
  expert,
  busy,
  onSave,
}: {
  expert: Expert;
  busy: string;
  onSave: (role: string, permissions: string[]) => void;
}) {
  const [role, setRole] = useState(expert.role || "contributor");
  const [perms, setPerms] = useState<string[]>(expert.permissions ?? []);
  function pickRole(key: string) {
    setRole(key);
    setPerms([...(EXPERT_ROLES.find((r) => r.key === key)?.permissions ?? [])]);
  }
  function toggle(key: string) {
    const next = perms.includes(key) ? perms.filter((p) => p !== key) : [...perms, key];
    setPerms(next);
    const match = EXPERT_ROLES.find(
      (r) => r.permissions.length === next.length && r.permissions.every((p) => next.includes(p)),
    );
    setRole(match?.key ?? "custom");
  }
  if (expert.is_guest)
    return (
      <div style={{ display: "grid", gap: 16 }}>
        <strong style={{ fontSize: 12 }}>Tools this guest can use</strong>
        <ToolPicker value={perms} onChange={setPerms} />
        <div className="admin-button-row">
          <button
            className="admin-button admin-button-primary"
            disabled={!!busy || perms.length === 0}
            onClick={() => onSave("custom", perms)}
          >
            <ShieldCheck size={15} /> {busy === expert.id + "set_access" ? "Saving…" : "Save tools"}
          </button>
        </div>
        <p className="admin-form-note">
          Guests have no profile or portfolio and never appear on the website. They're emailed when
          their tools change.
        </p>
      </div>
    );
  if (expert.status !== "approved")
    return (
      <div className="admin-empty">
        <h3>Approve this expert first</h3>
        <p>Roles and tools apply once the account is approved.</p>
      </div>
    );
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div>
        {expert.claimed_team_member_id && (
          <div className="admin-notice" style={{ marginBottom: 12 }}>
            On the team — team members are Associates with every expert tool.
          </div>
        )}
        <strong style={{ fontSize: 12 }}>Role</strong>
        <div className="admin-role-grid">
          {EXPERT_ROLES.map((r) => (
            <button
              key={r.key}
              type="button"
              className={`admin-role-card ${role === r.key ? "active" : ""}`}
              onClick={() => pickRole(r.key)}
            >
              <strong>{r.label}</strong>
              <small>{r.hint}</small>
            </button>
          ))}
        </div>
      </div>
      <div>
        <strong style={{ fontSize: 12 }}>
          Tools this expert can use{" "}
          {role === "custom" && <span className="admin-status draft">Custom</span>}
        </strong>
        <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
          <label
            className="admin-drawer-card"
            style={{ flexDirection: "row", alignItems: "center", opacity: 0.7 }}
          >
            <input type="checkbox" checked disabled />{" "}
            <span>
              <strong>Profile & portfolio</strong> <small>Always on</small>
            </span>
          </label>
          {EXPERT_FEATURES.map((f) => (
            <label
              key={f.key}
              className="admin-drawer-card"
              style={{ flexDirection: "row", alignItems: "center", cursor: "pointer" }}
            >
              <input
                type="checkbox"
                checked={perms.includes(f.key)}
                onChange={() => toggle(f.key)}
              />
              <span>
                <strong>{f.label}</strong> <small>{f.hint}</small>
              </span>
            </label>
          ))}
        </div>
      </div>
      <div className="admin-button-row">
        <button
          className="admin-button admin-button-primary"
          disabled={!!busy}
          onClick={() => onSave(role, perms)}
        >
          <ShieldCheck size={15} /> {busy === expert.id + "set_access" ? "Saving…" : "Save access"}
        </button>
      </div>
      <p className="admin-form-note">
        The expert sees new tools the next time they open their workspace. Access is enforced on the
        server.
      </p>
    </div>
  );
}

function toolList(permissions: string[]) {
  const labels = EXPERT_FEATURES.filter((f) => permissions.includes(f.key)).map((f) => f.label);
  return labels.length ? labels.join(", ") : "No tools";
}

function ToolPicker({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {EXPERT_FEATURES.map((f) => (
        <label
          key={f.key}
          className="admin-drawer-card"
          style={{ flexDirection: "row", alignItems: "center", cursor: "pointer" }}
        >
          <input
            type="checkbox"
            checked={value.includes(f.key)}
            onChange={() =>
              onChange(value.includes(f.key) ? value.filter((p) => p !== f.key) : [...value, f.key])
            }
          />
          <span>
            <strong>{f.label}</strong> <small>{f.hint}</small>
          </span>
        </label>
      ))}
    </div>
  );
}

function InviteLinkBox({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="admin-drawer-card admin-invoice-form">
      <label>
        Invite link (works once, expires in 7 days)
        <input readOnly value={link} onFocus={(e) => e.target.select()} />
      </label>
      <div className="admin-button-row">
        <button
          type="button"
          className="admin-button"
          onClick={() =>
            void navigator.clipboard.writeText(link).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 2000);
            })
          }
        >
          <Link2 size={15} /> {copied ? "Copied" : "Copy link"}
        </button>
      </div>
    </div>
  );
}

function InviteGuestDrawer({
  busy,
  feedback,
  link,
  onClose,
  onInvite,
}: {
  busy: string;
  feedback: ReactNode;
  link: string;
  onClose: () => void;
  onInvite: (input: { full_name: string; email: string; permissions: string[] }) => unknown;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [perms, setPerms] = useState<string[]>(["scout"]);
  const sending = busy === "invite-guest";
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onInvite({ full_name: name.trim(), email: email.trim(), permissions: perms });
  }
  return (
    <div
      className="admin-drawer-backdrop"
      role="presentation"
      onClick={(ev) => ev.target === ev.currentTarget && !busy && onClose()}
    >
      <aside className="admin-drawer" role="dialog" aria-modal="true" aria-label="Invite a guest">
        <div className="admin-drawer-head">
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2>Invite a guest</h2>
            <small>
              A guest signs in to the expert workspace and sees only the tools you pick. No profile,
              no portfolio, never shown on the website.
            </small>
          </div>
          <button
            className="admin-icon-button"
            aria-label="Close"
            disabled={!!busy}
            onClick={onClose}
          >
            <X size={17} />
          </button>
        </div>
        {feedback}
        {link ? (
          <>
            <InviteLinkBox link={link} />
            <div className="admin-button-row">
              <button className="admin-button admin-button-primary" onClick={onClose}>
                Done
              </button>
            </div>
          </>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            <form id="invite-guest-form" className="admin-invoice-form" onSubmit={submit}>
              <div className="admin-form-grid">
                <label>
                  Full name
                  <input
                    required
                    minLength={2}
                    maxLength={150}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <label>
                  Email
                  <input
                    type="email"
                    required
                    maxLength={254}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
              </div>
            </form>
            <div>
              <strong style={{ fontSize: 12 }}>Tools they can use</strong>
              <div style={{ marginTop: 8 }}>
                <ToolPicker value={perms} onChange={setPerms} />
              </div>
            </div>
            <div className="admin-button-row">
              <button
                type="submit"
                form="invite-guest-form"
                className="admin-button admin-button-primary"
                disabled={!!busy || perms.length === 0}
              >
                <Mail size={15} /> {sending ? "Sending invite…" : "Send invite"}
              </button>
            </div>
            <p className="admin-form-note">
              They get an email with a one-time link to set their password, then sign in at /expert.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}

function GuestOverview({
  expert,
  busy,
  inviteLink,
  onAct,
  onResend,
  onDelete,
}: {
  expert: Expert;
  busy: string;
  inviteLink: string;
  onAct: (action: ExpertAction, success: string) => void;
  onResend: () => void;
  onDelete: () => void;
}) {
  const pending = !!expert.invite_expires_at;
  const expired = pending && new Date(expert.invite_expires_at!).getTime() < Date.now();
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <DrawerCard
        icon={UserRound}
        title="Guest access"
        text={
          expert.status === "rejected"
            ? "Suspended — cannot sign in."
            : pending
              ? expired
                ? "The invite expired before they set a password. Send a new one."
                : "Invited — waiting for them to set a password."
              : "Active — signs in to the workspace with only their tools."
        }
      >
        {expert.status === "rejected" ? (
          <button
            className="admin-button admin-button-primary"
            disabled={!!busy}
            onClick={() => onAct("approve", "Guest access restored.")}
          >
            <UserCheck size={15} /> Restore access
          </button>
        ) : (
          <>
            <button className="admin-button" disabled={!!busy} onClick={onResend}>
              <Mail size={15} />{" "}
              {busy === expert.id + "resend_invite"
                ? "Sending…"
                : pending
                  ? "Resend invite"
                  : "Send password link"}
            </button>
            <button
              className="admin-button text-destructive"
              disabled={!!busy}
              onClick={() => onAct("reject", "Guest suspended.")}
            >
              <UserX size={15} /> Suspend
            </button>
          </>
        )}
      </DrawerCard>
      {inviteLink && <InviteLinkBox link={inviteLink} />}
      <DrawerCard icon={ShieldCheck} title="Tools" text={toolList(expert.permissions)} />
      <DrawerCard
        icon={Trash2}
        title="Delete guest"
        text="Removes their login for good. Leads and work they created stay."
      >
        <button className="admin-button text-destructive" disabled={!!busy} onClick={onDelete}>
          <Trash2 size={15} /> Delete
        </button>
      </DrawerCard>
    </div>
  );
}

/** Admin can set, replace or remove an expert's Perplexity key. The key is
 *  encrypted on the server and never shown again. */
function ExpertKeyCard({ expertId }: { expertId: string }) {
  const [state, setState] = useState<{ configured: boolean; updatedAt: string | null } | null>(
    null,
  );
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const url = `/api/admin/experts/${expertId}/perplexity-key`;
  useEffect(() => {
    void fetch(url)
      .then((r) => r.json())
      .then((d) => setState({ configured: !!d.configured, updatedAt: d.updatedAt ?? null }))
      .catch(() => setMessage("Could not load the key settings."));
  }, [url]);
  async function save(method: "PUT" | "DELETE") {
    if (method === "DELETE" && !window.confirm("Remove this expert's Perplexity key?")) return;
    setBusy(true);
    setMessage("");
    const res = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      ...(method === "PUT" ? { body: JSON.stringify({ apiKey: value.trim() }) } : {}),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setBusy(false);
    if (!res?.ok) return setMessage(data?.error || "Could not save the key.");
    setState({ configured: !!data.configured, updatedAt: data.updatedAt ?? null });
    setValue("");
    setMessage(method === "PUT" ? "Key saved." : "Key removed.");
  }
  return (
    <DrawerCard
      icon={KeyRound}
      title="Perplexity API key"
      text={
        !state
          ? "Loading…"
          : state.configured
            ? `Saved${state.updatedAt ? ` ${new Date(state.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : ""}. Used for this expert's author email search${" "}and, if they're an Academy trainer, the Practice Room. The key is encrypted and can't be viewed.`
            : "No key saved. Add one so this expert's author email searches (and Academy Practice Room, if they're a trainer) use their own Perplexity account."
      }
    >
      <div className="admin-invoice-form" style={{ width: "100%" }}>
        <label>
          {state?.configured ? "Replace key" : "Key"}
          <input
            type="password"
            autoComplete="off"
            placeholder="pplx-…"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </label>
      </div>
      <button
        className="admin-button admin-button-primary"
        disabled={busy || !value.trim()}
        onClick={() => void save("PUT")}
      >
        <KeyRound size={15} /> {busy ? "Saving…" : state?.configured ? "Replace key" : "Save key"}
      </button>
      {state?.configured && (
        <button
          className="admin-button text-destructive"
          disabled={busy}
          onClick={() => void save("DELETE")}
        >
          <Trash2 size={15} /> Remove
        </button>
      )}
      {message && <small role="status">{message}</small>}
    </DrawerCard>
  );
}

/** What this expert is visibly missing, so the right nudges are pre-ticked. */
function nudgeSuggestions(
  e: Expert,
  items: PortfolioItem[],
  videoCount: number,
  reviewCount: number,
): string[] {
  const out: string[] = [];
  if (e.is_guest) return out;
  if (!e.full_name || !e.headline || !e.summary) out.push("complete_profile");
  if (!e.photo_url) out.push("profile_photo");
  if (!e.bio || e.bio.length < 120) out.push("intro_bio");
  if (!e.is_public && e.profile_status !== "submitted" && e.photo_url && e.bio)
    out.push("submit_profile");
  if (!items.some((i) => i.status !== "rejected")) out.push("portfolio");
  if (!videoCount) out.push("testimonial");
  if (!reviewCount) out.push("client_reviews");
  if (!e.linkedin_url && !e.fiverr_url && !e.upwork_url) out.push("platform_links");
  if (e.academy_trainer && (!e.photo_url || !e.headline)) out.push("academy_trainer");
  return out;
}

function NudgeCard({
  expert,
  busy,
  suggested,
  onSend,
}: {
  expert: Expert;
  busy: string;
  suggested: string[];
  onSend: (keys: string[], note: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [keys, setKeys] = useState<string[]>(suggested);
  const [note, setNote] = useState("");
  // Only nudges that make sense for this expert's access.
  const available = NUDGES.filter((n) => nudgeAvailableFor(n, expert));
  const first = available.find((n) => keys.includes(n.key));
  const sending = busy === expert.id + "nudge";
  return (
    <div className="admin-drawer-card" style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <span className="admin-action-icon" style={{ width: 34, height: 34 }}>
          <Megaphone size={16} />
        </span>
        <div style={{ flex: 1 }}>
          <strong>Nudge {expert.full_name?.split(/\s+/)[0] || "this expert"}</strong>
          <p>
            Send a cheeky (but friendly) reminder by notification and email.
            {suggested.length > 0 && ` ${suggested.length} suggested from what's missing.`}
          </p>
        </div>
        <button className="admin-button" onClick={() => setOpen((v) => !v)}>
          {open ? "Hide" : "Choose nudges"}
        </button>
      </div>
      {open && (
        <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
          <div
            style={{
              display: "grid",
              gap: 6,
              gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
            }}
          >
            {available.map((n) => (
              <label
                key={n.key}
                className="admin-drawer-card"
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 12px",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={keys.includes(n.key)}
                  onChange={() =>
                    setKeys((k) =>
                      k.includes(n.key) ? k.filter((x) => x !== n.key) : [...k, n.key],
                    )
                  }
                />
                <span style={{ fontSize: 13 }}>
                  {n.label}
                  {suggested.includes(n.key) && (
                    <span className="admin-status pending" style={{ marginLeft: 6 }}>
                      Suggested
                    </span>
                  )}
                </span>
              </label>
            ))}
          </div>
          <div className="admin-invoice-form">
            <label>
              Add a personal line (optional)
              <input
                value={note}
                maxLength={500}
                placeholder="e.g. Raphael, the client you pitched last week asked about your portfolio 👀"
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
          </div>
          {first && (
            <div
              style={{
                padding: "14px 16px",
                borderRadius: 14,
                border: "1px dashed var(--border)",
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              <small style={{ opacity: 0.7 }}>
                Preview{keys.length > 1 ? ` (1 of ${keys.length})` : ""}
              </small>
              <p style={{ margin: "4px 0", fontWeight: 700 }}>{first.title}</p>
              <p style={{ margin: 0, opacity: 0.85 }}>{first.lines[0]}</p>
              {note.trim() && <p style={{ margin: "8px 0 0" }}>From the admin: {note.trim()}</p>}
              <p style={{ margin: "8px 0 0", opacity: 0.7 }}>{NUDGE_SIGNOFF}</p>
            </div>
          )}
          <div className="admin-button-row">
            <button
              className="admin-button admin-button-primary"
              disabled={!!busy || !keys.length}
              onClick={async () => {
                if (await onSend(keys, note)) {
                  setNote("");
                  setOpen(false);
                }
              }}
            >
              <Megaphone size={15} />{" "}
              {sending
                ? "Sending…"
                : `Send ${keys.length || ""} nudge${keys.length === 1 ? "" : "s"}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Nudge several experts at once: their own suggestions, or the same set. */
function BulkNudgeDialog({
  experts,
  suggestionsFor,
  onClose,
  onSent,
}: {
  experts: Expert[];
  suggestionsFor: (e: Expert) => string[];
  onClose: () => void;
  onSent: (message: string) => void;
}) {
  const [mode, setMode] = useState<"suggested" | "same">("suggested");
  const [keys, setKeys] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const targets = experts
    .map((e) => ({
      expert: e,
      keys: (mode === "suggested" ? suggestionsFor(e) : keys).filter((k) => {
        const n = NUDGES.find((x) => x.key === k);
        return n ? nudgeAvailableFor(n, e) : false;
      }),
    }))
    .filter((t) => t.keys.length);
  const total = targets.reduce((n, t) => n + t.keys.length, 0);
  const skipped = experts.length - targets.length;
  async function send() {
    setSending(true);
    setError("");
    const res = await fetch("/api/admin/experts/nudge", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        targets: targets.map((t) => ({ id: t.expert.id, keys: t.keys })),
        note,
      }),
    }).catch(() => null);
    const data = (await res?.json().catch(() => ({}))) as {
      error?: string;
      sent?: number;
      people?: number;
    };
    setSending(false);
    if (!res?.ok) return setError(data?.error ?? "Could not send the nudges.");
    onSent(
      `Sent ${data.sent} nudge${data.sent === 1 ? "" : "s"} to ${data.people} expert${data.people === 1 ? "" : "s"}, by notification and email.`,
    );
  }
  return (
    <div className="admin-drawer-backdrop" onClick={onClose}>
      <aside
        className="admin-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-nudge-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="admin-drawer-head">
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 id="bulk-nudge-title">
              Nudge {experts.length} expert{experts.length === 1 ? "" : "s"}
            </h2>
            <small>Cheeky (but friendly) reminders by notification and email.</small>
          </div>
          <button className="admin-icon-button" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div style={{ display: "grid", gap: 14 }}>
          <div className="admin-filters" role="radiogroup" aria-label="Which nudges">
            <button
              role="radio"
              aria-checked={mode === "suggested"}
              className={mode === "suggested" ? "active" : ""}
              onClick={() => setMode("suggested")}
            >
              Each person's suggestions
            </button>
            <button
              role="radio"
              aria-checked={mode === "same"}
              className={mode === "same" ? "active" : ""}
              onClick={() => setMode("same")}
            >
              Same nudges for everyone
            </button>
          </div>
          {mode === "same" && (
            <div
              style={{
                display: "grid",
                gap: 6,
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              }}
            >
              {NUDGES.map((n) => (
                <label
                  key={n.key}
                  className="admin-drawer-card"
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 12px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={keys.includes(n.key)}
                    onChange={() =>
                      setKeys((k) =>
                        k.includes(n.key) ? k.filter((x) => x !== n.key) : [...k, n.key],
                      )
                    }
                  />
                  <span style={{ fontSize: 13 }}>{n.label}</span>
                </label>
              ))}
            </div>
          )}
          <div className="admin-invoice-form">
            <label>
              Add a personal line for everyone (optional)
              <input
                value={note}
                maxLength={500}
                placeholder="e.g. Big client push this week, let's get every profile shining ✨"
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
          </div>
          <div className="admin-drawer-card" style={{ gap: 6 }}>
            <strong style={{ fontSize: 13 }}>Who gets what</strong>
            {experts.map((e) => {
              const t = targets.find((x) => x.expert.id === e.id);
              return (
                <p key={e.id} style={{ margin: 0, fontSize: 13 }}>
                  <b>{e.full_name || e.email}</b>
                  {": "}
                  <span style={{ opacity: 0.75 }}>
                    {t
                      ? t.keys.map((k) => NUDGES.find((n) => n.key === k)?.label).join(", ")
                      : mode === "suggested"
                        ? "nothing missing, skipped"
                        : "none of these apply, skipped"}
                  </span>
                </p>
              );
            })}
          </div>
          {error && (
            <p role="alert" style={{ color: "var(--destructive)", margin: 0 }}>
              {error}
            </p>
          )}
          <div className="admin-button-row">
            <button className="admin-button" onClick={onClose}>
              Cancel
            </button>
            <button
              className="admin-button admin-button-primary"
              disabled={sending || !total}
              onClick={() => void send()}
            >
              <Megaphone size={15} />{" "}
              {sending
                ? "Sending…"
                : `Send ${total} nudge${total === 1 ? "" : "s"} to ${targets.length}${skipped ? ` (skip ${skipped})` : ""}`}
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
