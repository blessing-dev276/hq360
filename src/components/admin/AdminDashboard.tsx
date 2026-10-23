import { Skeleton } from "@/components/ui/skeleton";
import { GlassLoading } from "@/components/ui/glass-loading";
import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  CreditCard,
  FileText,
  Globe2,
  GraduationCap,
  Inbox,
  ListChecks,
  Mail,
  ScanSearch,
  Sparkles,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import { money, invoiceStatus, type Invoice } from "@/lib/payments/types";
import { openAssistant } from "@/components/expert/TrackerAssistant";

type Tab =
  | "scout"
  | "outreach"
  | "audits"
  | "experts"
  | "projects"
  | "payments"
  | "proposals"
  | "work"
  | "academy"
  | "trackers"
  | "visitors";
type Lead = { id: string; stage: string; project_status: string; next_follow_up: string | null };
type Audit = { id: string; status: string; created_at: string; authors: { name: string } | null };
type Expert = {
  id: string;
  status: string;
  full_name: string | null;
  email: string;
  is_guest?: boolean;
};
type InvoiceRequest = {
  id: string;
  status: string;
  buyer_name: string;
  amount_minor: number;
  expert_profiles: { full_name: string | null; email: string } | null;
};
type Tracker = {
  id: string;
  client_name: string;
  status: string;
  progress: number;
  published_at: string | null;
  viewsThisWeek: number;
};
type Visitors = {
  views: number;
  visitors: number;
  daily: { date: string; views: number; visitors: number }[];
};
type Outreach = {
  items: {
    id: string;
    recipient: string;
    subject: string;
    workflow: string;
    created_at: string;
    is_test: boolean;
  }[];
  total: number;
};
type Chat = { id: string; user: string; created_at: string; score: number | null };
type Proposal = { id: string; title: string; sent_at: string | null; views: number };
type Quote = { id: string; views: number };

type Data = {
  invoices: Invoice[] | null;
  leads: Lead[] | null;
  audits: Audit[] | null;
  experts: Expert[] | null;
  requests: InvoiceRequest[] | null;
  trackers: Tracker[] | null;
  visitors: Visitors | null;
  outreach: Outreach | null;
  chats: Chat[] | null;
  proposals: Proposal[] | null;
  quotes: Quote[] | null;
};

async function load<T>(
  url: string,
  pick: (body: Record<string, unknown>) => unknown,
  init?: RequestInit,
) {
  try {
    const response = await fetch(url, init);
    const body = await response.json();
    if (!response.ok || body.ok === false) return null;
    return (pick(body) as T) ?? null;
  } catch {
    return null;
  }
}

const today = () => new Date().toISOString().slice(0, 10);
const weekAgo = () => new Date(Date.now() - 7 * 86400000).toISOString();

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

/** Tiny bar chart of daily visitors; the latest day is highlighted. */
function VisitorBars({ daily }: { daily: Visitors["daily"] }) {
  const max = Math.max(1, ...daily.map((d) => d.visitors));
  return (
    <div className="wsd-bars" role="img" aria-label="Daily website visitors, last 14 days">
      {daily.map((d, i) => (
        <span
          key={d.date}
          title={`${d.date}: ${d.visitors} visitors, ${d.views} views`}
          className={i === daily.length - 1 ? "now" : ""}
          style={{ height: `${Math.max(4, (d.visitors / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

export function AdminDashboard({ onNavigate }: { onNavigate: (tab: Tab) => void }) {
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([
      load<Invoice[]>("/api/admin/invoices", (b) => b.invoices),
      load<Lead[]>("/api/admin/leads", (b) => b.items),
      load<Audit[]>("/api/admin/author-audits", (b) => b.items),
      load<Expert[]>("/api/admin/experts", (b) => b.experts),
      load<InvoiceRequest[]>("/api/admin/invoice-requests", (b) => b.requests),
      load<Tracker[]>("/api/expert/trackers", (b) => b.trackers, {
        headers: { "x-hq360-actor": "admin" },
      }),
      load<Visitors>("/api/admin/visitors?days=14", (b) => b),
      load<Outreach>("/api/admin/author-outreach?kind=authors", (b) => b),
      load<Chat[]>("/api/admin/academy-control?view=chats", (b) => b.chats),
      load<Proposal[]>("/api/admin/proposals", (b) => b.items),
      load<Quote[]>("/api/admin/quotes", (b) => b.items),
    ]).then(
      ([
        invoices,
        leads,
        audits,
        experts,
        requests,
        trackers,
        visitors,
        outreach,
        chats,
        proposals,
        quotes,
      ]) => {
        if (active)
          setData({
            invoices,
            leads,
            audits,
            experts,
            requests,
            trackers,
            visitors,
            outreach,
            chats,
            proposals,
            quotes,
          });
      },
    );
    return () => {
      active = false;
    };
  }, []);

  const invoices = data?.invoices ?? [];
  const usd = (status: string) =>
    invoices.filter((i) => i.status === status && i.currency === "USD");
  const sum = (list: Invoice[]) => money(list.reduce((s, i) => s + i.amount_minor, 0));
  const paid = usd("paid");
  const pending = usd("pending");
  const activeProjects =
    data?.leads?.filter((l) => l.project_status !== "not_started" || l.stage === "won") ?? [];
  const followUps =
    data?.leads?.filter(
      (l) => l.next_follow_up && l.next_follow_up <= today() && l.stage !== "lost",
    ) ?? [];
  const auditsInReview =
    data?.audits?.filter(
      (a) => a.status === "needs_verification" || a.status === "ready_for_review",
    ) ?? [];
  const experts = data?.experts ?? [];
  const pendingExperts = experts.filter((e) => e.status === "pending");
  const approvedExperts = experts.filter((e) => e.status === "approved" && !e.is_guest);
  const guests = experts.filter((e) => e.is_guest);
  const pendingRequests = data?.requests?.filter((r) => r.status === "pending") ?? [];
  const trackers = data?.trackers ?? [];
  const liveTrackers = trackers.filter((t) => t.published_at && t.status !== "archived");
  const unpublished = trackers.filter((t) => !t.published_at);
  const trackerViews = trackers.reduce((n, t) => n + (t.viewsThisWeek ?? 0), 0);
  const daily = data?.visitors?.daily ?? [];
  const visitors7 = daily.slice(-7).reduce((n, d) => n + d.visitors, 0);
  const visitorsPrev7 = daily.slice(-14, -7).reduce((n, d) => n + d.visitors, 0);
  const visitorTrend = visitorsPrev7
    ? Math.round(((visitors7 - visitorsPrev7) / visitorsPrev7) * 100)
    : null;
  const outreach = data?.outreach?.items ?? [];
  const outreachWeek = outreach.filter((o) => o.created_at >= weekAgo()).length;
  const chatsWeek = data?.chats?.filter((c) => c.created_at >= weekAgo()) ?? [];
  const proposals = data?.proposals ?? [];
  const draftProposals = proposals.filter((p) => !p.sent_at);
  const show = (value: string | number, source: unknown) =>
    !data ? "…" : source === null ? "—" : value;

  const kpis: { label: string; value: ReactNode; detail: string; icon: LucideIcon; tab: Tab }[] = [
    {
      label: "Payments received",
      value: show(sum(paid), data?.invoices),
      detail: `${paid.length} paid USD invoices`,
      icon: CreditCard,
      tab: "payments",
    },
    {
      label: "Awaiting payment",
      value: show(sum(pending), data?.invoices),
      detail: `${pending.length} open USD invoices`,
      icon: FileText,
      tab: "payments",
    },
    {
      label: "Active projects",
      value: show(activeProjects.length, data?.leads),
      detail: `${followUps.length} follow-ups due`,
      icon: BriefcaseBusiness,
      tab: "projects",
    },
    {
      label: "Visitors · 7 days",
      value: show(visitors7, data?.visitors),
      detail:
        visitorTrend === null
          ? "Website traffic"
          : `${visitorTrend >= 0 ? "▲" : "▼"} ${Math.abs(visitorTrend)}% vs last week`,
      icon: Globe2,
      tab: "visitors",
    },
  ];

  const attention = [
    {
      tab: "payments" as const,
      icon: Inbox,
      title: "Invoice requests from experts",
      count: pendingRequests.length,
      detail: pendingRequests[0]
        ? `Latest: ${pendingRequests[0].buyer_name} · ${money(pendingRequests[0].amount_minor)}`
        : "Nothing waiting",
    },
    {
      tab: "experts" as const,
      icon: UserCheck,
      title: "Expert accounts to approve",
      count: pendingExperts.length,
      detail: pendingExperts[0]
        ? `Latest: ${pendingExperts[0].full_name || pendingExperts[0].email}`
        : "Nothing waiting",
    },
    {
      tab: "audits" as const,
      icon: ScanSearch,
      title: "Audits awaiting review",
      count: auditsInReview.length,
      detail: auditsInReview[0]?.authors?.name
        ? `Next: ${auditsInReview[0].authors.name}`
        : "Nothing waiting",
    },
    {
      tab: "projects" as const,
      icon: BriefcaseBusiness,
      title: "Follow-ups due",
      count: followUps.length,
      detail: followUps.length ? "Due today or overdue" : "You're all caught up",
    },
    {
      tab: "trackers" as const,
      icon: ListChecks,
      title: "Trackers not published",
      count: unpublished.length,
      detail: unpublished[0]
        ? `e.g. ${unpublished[0].client_name}`
        : "Every client can see their page",
    },
  ];

  const areas: {
    tab: Tab;
    icon: LucideIcon;
    title: string;
    metric: string;
    note: string;
    source: unknown;
  }[] = [
    {
      tab: "scout",
      icon: ScanSearch,
      title: "Scouting",
      metric: "Find authors",
      note: "Genres, batches and verified emails",
      source: true,
    },
    {
      tab: "outreach",
      icon: Mail,
      title: "Author Outreach",
      metric: `${outreachWeek} this week`,
      note: `${data?.outreach?.total ?? 0} author emails in total`,
      source: data?.outreach,
    },
    {
      tab: "audits",
      icon: FileText,
      title: "Audit",
      metric: `${data?.audits?.length ?? 0} audits`,
      note: `${auditsInReview.length} awaiting review`,
      source: data?.audits,
    },
    {
      tab: "proposals",
      icon: CreditCard,
      title: "Sales",
      metric: `${proposals.length} proposals`,
      note: `${draftProposals.length} drafts · ${data?.quotes?.length ?? 0} quotes`,
      source: data?.proposals,
    },
    {
      tab: "trackers",
      icon: ListChecks,
      title: "Client tracking",
      metric: `${liveTrackers.length} live`,
      note: `${trackerViews} client views this week`,
      source: data?.trackers,
    },
    {
      tab: "experts",
      icon: UserCheck,
      title: "Experts",
      metric: `${approvedExperts.length} experts`,
      note: `${guests.length} guests · ${pendingExperts.length} pending`,
      source: data?.experts,
    },
    {
      tab: "academy",
      icon: GraduationCap,
      title: "Academy",
      metric: `${chatsWeek.length} practice chats`,
      note: "In the last 7 days",
      source: data?.chats,
    },
    {
      tab: "work",
      icon: BriefcaseBusiness,
      title: "Website content",
      metric: "Work, team, reviews",
      note: "What visitors see on hq360.space",
      source: true,
    },
  ];
  const attentionCount = attention.reduce((n, a) => n + a.count, 0);

  return (
    <div className="wsd-dash">
      <section className="wsd-hero">
        <div>
          <p className="admin-eyebrow">
            {new Date().toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
          <h2>{greeting()}. Here's HQ360 today.</h2>
          <p>
            {!data
              ? "Gathering everything across the workspace…"
              : attentionCount
                ? `${attentionCount} thing${attentionCount === 1 ? "" : "s"} waiting on you, ${liveTrackers.length} client pages live and ${visitors7} website visitors this week.`
                : `Nothing is waiting on you. ${liveTrackers.length} client pages are live and ${visitors7} people visited the website this week.`}
          </p>
        </div>
        <button
          type="button"
          className="wsd-ask"
          onClick={() => openAssistant("What needs my attention today?")}
        >
          <span className="siri-orb" aria-hidden="true" />
          <span>
            <strong>Ask the AI Assistant</strong>
            <small>"What needs my attention today?"</small>
          </span>
          <Sparkles size={15} aria-hidden="true" />
        </button>
      </section>

      <div className="admin-stats admin-stats-4">
        {kpis.map(({ label, value, detail, icon: Icon, tab }) => (
          <button
            type="button"
            className="admin-stat wsd-stat"
            key={label}
            onClick={() => onNavigate(tab)}
          >
            <div>
              {label}
              <Icon size={18} />
            </div>
            {data ? (
              <>
                <strong className="hq-fade-in">{value}</strong>
                <small className="hq-fade-in">{detail}</small>
              </>
            ) : (
              <>
                <Skeleton width="55%" height={30} style={{ margin: "18px 0 10px" }} />
                <Skeleton width="70%" height={10} />
              </>
            )}
          </button>
        ))}
      </div>

      <div className="admin-overview-grid">
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <h2>Needs your attention</h2>
              <p>What's waiting on you across the workspace.</p>
            </div>
          </div>
          <div className="admin-quick-actions">
            {attention.map(({ tab, icon: Icon, title, count, detail }) => (
              <button key={title} onClick={() => onNavigate(tab)}>
                <span className="admin-action-icon">
                  <Icon size={20} />
                </span>
                <span>
                  <strong>{title}</strong>
                  {data ? (
                    <small className="hq-fade-in">{detail}</small>
                  ) : (
                    <Skeleton width="60%" height={9} style={{ marginTop: 6 }} />
                  )}
                </span>
                {data && count > 0 && <span className="admin-count">{count}</span>}
                <ArrowRight size={17} />
              </button>
            ))}
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <h2>Website traffic</h2>
              <p>Unique visitors per day, last 14 days.</p>
            </div>
            <button className="admin-text-button" onClick={() => onNavigate("visitors")}>
              Details <ArrowUpRight size={16} />
            </button>
          </div>
          <div style={{ padding: "0 25px 22px" }}>
            {!data ? (
              <Skeleton width="100%" height={120} />
            ) : daily.length ? (
              <>
                <VisitorBars daily={daily} />
                <div className="wsd-mini-stats">
                  <span>
                    <strong>{data.visitors?.visitors ?? 0}</strong> visitors
                  </span>
                  <span>
                    <strong>{data.visitors?.views ?? 0}</strong> page views
                  </span>
                  <span>
                    <strong>{trackerViews}</strong> tracker views
                  </span>
                </div>
              </>
            ) : (
              <p className="settings-muted">Visitor stats aren't available yet.</p>
            )}
          </div>
        </section>
      </div>

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <h2>Your workspace</h2>
            <p>Every area of HQ360, with what's happening in each.</p>
          </div>
        </div>
        <div className="wsd-areas">
          {areas.map(({ tab, icon: Icon, title, metric, note, source }) => (
            <button type="button" key={title} className="wsd-area" onClick={() => onNavigate(tab)}>
              <span className="admin-action-icon">
                <Icon size={18} />
              </span>
              <strong>{title}</strong>
              {!data ? (
                <Skeleton width="60%" height={10} />
              ) : (
                <>
                  <span className="wsd-area-metric hq-fade-in">
                    {source === null ? "—" : metric}
                  </span>
                  <small className="hq-fade-in">{note}</small>
                </>
              )}
            </button>
          ))}
        </div>
      </section>

      <div className="admin-overview-grid">
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <h2>Recent invoices</h2>
              <p>Your latest billing activity.</p>
            </div>
            <button className="admin-text-button" onClick={() => onNavigate("payments")}>
              View all <ArrowUpRight size={16} />
            </button>
          </div>
          {!data ? (
            <div style={{ padding: "0 25px 22px" }}>
              <GlassLoading label="Loading recent invoices…" variant="table" rows={5} />
            </div>
          ) : invoices.length ? (
            <div className="admin-table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Buyer</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.slice(0, 5).map((i) => (
                    <tr key={i.id}>
                      <td className="admin-invoice-name">{i.number}</td>
                      <td>{i.buyer_name}</td>
                      <td className="admin-numeric">{money(i.amount_minor, i.currency)}</td>
                      <td>
                        <span className={`admin-status ${invoiceStatus(i)}`}>
                          {invoiceStatus(i)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="admin-empty">
              <span className="admin-empty-icon">
                <FileText size={25} />
              </span>
              <h3>No invoices yet</h3>
              <p>Create an invoice and your latest billing activity will appear here.</p>
            </div>
          )}
        </section>

        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <h2>Client tracking</h2>
              <p>Live progress pages, most recently updated first.</p>
            </div>
            <button className="admin-text-button" onClick={() => onNavigate("trackers")}>
              Open <ArrowUpRight size={16} />
            </button>
          </div>
          <div style={{ padding: "0 25px 22px" }}>
            {!data ? (
              <GlassLoading label="Loading trackers…" variant="table" rows={4} />
            ) : trackers.length ? (
              <ul className="wsd-trackers">
                {trackers.slice(0, 5).map((t) => (
                  <li key={t.id}>
                    <span>
                      <strong>{t.client_name}</strong>
                      <small>
                        {t.published_at ? `${t.viewsThisWeek} views this week` : "Not published"}
                      </small>
                    </span>
                    <span className="wsd-progress" aria-label={`${t.progress}% complete`}>
                      <span style={{ width: `${t.progress}%` }} />
                    </span>
                    <small className="admin-numeric">{t.progress}%</small>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="settings-muted">
                No client trackers yet. Ask the AI Assistant to create one.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
