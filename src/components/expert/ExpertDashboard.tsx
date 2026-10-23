import { GlassLoading } from "@/components/ui/glass-loading";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  CircleCheck,
  CreditCard,
  FileText,
  Images,
  ListChecks,
  Lock,
  ScanSearch,
  Sparkles,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { initials } from "@/lib/experts";
import { openAssistant } from "./TrackerAssistant";

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
type Tracker = {
  id: string;
  client_name: string;
  project_title: string;
  status: string;
  progress: number;
  published_at: string | null;
  viewsThisWeek: number;
};
type Lead = { id: string; name: string; stage: string; next_follow_up: string | null };
type Page = "profile" | "portfolio" | "leads" | "trackers" | "audit" | "scout" | "invoices";

const TOOLS: { key: Page; label: string; icon: LucideIcon; body: string }[] = [
  { key: "audit", label: "Audit", icon: FileText, body: "Research-backed growth reports" },
  { key: "scout", label: "Scouting", icon: ScanSearch, body: "Find authors and their contacts" },
  { key: "invoices", label: "Sales", icon: CreditCard, body: "Proposals, quotes and invoices" },
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
  if (p.is_public) return { label: "Live", note: "Your profile is public." };
  if (p.profile_status === "submitted")
    return { label: "In review", note: "HQ360 is reviewing your profile." };
  if (p.profile_status === "changes_requested")
    return {
      label: "Changes requested",
      note: p.profile_review_note || "Update your profile and submit it again.",
    };
  return { label: "Draft", note: "Complete your profile, then submit it for review." };
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

async function get<T>(url: string, pick: (b: Record<string, unknown>) => unknown) {
  try {
    const r = await fetch(url);
    const b = await r.json();
    return r.ok && b.ok !== false ? ((pick(b) as T) ?? null) : null;
  } catch {
    return null;
  }
}

/** Circular completeness meter. */
function Ring({ pct }: { pct: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <svg className="xd-ring" viewBox="0 0 80 80" role="img" aria-label={`${pct}% complete`}>
      <circle cx="40" cy="40" r={r} className="xd-ring-track" />
      <circle
        cx="40"
        cy="40"
        r={r}
        className="xd-ring-fill"
        strokeDasharray={c}
        strokeDashoffset={c - (pct / 100) * c}
      />
      <text x="40" y="45" textAnchor="middle">
        {pct}%
      </text>
    </svg>
  );
}

export function ExpertDashboard({ onNavigate }: { onNavigate: (tab: Page) => void }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [trackers, setTrackers] = useState<Tracker[] | null>(null);
  const [leads, setLeads] = useState<Lead[] | null>(null);
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
    void get<Tracker[]>("/api/expert/trackers", (b) => b.trackers).then((t) =>
      setTrackers(t ?? []),
    );
    void get<Lead[]>("/api/expert/leads", (b) => b.items).then((l) => setLeads(l ?? []));
  }, []);

  if (error)
    return (
      <div className="admin-alert" role="alert">
        {error}
      </div>
    );
  if (!profile)
    return (
      <div className="space-y-6">
        <GlassLoading label="Loading your dashboard…" variant="stats" />
        <GlassLoading label="Loading your checklist…" variant="list" rows={4} />
      </div>
    );

  const first = (profile.full_name || "there").split(/\s+/)[0];
  const state = profileState(profile);
  const { checks, done } = completeness(profile);
  const pct = Math.round((done / checks.length) * 100);
  const live = portfolio.filter((i) => i.status === "approved").length;
  const pending = portfolio.filter((i) => i.status === "pending").length;
  const perms = profile.permissions ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const due = (leads ?? []).filter(
    (l) => l.next_follow_up && l.next_follow_up <= today && l.stage !== "lost" && l.stage !== "won",
  );
  const liveTrackers = (trackers ?? []).filter((t) => t.published_at && t.status !== "archived");
  const views = (trackers ?? []).reduce((n, t) => n + (t.viewsThisWeek ?? 0), 0);

  // The few things most worth doing next, in order.
  const steps: { title: string; detail: string; to: Page; icon: LucideIcon }[] = [];
  if (profile.profile_status === "changes_requested")
    steps.push({ title: "Fix your profile", detail: state.note, to: "profile", icon: UserRound });
  else if (done < checks.length)
    steps.push({
      title: "Finish your profile",
      detail: `Still missing: ${checks
        .filter(([, ok]) => !ok)
        .map(([l]) => l)
        .slice(0, 3)
        .join(", ")}`,
      to: "profile",
      icon: UserRound,
    });
  else if (!profile.is_public && profile.profile_status !== "submitted")
    steps.push({
      title: "Submit your profile",
      detail: "It's complete. Send it to HQ360 to go live.",
      to: "profile",
      icon: UserRound,
    });
  if (due.length)
    steps.push({
      title: `${due.length} follow-up${due.length === 1 ? "" : "s"} due`,
      detail: due
        .slice(0, 3)
        .map((l) => l.name)
        .join(", "),
      to: "leads",
      icon: BriefcaseBusiness,
    });
  const unpublished = (trackers ?? []).filter((t) => !t.published_at);
  if (unpublished.length)
    steps.push({
      title: "Publish client updates",
      detail: `${unpublished[0]!.client_name} can't see their page yet`,
      to: "trackers",
      icon: ListChecks,
    });
  if (!live && !pending)
    steps.push({
      title: "Add your first portfolio piece",
      detail: "Show clients what you've delivered",
      to: "portfolio",
      icon: Images,
    });

  const stats = [
    {
      label: "Profile",
      value: state.label,
      detail: state.note,
      icon: UserRound,
      to: "profile" as Page,
    },
    {
      label: "Live client pages",
      value: trackers ? String(liveTrackers.length) : null,
      detail: `${views} client views this week`,
      icon: ListChecks,
      to: "trackers" as Page,
    },
    {
      label: "Leads",
      value: leads ? String(leads.length) : null,
      detail: due.length ? `${due.length} follow-ups due` : "No follow-ups due",
      icon: BriefcaseBusiness,
      to: "leads" as Page,
    },
    {
      label: "Portfolio",
      value: `${live} live`,
      detail: pending ? `${pending} waiting for review` : "Nothing waiting for review",
      icon: Images,
      to: "portfolio" as Page,
    },
  ];

  return (
    <div className="hqd-dash">
      <section className="hqd-hero xd-hero">
        <div className="xd-who">
          {profile.photo_url ? (
            <img src={profile.photo_url} alt="" className="xd-avatar" />
          ) : (
            <span className="xd-avatar xd-avatar-initials">
              {initials(profile.full_name || profile.email)}
            </span>
          )}
          <div>
            <p className="admin-eyebrow">
              {new Date().toLocaleDateString("en-GB", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </p>
            <h2>
              {greeting()}, {first}.
            </h2>
            <p>
              {steps.length
                ? `${steps.length} thing${steps.length === 1 ? "" : "s"} worth doing today. ${liveTrackers.length} client page${liveTrackers.length === 1 ? " is" : "s are"} live.`
                : "You're all caught up. Nice work."}
            </p>
          </div>
        </div>
        <button
          type="button"
          className="hqd-ask"
          onClick={() => openAssistant("What should I focus on today?")}
        >
          <span className="siri-orb" aria-hidden="true" />
          <span>
            <strong>Ask the AI Assistant</strong>
            <small>"What should I focus on today?"</small>
          </span>
          <Sparkles size={15} aria-hidden="true" />
        </button>
      </section>

      <div className="admin-stats admin-stats-4">
        {stats.map(({ label, value, detail, icon: Icon, to }) => (
          <button
            type="button"
            className="admin-stat hqd-stat"
            key={label}
            onClick={() => onNavigate(to)}
          >
            <div>
              {label}
              <Icon size={18} />
            </div>
            {value === null ? (
              <>
                <Skeleton width="45%" height={30} style={{ margin: "18px 0 10px" }} />
                <Skeleton width="70%" height={10} />
              </>
            ) : (
              <>
                <strong className="hq-fade-in">{value}</strong>
                <small className="hq-fade-in">{detail}</small>
              </>
            )}
          </button>
        ))}
      </div>

      <div className="admin-overview-grid">
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <h2>Up next</h2>
              <p>The most useful things to do right now.</p>
            </div>
          </div>
          {steps.length ? (
            <div className="admin-quick-actions">
              {steps.map(({ title, detail, to, icon: Icon }) => (
                <button key={title} onClick={() => onNavigate(to)}>
                  <span className="admin-action-icon">
                    <Icon size={18} />
                  </span>
                  <span>
                    <strong>{title}</strong>
                    <small>{detail}</small>
                  </span>
                  <ArrowRight size={17} />
                </button>
              ))}
            </div>
          ) : (
            <div className="expert-complete">
              <span className="admin-action-icon" style={{ width: 44, height: 44 }}>
                <CircleCheck size={22} />
              </span>
              <div style={{ flex: 1 }}>
                <strong>Nothing waiting on you</strong>
                <small>Ask the AI Assistant for ideas, or add new work to your portfolio.</small>
              </div>
            </div>
          )}
        </section>

        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <h2>Your profile</h2>
              <p>
                {done === checks.length
                  ? "Every section is filled in."
                  : `${checks.length - done} sections left. Complete profiles are reviewed faster.`}
              </p>
            </div>
          </div>
          <div className="xd-profile">
            <Ring pct={pct} />
            <div className="expert-done-chips" style={{ padding: 0 }}>
              {checks.map(([label, ok]) => (
                <span key={label} className={ok ? "" : "xd-missing"}>
                  {ok ? <CircleCheck size={12} /> : <span className="xd-dot" />} {label}
                </span>
              ))}
            </div>
          </div>
          <div className="xd-profile-actions">
            <button className="admin-button" onClick={() => onNavigate("profile")}>
              Edit profile
            </button>
            {profile.is_public && (
              <a
                className="admin-button"
                href={`/experts/${profile.slug}`}
                target="_blank"
                rel="noreferrer"
              >
                View public page <ArrowUpRight size={15} />
              </a>
            )}
          </div>
        </section>
      </div>

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <h2>Your workspace</h2>
            <p>Everything you can use, and what you can unlock.</p>
          </div>
        </div>
        <div className="hqd-areas">
          {(
            [
              {
                key: "leads",
                label: "Leads & Projects",
                icon: BriefcaseBusiness,
                body: "Clients from lead to delivery",
              },
              {
                key: "trackers",
                label: "Client tracking",
                icon: ListChecks,
                body: "Private progress pages",
              },
              {
                key: "portfolio",
                label: "Portfolio",
                icon: Images,
                body: "Work, testimonials and reviews",
              },
              ...TOOLS,
            ] as typeof TOOLS
          ).map(({ key, label, icon: Icon, body }) => {
            const locked = TOOLS.some((t) => t.key === key) && !perms.includes(key);
            return (
              <button
                type="button"
                key={key}
                className={`hqd-area${locked ? " xd-locked" : ""}`}
                onClick={() => onNavigate(key)}
              >
                <span className="admin-action-icon">
                  <Icon size={18} />
                </span>
                <strong>
                  {label} {locked && <Lock size={12} aria-label="Locked" />}
                </strong>
                <small>{locked ? "Not unlocked yet. Tap to request it." : body}</small>
              </button>
            );
          })}
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <h2>Client tracking</h2>
            <p>How your clients' projects are moving.</p>
          </div>
          <button className="admin-text-button" onClick={() => onNavigate("trackers")}>
            Open <ArrowUpRight size={16} />
          </button>
        </div>
        <div style={{ padding: "0 25px 22px" }}>
          {!trackers ? (
            <GlassLoading label="Loading trackers…" variant="table" rows={3} />
          ) : trackers.length ? (
            <ul className="hqd-trackers">
              {trackers.slice(0, 6).map((t) => (
                <li key={t.id}>
                  <span>
                    <strong>{t.client_name}</strong>
                    <small>
                      {t.project_title} ·{" "}
                      {t.published_at ? `${t.viewsThisWeek} views this week` : "Not published"}
                    </small>
                  </span>
                  <span className="hqd-progress" aria-label={`${t.progress}% complete`}>
                    <span style={{ width: `${t.progress}%` }} />
                  </span>
                  <small className="admin-numeric">{t.progress}%</small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="settings-muted">
              No client pages yet.{" "}
              <button
                type="button"
                className="admin-text-button"
                style={{ display: "inline" }}
                onClick={() => openAssistant()}
              >
                Ask the AI Assistant to create one
              </button>
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
