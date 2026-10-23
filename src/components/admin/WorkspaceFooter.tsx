import { ArrowUpRight, LogOut, Settings, Users } from "lucide-react";
import { cn } from "@/lib/utils";

type WorkspaceFooterProps = {
  role: "admin" | "expert";
  settingsActive: boolean;
  onSettings: () => void;
  onSignOut: () => void;
  logoutError?: string;
};

export function WorkspaceFooter({
  role,
  settingsActive,
  onSettings,
  onSignOut,
  logoutError,
}: WorkspaceFooterProps) {
  const destination =
    role === "admin"
      ? { href: "/", label: "View website", icon: ArrowUpRight }
      : { href: "/experts", label: "Experts directory", icon: Users };
  const DestinationIcon = destination.icon;

  return (
    <div className="admin-sidebar-bottom">
      <button
        type="button"
        onClick={onSettings}
        className={cn("admin-nav-item", settingsActive && "active")}
        aria-current={settingsActive ? "page" : undefined}
      >
        <Settings size={18} aria-hidden="true" />
        <span>Settings</span>
      </button>
      <a
        href={destination.href}
        target="_blank"
        rel="noopener noreferrer"
        className="admin-nav-item"
      >
        <DestinationIcon size={18} aria-hidden="true" />
        <span>{destination.label}</span>
      </a>
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
  );
}
