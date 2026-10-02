import { useEffect, useState } from "react";
import {
  CreditCard,
  FileText,
  Images,
  LayoutDashboard,
  LogOut,
  ScanSearch,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { ExpertDashboard } from "./ExpertDashboard";
import { ExpertProfileEditor } from "./ExpertProfileEditor";
import { ExpertPortfolio } from "./ExpertPortfolio";
import "@/components/admin/admin-workspace.css";

type Tab = "dashboard" | "profile" | "portfolio";
const NAV = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "profile", label: "My profile", icon: UserRound },
  { id: "portfolio", label: "Portfolio", icon: Images },
] as const;
const COMING_SOON = [
  { label: "Audit", icon: FileText },
  { label: "Scouting", icon: ScanSearch },
  { label: "Invoices", icon: CreditCard },
] as const;

const DESCRIPTIONS: Record<Tab, string> = {
  dashboard: "Your profile, your work and what's next — at a glance.",
  profile: "Tell clients who you help and how you work.",
  portfolio: "Show the work you've delivered. Each item is reviewed before it goes live.",
};

export function ExpertApp() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [logoutError, setLogoutError] = useState("");

  useEffect(() => {
    const sync = () => {
      const value = window.location.hash.slice(1);
      if (NAV.some((item) => item.id === value)) setTab(value as Tab);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
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

  return (
    <div className="admin-workspace">
      <aside className="admin-sidebar">
        <a href="/expert" className="admin-wordmark">
          <Logo variant="mono" size={26} />
        </a>
        <p className="admin-nav-label">WORKSPACE</p>
        <nav aria-label="Expert navigation">
          {NAV.map(({ id, label, icon: Icon }) => (
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
          <p className="admin-nav-label" style={{ marginTop: 18 }}>
            COMING SOON
          </p>
          {COMING_SOON.map(({ label, icon: Icon }) => (
            <button
              key={label}
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
            <h1>{NAV.find((item) => item.id === tab)!.label}</h1>
            <p>{DESCRIPTIONS[tab]}</p>
          </div>
          <div className="admin-account">
            <span className="admin-account-label">
              HQ360 Expert<small>Approved access</small>
            </span>
            <span className="admin-user-avatar">EX</span>
          </div>
        </header>
        <div className="admin-page">
          {tab === "dashboard" ? (
            <ExpertDashboard onNavigate={navigate} />
          ) : tab === "profile" ? (
            <ExpertProfileEditor />
          ) : (
            <ExpertPortfolio />
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
