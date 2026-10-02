import { useEffect, useState } from "react";
import { CreditCard, FileText, LogOut, ScanSearch, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { ScoutApp } from "@/components/admin/ScoutApp";
import { ExpertProfileEditor } from "./ExpertProfileEditor";
import { ExpertInvoiceRequests } from "./ExpertInvoiceRequests";
import "@/components/admin/admin-workspace.css";

type Tab = "profile" | "reports" | "scout" | "invoices";
const NAV = [
  { id: "profile", label: "My profile", icon: UserRound },
  { id: "reports", label: "Audit", icon: FileText },
  { id: "scout", label: "Scouting", icon: ScanSearch },
  { id: "invoices", label: "Invoices", icon: CreditCard },
] as const;

const DESCRIPTIONS: Record<Tab, string> = {
  profile: "Tell clients who you help and bring your work together in one profile.",
  reports: "Turn research into a clear growth direction for every author.",
  scout: "Discover authors, review batches and find contact information.",
  invoices: "Request invoices and follow each payment to the end.",
};

export function ExpertApp() {
  const [tab, setTab] = useState<Tab>("profile");
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
          {tab === "profile" ? (
            <ExpertProfileEditor />
          ) : tab === "reports" ? (
            <section className="rounded-2xl border border-border bg-card p-8 sm:p-12">
              <FileText className="mb-5 size-10 text-muted-foreground" />
              <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-brand">
                Coming soon
              </span>
              <h2 className="mt-5 font-display text-3xl">Audit</h2>
              <p className="mt-3 max-w-lg text-muted-foreground">
                Audit is coming to your expert workspace. You can explore authors and their book
                reviews in Scouting today.
              </p>
              <button
                onClick={() => navigate("scout")}
                className="mt-6 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
              >
                Open Scouting
              </button>
            </section>
          ) : tab === "invoices" ? (
            <ExpertInvoiceRequests />
          ) : (
            <ScoutApp />
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
