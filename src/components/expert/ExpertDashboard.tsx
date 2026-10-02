import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  CircleCheck,
  Clock3,
  CreditCard,
  FileText,
  Images,
  ScanSearch,
  UserRound,
} from "lucide-react";
import { initials } from "@/lib/experts";

type Profile = {
  slug: string;
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
  is_public: boolean;
  profile_status: "draft" | "submitted" | "approved" | "changes_requested";
  profile_review_note: string | null;
  permissions?: string[];
};
type PortfolioItem = { id: string; status: "pending" | "approved" | "rejected" };

const COMING_SOON = [
  {
    key: "audit",
    label: "Audit",
    icon: FileText,
    body: "Research-backed growth reports for authors.",
  },
  {
    key: "scout",
    label: "Scouting",
    icon: ScanSearch,
    body: "Discover authors and find contact details.",
  },
  {
    key: "invoices",
    label: "Invoices",
    icon: CreditCard,
    body: "Request invoices for your own clients.",
  },
];

function completeness(p: Profile) {
  const checks: [string, boolean][] = [
    ["Photo", !!p.photo_url],
    ["Name", !!p.full_name],
    ["Headline", !!p.headline],
    ["Short intro", !!p.summary],
    ["About you", (p.bio?.length ?? 0) >= 80],
    ["Specialties", (p.specialties?.length ?? 0) > 0],
    ["Location", !!p.location],
    ["Website or LinkedIn", !!(p.website_url || p.linkedin_url)],
  ];
  return { checks, done: checks.filter(([, ok]) => ok).length };
}

function profileState(p: Profile) {
  if (p.is_public) return { label: "Live", tone: "paid", note: "Your profile is public." };
  if (p.profile_status === "submitted")
    return { label: "In review", tone: "pending", note: "HQ360 is reviewing your profile." };
  if (p.profile_status === "changes_requested")
    return {
      label: "Changes requested",
      tone: "overdue",
      note: p.profile_review_note || "Update your profile and submit it again.",
    };
  return {
    label: "Draft",
    tone: "draft",
    note: "Complete your profile, then submit it for review.",
  };
}

export function ExpertDashboard({
  onNavigate,
}: {
  onNavigate: (tab: "profile" | "portfolio") => void;
}) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([fetch("/api/expert/profile"), fetch("/api/expert/portfolio")])
      .then(async ([p, f]) => {
        const pd = await p.json().catch(() => ({}));
        if (!p.ok) throw new Error(pd.error || "Could not load your dashboard.");
        setProfile(pd.profile);
        const fd = await f.json().catch(() => ({}));
        if (f.ok) setPortfolio(fd.items ?? []);
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Could not load your dashboard."),
      );
  }, []);

  if (error)
    return (
      <div className="admin-alert" role="alert">
        {error}
      </div>
    );
  if (!profile)
    return (
      <div className="admin-empty" role="status">
        Loading your dashboard…
      </div>
    );

  const first = (profile.full_name || "there").split(/\s+/)[0];
  const state = profileState(profile);
  const { checks, done } = completeness(profile);
  const pct = Math.round((done / checks.length) * 100);
  const live = portfolio.filter((i) => i.status === "approved").length;
  const pending = portfolio.filter((i) => i.status === "pending").length;
  const lockedTools = COMING_SOON.filter((t) => !(profile.permissions ?? []).includes(t.key));

  return (
    <div style={{ display: "grid", gap: 22 }}>
      <section className="admin-feature" style={{ minHeight: 0 }}>
        <div
          style={{
            display: "flex",
            gap: 18,
            alignItems: "center",
            position: "relative",
            zIndex: 1,
          }}
        >
          {profile.photo_url ? (
            <img
              src={profile.photo_url}
              alt=""
              style={{ width: 72, height: 72, borderRadius: 18, objectFit: "cover" }}
            />
          ) : (
            <span
              className="admin-action-icon"
              style={{ width: 72, height: 72, fontSize: 22, fontWeight: 700 }}
            >
              {initials(profile.full_name || profile.email)}
            </span>
          )}
          <div>
            <p className="admin-eyebrow">YOUR EXPERT WORKSPACE</p>
            <h2 style={{ marginTop: 6 }}>Welcome back, {first}.</h2>
            <p style={{ margin: "6px 0 0", maxWidth: 520 }}>
              {profile.headline || "Add a headline so clients know what you do."}
            </p>
          </div>
        </div>
        <span className="admin-feature-orbit" aria-hidden="true" />
      </section>

      <div className="admin-stats">
        <div className="admin-stat">
          <div>
            Profile status <UserRound size={18} />
          </div>
          <strong>{state.label}</strong>
          <small>{state.note}</small>
        </div>
        <div className="admin-stat">
          <div>
            Profile completeness <CircleCheck size={18} />
          </div>
          <strong>{pct}%</strong>
          <small>
            {done} of {checks.length} sections filled
          </small>
        </div>
        <div className="admin-stat">
          <div>
            Portfolio <Images size={18} />
          </div>
          <strong>{live} live</strong>
          <small>{pending ? `${pending} waiting for review` : "Nothing waiting for review"}</small>
        </div>
      </div>

      <div className="admin-overview-grid">
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <h2>Finish your profile</h2>
              <p>A complete profile is reviewed faster and converts better.</p>
            </div>
          </div>
          <div className="admin-quick-actions">
            {checks.map(([label, ok]) => (
              <button key={label} onClick={() => onNavigate("profile")}>
                <span className="admin-action-icon" style={{ width: 32, height: 32 }}>
                  {ok ? <CircleCheck size={16} /> : <Clock3 size={16} />}
                </span>
                <span>
                  <strong>{label}</strong>
                  <small>{ok ? "Done" : "Not added yet"}</small>
                </span>
                <ArrowUpRight size={15} />
              </button>
            ))}
          </div>
        </section>

        <div style={{ display: "grid", gap: 22, alignContent: "start" }}>
          <section className="admin-panel">
            <div className="admin-panel-heading">
              <div>
                <h2>Quick actions</h2>
                <p>Everything you can do today.</p>
              </div>
            </div>
            <div className="admin-quick-actions">
              <button onClick={() => onNavigate("profile")}>
                <span className="admin-action-icon">
                  <UserRound size={18} />
                </span>
                <span>
                  <strong>Edit your profile</strong>
                  <small>Photo, bio, specialties and links</small>
                </span>
                <ArrowUpRight size={15} />
              </button>
              <button onClick={() => onNavigate("portfolio")}>
                <span className="admin-action-icon">
                  <Images size={18} />
                </span>
                <span>
                  <strong>Add portfolio work</strong>
                  <small>Show clients what you've delivered</small>
                </span>
                <ArrowUpRight size={15} />
              </button>
              {profile.is_public && (
                <button onClick={() => window.open(`/experts/${profile.slug}`, "_blank")}>
                  <span className="admin-action-icon">
                    <ArrowUpRight size={18} />
                  </span>
                  <span>
                    <strong>View your public page</strong>
                    <small>/experts/{profile.slug}</small>
                  </span>
                  <ArrowUpRight size={15} />
                </button>
              )}
            </div>
          </section>

          {lockedTools.length > 0 && (
            <section className="admin-panel">
              <div className="admin-panel-heading">
                <div>
                  <h2>Coming soon</h2>
                  <p>More tools are on the way to your workspace.</p>
                </div>
              </div>
              <div className="admin-quick-actions">
                {lockedTools.map(({ label, icon: Icon, body }) => (
                  <button key={label} disabled style={{ opacity: 0.65 }}>
                    <span className="admin-action-icon">
                      <Icon size={18} />
                    </span>
                    <span>
                      <strong>{label}</strong>
                      <small>{body}</small>
                    </span>
                    <span className="admin-new">SOON</span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
