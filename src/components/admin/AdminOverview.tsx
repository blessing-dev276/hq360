import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  CreditCard,
  BriefcaseBusiness,
  ScanSearch,
  Users,
  ArrowRight,
  CircleCheck,
  FileText,
} from "lucide-react";
import { money, invoiceStatus, type Invoice } from "@/lib/payments/types";

export function AdminOverview({
  onNavigate,
}: {
  onNavigate: (tab: "payments" | "work" | "team" | "audits") => void;
}) {
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [error, setError] = useState("");
  const [demo, setDemo] = useState(false);
  useEffect(() => {
    let active = true;
    fetch("/api/admin/invoices")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (active) {
          setInvoices(data.invoices);
          setDemo(data.setup?.environment === "demo");
        }
      })
      .catch(() => {
        if (active) setError("Connect invoice storage to see your financial overview.");
      });
    return () => {
      active = false;
    };
  }, []);
  const paid = invoices?.filter((i) => i.status === "paid") ?? [];
  const pending = invoices?.filter((i) => i.status === "pending") ?? [];
  const stats = [
    {
      label: "Payments received",
      value: money(paid.reduce((s, i) => s + i.amount_minor, 0)),
      detail: `${paid.length} paid invoices`,
      icon: CreditCard,
    },
    {
      label: "Awaiting payment",
      value: money(pending.reduce((s, i) => s + i.amount_minor, 0)),
      detail: `${pending.length} open invoices`,
      icon: FileText,
    },
    {
      label: "Invoices created",
      value: String(invoices?.length ?? 0).padStart(2, "0"),
      detail: "Your latest 1,000 invoices",
      icon: CircleCheck,
    },
  ];
  return (
    <>
      {demo && (
        <p className="admin-form-note mb-4">
          Test workspace · Figures below reflect demo invoices, not real payments.
        </p>
      )}
      <div className="admin-stats">
        {stats.map(({ label, value, detail, icon: Icon }) => (
          <div className="admin-stat" key={label}>
            <div>
              {label}
              <Icon size={18} />
            </div>
            <strong>{invoices ? value : "—"}</strong>
            <small>
              {error ? "Storage not connected" : invoices ? detail : "Loading your activity…"}
            </small>
          </div>
        ))}
      </div>
      <div className="admin-overview-grid">
        <section className="admin-feature">
          <p className="admin-eyebrow">INTRODUCING PAYMENTS</p>
          <h2>
            Great work.
            <br />
            Seamless payments.
          </h2>
          <p>
            Send a professional invoice. Give your buyers a simple way to pay. Keep every
            transaction in view.
          </p>
          <button
            className="admin-button admin-button-light"
            onClick={() => onNavigate("payments")}
          >
            Open payments <ArrowUpRight size={17} />
          </button>
          <div className="admin-feature-orbit" aria-hidden="true">
            <CreditCard size={62} strokeWidth={1} />
          </div>
          <span className="admin-feature-foot">POWERED BY REMITA</span>
        </section>
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <h2>Make your next move</h2>
              <p>Everything you need to keep moving.</p>
            </div>
          </div>
          <div className="admin-quick-actions">
            {(
              [
                {
                  tab: "work",
                  title: "Curate your portfolio",
                  detail: "Put your latest projects in the spotlight",
                  icon: BriefcaseBusiness,
                },
                {
                  tab: "audits",
                  title: "Manage author audits",
                  detail: "Research, review and publish insights",
                  icon: ScanSearch,
                },
                {
                  tab: "team",
                  title: "Meet the team",
                  detail: "Keep your people and profiles up to date",
                  icon: Users,
                },
              ] as const
            ).map(({ tab, title, detail, icon: Icon }) => (
              <button key={tab} onClick={() => onNavigate(tab)}>
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
            <p>A little clarity on your latest activity.</p>
          </div>
          <button className="admin-text-button" onClick={() => onNavigate("payments")}>
            View all <ArrowUpRight size={16} />
          </button>
        </div>
        {invoices?.length ? (
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
                    <td>
                      <button className="admin-text-button" onClick={() => onNavigate("payments")}>
                        {i.number}
                      </button>
                    </td>
                    <td>{i.buyer_name}</td>
                    <td className="admin-numeric">{money(i.amount_minor)}</td>
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
            <h3>
              {error
                ? "Your financial overview starts here"
                : invoices
                  ? "Your first invoice is a fresh start"
                  : "Loading your activity…"}
            </h3>
            <p>{error || "Create an invoice and your latest activity will appear here."}</p>
            <button className="admin-text-button" onClick={() => onNavigate("payments")}>
              Go to payments <ArrowRight size={16} />
            </button>
          </div>
        )}
      </section>
    </>
  );
}
