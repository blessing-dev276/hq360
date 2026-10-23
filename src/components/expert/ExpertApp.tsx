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
  ScanSearch,
  UserRound,
  type LucideIcon,
  GraduationCap,
  ListChecks,
  Lock,
  Settings,
} from "lucide-react";
import { ClientTrackers } from "./ClientTrackers";
import { AssistantDrawer, ClientTrackingModes } from "@/components/expert/TrackerAssistant";
import { SettingsPage } from "@/components/settings/SettingsPage";
import { TrackerPortfolioDrafts } from "./TrackerPortfolioDrafts";
import { NoAccess } from "./NoAccess";
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
import { TrainerTools } from "@/components/academy/TrainerTools";
import { WorkspaceFooter } from "@/components/admin/WorkspaceFooter";
import "@/components/academy/academy.css";
import "@/components/admin/admin-workspace.css";

type Tab =
  | "dashboard"
  | "profile"
  | "portfolio"
  | "leads"
  | "trackers"
  | "settings"
  | "academy"
  | ExpertFeature;
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
  {
    id: "trackers",
    label: "Client tracking",
    icon: ListChecks,
    description: "Private, passcode protected progress pages for each client.",
  },
];
const SETTINGS: NavItem = {
  id: "settings",
  label: "Settings",
  icon: Settings,
  description: "Your AI keys, used everywhere in your workspace, plus account and appearance.",
};
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
  // Experts the admin made Author Scout Academy trainers get Trainer tools here.
  const [academyTrainer, setAcademyTrainer] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [salesView, setSalesView] = useState<SalesView>("proposals");
  const [email, setEmail] = useState<string>();

  const unlocked = TOOLS.filter((t) => permissions.includes(t.id));
  const locked = TOOLS.filter((t) => !permissions.includes(t.id));
  const academyItem: NavItem = {
    id: "academy",
    label: "Academy trainer",
    icon: GraduationCap,
    description: "Author Scout Academy: your trainees' progress, chats and the practice content.",
  };
  // Guests only get the tools the admin granted (plus Leads with Scouting),
  // but they see everything an expert sees: the rest opens a locked page.
  const guestCore = CORE.filter((c) => c.id === "leads" && permissions.includes("scout"));
  const nav = [
    ...(guest ? guestCore : CORE),
    ...unlocked,
    ...(academyTrainer ? [academyItem] : []),
  ];
  const lockedNav: NavItem[] = [
    ...(guest ? CORE.filter((c) => !guestCore.includes(c)) : []),
    ...locked,
    ...(academyTrainer ? [] : [academyItem]),
  ];
  const allNav = [...nav, ...lockedNav, SETTINGS];

  useEffect(() => {
    fetch("/api/expert/profile")
      .then((r) => r.json())
      .then((data) => {
        setPermissions(data.profile?.permissions ?? []);
        setEmail(data.profile?.email ?? undefined);
        setRole(data.profile?.role ?? "contributor");
        setAcademyTrainer(Boolean(data.profile?.academy_trainer));
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
      if (allNav.some((item) => item.id === value)) setTab(value as Tab);
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
  const current = allNav.find((item) => item.id === tab) ?? nav[0] ?? CORE[0]!;
  const isLocked = lockedNav.some((item) => item.id === current.id);

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
          {lockedNav.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => navigate(id)}
              className={cn("admin-nav-item", tab === id && "active")}
              aria-current={tab === id ? "page" : undefined}
              title={`${label}: not unlocked yet`}
              style={{ opacity: tab === id ? 1 : 0.6 }}
            >
              <Icon size={18} />
              <span>{label}</span>
              <Lock size={13} aria-label="Locked" style={{ marginLeft: "auto" }} />
            </button>
          ))}
        </nav>
        <WorkspaceFooter
          role="expert"
          settingsActive={tab === "settings"}
          onSettings={() => navigate("settings")}
          onSignOut={() => void signOut()}
          logoutError={logoutError}
        />
      </aside>
      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar-title">
            <p className="admin-eyebrow">HQ360 · Expert workspace</p>
            <h1>{current.label}</h1>
            <p>{current.description}</p>
          </div>
          <div className="admin-account">
            {guest ? (
              <button
                type="button"
                className="admin-button ta-launch"
                onClick={() => navigate("trackers")}
                title="AI Assistant: experts only"
              >
                <Lock size={14} aria-hidden="true" /> <span>AI Assistant</span>
              </button>
            ) : (
              <AssistantDrawer
                onOpen={(page) => {
                  if (nav.some((item) => item.id === page)) navigate(page as Tab);
                }}
              />
            )}
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
          {current.id === "settings" ? (
            <SettingsPage guest={guest} email={email} onSignOut={() => void signOut()} />
          ) : isLocked ? (
            <NoAccess tool={current.id} label={current.label} guest={guest} />
          ) : current.id === "dashboard" ? (
            <ExpertDashboard onNavigate={navigate} />
          ) : current.id === "profile" ? (
            <ExpertProfileEditor />
          ) : current.id === "leads" ? (
            <LeadsWorkspace scope="expert" />
          ) : current.id === "trackers" ? (
            <ClientTrackingModes manual={() => <ClientTrackers />} />
          ) : current.id === "portfolio" ? (
            <>
              <TrackerPortfolioDrafts />
              <ExpertPortfolio />
              <ExpertTestimonials />
              <ExpertReviews />
            </>
          ) : current.id === "academy" ? (
            <div className="asa" style={{ background: "transparent", minHeight: 0 }}>
              <TrainerTools keyInSettings />
            </div>
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
