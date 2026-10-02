import { useEffect, useState } from "react";
import { NotificationBell } from "@/components/admin/NotificationBell";
import {
  CreditCard,
  FileText,
  Images,
  LayoutDashboard,
  LogOut,
  ScanSearch,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { ScoutApp } from "@/components/admin/ScoutApp";
import { AuthorAuditAdmin } from "@/components/admin/AuthorAuditAdmin";
import { roleLabel, type ExpertFeature } from "@/lib/expert-roles";
import { ExpertDashboard } from "./ExpertDashboard";
import { ExpertProfileEditor } from "./ExpertProfileEditor";
import { ExpertPortfolio } from "./ExpertPortfolio";
import { ExpertTestimonials } from "./ExpertTestimonials";
import { ExpertAuditLink } from "./ExpertAuditLink";
import { ExpertInvoiceRequests } from "./ExpertInvoiceRequests";
import "@/components/admin/admin-workspace.css";

type Tab = "dashboard" | "profile" | "portfolio" | ExpertFeature;
type NavItem = { id: Tab; label: string; icon: LucideIcon; description: string };

const CORE: NavItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    description: "Your profile, your work and what's next — at a glance.",
  },
  {
    id: "profile",
    label: "My profile",
    icon: UserRound,
    description: "Tell clients who you help and how you work.",
  },
  {
    id: "portfolio",
    label: "Portfolio",
    icon: Images,
    description: "Show the work you've delivered. Each item is reviewed before it goes live.",
  },
];
/** Tools an admin can grant by role; locked ones show as "Coming soon". */
const TOOLS: (NavItem & { id: ExpertFeature })[] = [
  {
    id: "audit",
    label: "Audit",
    icon: FileText,
    description: "Turn research into a clear growth direction for every author.",
  },
  {
    id: "scout",
    label: "Scouting",
    icon: ScanSearch,
    description: "Discover authors, review batches and find contact information.",
  },
  {
    id: "invoices",
    label: "Invoices",
    icon: CreditCard,
    description: "Request invoices for your clients and follow each payment.",
  },
];

export function ExpertApp() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [permissions, setPermissions] = useState<string[]>([]);
  const [role, setRole] = useState("contributor");
  const [logoutError, setLogoutError] = useState("");

  const unlocked = TOOLS.filter((t) => permissions.includes(t.id));
  const locked = TOOLS.filter((t) => !permissions.includes(t.id));
  const nav = [...CORE, ...unlocked];

  useEffect(() => {
    fetch("/api/expert/profile")
      .then((r) => r.json())
      .then((data) => {
        setPermissions(data.profile?.permissions ?? []);
        setRole(data.profile?.role ?? "contributor");
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    const sync = () => {
      const value = window.location.hash.slice(1);
      if (nav.some((item) => item.id === value)) setTab(value as Tab);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
    // Re-sync once permissions load so a deep link to a granted tool opens it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissions]);
  function navigate(value: Tab) {
    setTab(value);
    window.location.hash = value;
  }
  async function signOut() {
    try {
      await fetch("/api/expert/session", { method: "DELETE" });
      await supabase.auth.signOut();
      window.location.assign("/expert");
    } catch {
      setLogoutError("Could not sign out. Please try again.");
    }
  }
  const current = nav.find((item) => item.id === tab) ?? CORE[0]!;

  return (
    <div className="admin-workspace">
      <aside className="admin-sidebar">
        <a href="/expert" className="admin-wordmark">
          <Logo variant="mono" size={26} />
        </a>
        <p className="admin-nav-label">WORKSPACE</p>
        <nav aria-label="Expert navigation">
          {nav.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => navigate(id)}
              className={cn("admin-nav-item", tab === id && "active")}
              aria-current={tab === id ? "page" : undefined}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
          {locked.length > 0 && (
            <p className="admin-nav-label" style={{ marginTop: 18 }}>
              COMING SOON
            </p>
          )}
          {locked.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className="admin-nav-item"
              disabled
              title={`${label} is coming soon`}
              style={{ opacity: 0.5, cursor: "not-allowed" }}
            >
              <Icon size={18} />
              <span>{label}</span>
              <span className="admin-new">SOON</span>
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-bottom">
          <a href="/experts" target="_blank" rel="noreferrer" className="admin-nav-item">
            <UserRound size={18} />
            Experts directory
          </a>
          <button className="admin-nav-item" onClick={() => void signOut()}>
            <LogOut size={18} />
            Sign out
          </button>
          {logoutError && <p role="alert">{logoutError}</p>}
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar-title">
            <p className="admin-eyebrow">HQ360 · Expert workspace</p>
            <h1>{current.label}</h1>
            <p>{current.description}</p>
          </div>
          <div className="admin-account">
            <NotificationBell
              endpoint="/api/expert/notifications"
              onNavigate={(value) => {
                if (nav.some((item) => item.id === value)) navigate(value as Tab);
              }}
            />
            <span className="admin-account-label">
              HQ360 Expert<small>{roleLabel(role)}</small>
            </span>
            <span className="admin-user-avatar">EX</span>
          </div>
        </header>
        <div className="admin-page">
          {current.id === "dashboard" ? (
            <ExpertDashboard onNavigate={navigate} />
          ) : current.id === "profile" ? (
            <ExpertProfileEditor />
          ) : current.id === "portfolio" ? (
            <>
              <ExpertPortfolio />
              <ExpertTestimonials />
            </>
          ) : current.id === "scout" ? (
            <ScoutApp />
          ) : current.id === "audit" ? (
            <>
              <ExpertAuditLink />
              <AuthorAuditAdmin />
            </>
          ) : (
            <ExpertInvoiceRequests />
          )}
          <footer className="admin-footer">
            <span>HQ360 · Expert workspace</span>
            <span>Private workspace</span>
          </footer>
        </div>
      </div>
    </div>
  );
}
