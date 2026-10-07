import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";

function visitorId() {
  try {
    let id = sessionStorage.getItem("hq360-visitor");
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem("hq360-visitor", id);
    }
    return id;
  } catch {
    return null;
  }
}

/** Sends one anonymous page-view beacon per route change; respects a declined cookie choice. */
export function VisitTracker() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    try {
      if (localStorage.getItem("hq360-cookie-consent") === "declined") return;
    } catch {
      return;
    }
    const id = visitorId();
    if (!id) return;
    const body = JSON.stringify({ visitorId: id, path, referrer: document.referrer || undefined });
    if (
      !navigator.sendBeacon?.("/api/public/visit", new Blob([body], { type: "application/json" }))
    )
      void fetch("/api/public/visit", { method: "POST", body, keepalive: true }).catch(() => {});
  }, [path]);
  return null;
}
