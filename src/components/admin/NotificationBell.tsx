import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";

type Notification = {
  id: string;
  created_at: string;
  kind: string;
  title: string;
  body: string;
  tab: string | null;
  read_at: string | null;
};

const POLL_MS = 30000;

function timeAgo(value: string) {
  const seconds = Math.max(0, (Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** Header bell for the admin and expert workspaces. Polls while the tab is visible. */
export function NotificationBell({
  endpoint,
  onNavigate,
}: {
  endpoint: "/api/admin/notifications" | "/api/expert/notifications";
  onNavigate: (tab: string) => void;
}) {
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      if (!response.ok) throw new Error();
      const data = (await response.json()) as { items: Notification[]; unread: number };
      setItems(data.items);
      setUnread(data.unread);
      setError(false);
    } catch {
      setError(true);
    }
  }, [endpoint]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && void load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function mark(body: { all: true } | { ids: string[] }) {
    const now = new Date().toISOString();
    const ids = "ids" in body ? new Set(body.ids) : null;
    setItems((list) =>
      list.map((n) => (!n.read_at && (!ids || ids.has(n.id)) ? { ...n, read_at: now } : n)),
    );
    setUnread((count) => (ids ? Math.max(0, count - ids.size) : 0));
    await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    void load();
  }

  return (
    <div className="admin-notify" ref={root}>
      <button
        type="button"
        className="admin-notify-button"
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          setOpen((value) => !value);
          if (!open) void load();
        }}
      >
        <Bell size={18} />
        {unread > 0 && <span className="admin-notify-badge">{unread > 99 ? "99+" : unread}</span>}
      </button>
      {open && (
        <div className="admin-notify-panel" role="dialog" aria-label="Notifications">
          <div className="admin-notify-head">
            <strong>Notifications</strong>
            {unread > 0 && (
              <button
                type="button"
                className="admin-text-button"
                onClick={() => void mark({ all: true })}
              >
                <CheckCheck size={14} /> Mark all read
              </button>
            )}
          </div>
          {error && !items.length ? (
            <p className="admin-notify-empty">Notifications couldn't load. Try again shortly.</p>
          ) : !items.length ? (
            <p className="admin-notify-empty">You're all caught up.</p>
          ) : (
            <ul>
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={cn("admin-notify-item", !n.read_at && "unread")}
                    onClick={() => {
                      if (!n.read_at) void mark({ ids: [n.id] });
                      if (n.tab) onNavigate(n.tab);
                      setOpen(false);
                    }}
                  >
                    <span className="admin-notify-dot" aria-hidden="true" />
                    <span>
                      <strong>{n.title}</strong>
                      {n.body && <small>{n.body}</small>}
                      <time dateTime={n.created_at}>{timeAgo(n.created_at)}</time>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
