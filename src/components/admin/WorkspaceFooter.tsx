import { ArrowUpRight, GraduationCap, LogOut, Settings, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

type WorkspaceFooterProps = {
  role: "admin" | "expert";
  email?: string;
  settingsActive: boolean;
  onSettings: () => void;
  onSignOut: () => void;
  logoutError?: string;
};

export function WorkspaceFooter({
  role,
  email,
  settingsActive,
  onSettings,
  onSignOut,
  logoutError,
}: WorkspaceFooterProps) {
  const links = [
    { href: "/experts", label: "Experts directory", icon: UserRound },
    { href: "/academy", label: "Academy", icon: GraduationCap },
    { href: "/", label: "View website", icon: ArrowUpRight },
  ];

  return (
    <div className="admin-sidebar-bottom">
      <div className="admin-sidebar-identity">
        <span className="admin-sidebar-avatar" aria-hidden="true">
          {role === "admin" ? "A" : (email?.[0] ?? "E").toUpperCase()}
        </span>
        <span className="admin-sidebar-identity-copy">
          <strong>{role === "admin" ? "Admin workspace" : "Expert workspace"}</strong>
          <small>{email || (role === "admin" ? "HQ360 management" : "Your account")}</small>
        </span>
      </div>
      <p className="admin-sidebar-section-label">ACCOUNT & LINKS</p>
      <button
        type="button"
        onClick={onSettings}
        className={cn("admin-nav-item", settingsActive && "active")}
        aria-current={settingsActive ? "page" : undefined}
      >
        <Settings size={18} aria-hidden="true" />
        <span>Settings</span>
      </button>
      {links.map(({ href, label, icon: Icon }) => (
        <a
          key={href}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="admin-nav-item"
        >
          <Icon size={18} aria-hidden="true" />
          <span>{label}</span>
          <ArrowUpRight className="admin-sidebar-external" size={14} aria-hidden="true" />
        </a>
      ))}
      <div className="admin-sidebar-signout">
        <button type="button" className="admin-nav-item" onClick={onSignOut}>
          <LogOut size={18} aria-hidden="true" />
          <span>Sign out</span>
        </button>
        {logoutError && (
          <p className="admin-sidebar-error" role="alert">
            {logoutError}
          </p>
        )}
      </div>
    </div>
  );
}
