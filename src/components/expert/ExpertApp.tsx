import { useEffect, useState } from "react";
import { ChevronRight, LogOut, ScanSearch, Command } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { AuthorAuditAdmin } from "@/components/admin/AuthorAuditAdmin";
import { ScoutApp } from "@/components/admin/ScoutApp";
import "@/components/admin/admin-workspace.css";

type Tab = "reports" | "scout";
const NAV = [
  { id: "reports", label: "Author Reports", icon: ScanSearch },
  { id: "scout", label: "Scout", icon: ScanSearch },
] as const;

export function ExpertApp() {
  const [tab, setTab] = useState<Tab>("reports");
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
          <span className="admin-brand-icon">
            <Command size={21} />
          </span>{" "}
          HQ360<span className="admin-wordmark-dot">.</span>
        </a>
        <div className="admin-workspace-label">
          <span className="admin-workspace-avatar">EX</span>
          <div>
            HQ360 workspace<small>Expert access</small>
          </div>
          <ChevronRight size={14} />
        </div>
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
        </nav>
        <div className="admin-sidebar-bottom">
          <button className="admin-nav-item" onClick={() => void signOut()}>
            <LogOut size={18} />
            Sign out
          </button>
          {logoutError && <p role="alert">{logoutError}</p>}
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-breadcrumb">
            Workspace <ChevronRight size={14} />
            <strong>{NAV.find((item) => item.id === tab)!.label}</strong>
          </div>
        </header>
        <div className="admin-page">
          {tab === "reports" ? <AuthorAuditAdmin /> : <ScoutApp />}
          <footer className="admin-footer">
            <span>HQ360 · Expert workspace</span>
            <span>Private workspace</span>
          </footer>
        </div>
      </div>
    </div>
  );
}
