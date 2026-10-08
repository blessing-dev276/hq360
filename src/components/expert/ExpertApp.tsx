import { PerplexitySettings } from "./PerplexitySettings";
import { QuotesWorkspace } from "@/components/quotes/QuotesWorkspace";
import { ProposalsWorkspace } from "@/components/proposals/ProposalsWorkspace";
import { SalesTabs, type SalesView } from "@/components/sales/SalesTabs";
import { useEffect, useState } from "react";
import { PanelRefreshButton } from "@/components/admin/PanelRefreshButton";
import { NotificationBell } from "@/components/admin/NotificationBell";
import { PanelThemeToggle } from "@/components/admin/PanelThemeToggle";
import {
  BriefcaseBusiness,
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
import { getSupabase } from "@/integrations/supabase/lazy";
import { Logo } from "@/components/Logo";
import { ScoutApp } from "@/components/admin/ScoutApp";
import { AuthorAuditAdmin } from "@/components/admin/AuthorAuditAdmin";
import { roleLabel, type ExpertFeature } from "@/lib/expert-roles";
import { ExpertDashboard } from "./ExpertDashboard";
import { ExpertProfileEditor } from "./ExpertProfileEditor";
import { ExpertPortfolio } from "./ExpertPortfolio";
import { ExpertTestimonials } from "./ExpertTestimonials";
import { ExpertReviews } from "./ExpertReviews";
import { ExpertAuditLink } from "./ExpertAuditLink";
import { ExpertInvoiceRequests } from "./ExpertInvoiceRequests";
import { LeadsWorkspace } from "@/components/admin/LeadsAdmin";
import "@/components/admin/admin-workspace.css";

type Tab = "dashboard" | "profile" | "portfolio" | "leads" | ExpertFeature;
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
  {
    id: "leads",
    label: "Leads & Projects",
    icon: BriefcaseBusiness,
    description: "Your own clients — from Scouting saves and your referral link to delivery.",
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
    label: "Sales",
    icon: CreditCard,
    description: "Proposals, quotes and invoices for your clients: pitch, price, get paid.",
  },
];

export function ExpertApp() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [permissions, setPermissions] = useState<string[]>([]);
  const [role, setRole] = useState("contributor");
  // Guests have no profile: only the tools the admin granted them.
  const [guest, setGuest] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [salesView, setSalesView] = useState<SalesView>("proposals");

  const unlocked = TOOLS.filter((t) => permissions.includes(t.id));
  const locked = guest ? [] : TOOLS.filter((t) => !permissions.includes(t.id));
  const nav = guest
    ? [...CORE.filter((c) => c.id === "leads" && permissions.includes("scout")), ...unlocked]
    : [...CORE, ...unlocked];

  useEffect(() => {
    fetch("/api/expert/profile")
      .then((r) => r.json())
      .then((data) => {
        setPermissions(data.profile?.permissions ?? []);
        setRole(data.profile?.role ?? "contributor");
        if (data.profile?.is_guest) {
          setGuest(true);
          const tools: string[] = data.profile.permissions ?? [];
          // Open their first tool instead of the (profile) dashboard.
          const first = TOOLS.find((t) => tools.includes(t.id));
          if (first && !window.location.hash) setTab(first.id);
        }
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
      await (await getSupabase()).auth.signOut();
      window.location.assign("/expert");
    } catch {
      setLogoutError("Could not sign out. Please try again.");
    }
  }
  const current = nav.find((item) => item.id === tab) ?? nav[0] ?? CORE[0]!;

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
          {!guest && (
            <a href="/experts" target="_blank" rel="noreferrer" className="admin-nav-item">
              <UserRound size={18} />
              Experts directory
            </a>
          )}
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
            <PanelThemeToggle />
            <PanelRefreshButton onRefresh={() => setRefreshKey((k) => k + 1)} />
            <NotificationBell
              endpoint="/api/expert/notifications"
              onNavigate={(value) => {
                if (nav.some((item) => item.id === value)) navigate(value as Tab);
              }}
            />
            <span className="admin-account-label">
              {guest ? "HQ360 Guest" : "HQ360 Expert"}
              <small>{guest ? "Guest access" : roleLabel(role)}</small>
            </span>
            <span className="admin-user-avatar">{guest ? "GU" : "EX"}</span>
          </div>
        </header>
        <div className="admin-page" key={refreshKey}>
          {guest && nav.length === 0 ? (
            <div className="admin-empty">
              <h3>No tools yet</h3>
              <p>HQ360 hasn't given you access to any tools right now.</p>
            </div>
          ) : current.id === "dashboard" ? (
            <ExpertDashboard onNavigate={navigate} />
          ) : current.id === "profile" ? (
            <ExpertProfileEditor />
          ) : current.id === "leads" ? (
            <LeadsWorkspace scope="expert" />
          ) : current.id === "portfolio" ? (
            <>
              <ExpertPortfolio />
              <ExpertTestimonials />
              <ExpertReviews />
            </>
          ) : current.id === "scout" ? (
            <>
              <PerplexitySettings />
              <ScoutApp canFindEmail={permissions.includes("scout")} />
            </>
          ) : current.id === "audit" ? (
            <>
              <ExpertAuditLink />
              <AuthorAuditAdmin />
            </>
          ) : (
            <SalesTabs view={salesView} onSelect={setSalesView}>
              {salesView === "proposals" ? (
                <ProposalsWorkspace />
              ) : salesView === "quotes" ? (
                <QuotesWorkspace />
              ) : (
                <ExpertInvoiceRequests />
              )}
            </SalesTabs>
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
