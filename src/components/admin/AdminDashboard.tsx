import { Skeleton } from "@/components/ui/skeleton";
import { GlassLoading } from "@/components/ui/glass-loading";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  CreditCard,
  FileText,
  Inbox,
  ScanSearch,
  UserCheck,
} from "lucide-react";
import { money, invoiceStatus, type Invoice } from "@/lib/payments/types";

type Tab = "scout" | "audits" | "experts" | "projects" | "payments" | "work";
type Lead = { id: string; stage: string; project_status: string; next_follow_up: string | null };
type Audit = { id: string; status: string; created_at: string; authors: { name: string } | null };
type Expert = { id: string; status: string; full_name: string | null; email: string };
type InvoiceRequest = {
  id: string;
  status: string;
  buyer_name: string;
  amount_minor: number;
  expert_profiles: { full_name: string | null; email: string } | null;
};

type Data = {
  invoices: Invoice[] | null;
  leads: Lead[] | null;
  audits: Audit[] | null;
  experts: Expert[] | null;
  requests: InvoiceRequest[] | null;
};

async function load<T>(url: string, pick: (body: Record<string, unknown>) => unknown) {
  try {
    const response = await fetch(url);
    const body = await response.json();
    if (!response.ok || body.ok === false) return null;
    return (pick(body) as T) ?? null;
  } catch {
    return null;
  }
}

const today = () => new Date().toISOString().slice(0, 10);

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
    ]).then(([invoices, leads, audits, experts, requests]) => {
      if (active) setData({ invoices, leads, audits, experts, requests });
    });
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
  const pendingExperts = data?.experts?.filter((e) => e.status === "pending") ?? [];
  const pendingRequests = data?.requests?.filter((r) => r.status === "pending") ?? [];
  const show = (value: string | number, source: unknown) =>
    !data ? "…" : source === null ? "—" : value;

  const stats = [
    {
      label: "Payments received",
      value: show(sum(paid), data?.invoices),
      detail: `${paid.length} paid USD invoices`,
      icon: CreditCard,
    },
    {
      label: "Awaiting payment",
      value: show(sum(pending), data?.invoices),
      detail: `${pending.length} open USD invoices`,
      icon: FileText,
    },
    {
      label: "Active projects",
      value: show(activeProjects.length, data?.leads),
      detail: `${followUps.length} follow-ups due`,
      icon: BriefcaseBusiness,
    },
    {
      label: "Audits",
      value: show(data?.audits?.length ?? 0, data?.audits),
      detail: `${auditsInReview.length} awaiting review`,
      icon: ScanSearch,
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
  ];

  return (
    <>
      <div className="admin-stats admin-stats-4">
        {stats.map(({ label, value, detail, icon: Icon }) => (
          <div className="admin-stat" key={label}>
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
          </div>
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
              <h2>Quick actions</h2>
              <p>Jump straight into the work.</p>
            </div>
          </div>
          <div className="admin-quick-actions">
            {(
              [
                ["payments", CreditCard, "Create an invoice", "Bill a client in a few clicks"],
                ["scout", ScanSearch, "Scout new authors", "Search reviews and build a batch"],
                ["audits", FileText, "Start an audit", "Research and publish an author audit"],
                [
                  "work",
                  BriefcaseBusiness,
                  "Update website content",
                  "Work, team and testimonials",
                ],
              ] as const
            ).map(([tab, Icon, title, detail]) => (
              <button key={title} onClick={() => onNavigate(tab)}>
                <span className="admin-action-icon">
                  <Icon size={20} />
                </span>
                <span>
                  <strong>{title}</strong>
                  <small>{detail}</small>
                </span>
                <ArrowRight size={17} />
              </button>
            ))}
          </div>
        </section>
      </div>

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
                      <span className={`admin-status ${invoiceStatus(i)}`}>{invoiceStatus(i)}</span>
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
    </>
  );
}
