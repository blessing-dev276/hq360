import { useEffect, useState } from "react";
import { KeyRound } from "lucide-react";

/** Read-only key status for Scouting. Keys are managed only in Settings → AI keys. */
export function PerplexitySettings({ admin = false }: { admin?: boolean }) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/expert/ai-key", {
      signal: controller.signal,
      headers: admin ? { "x-hq360-actor": "admin" } : {},
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!controller.signal.aborted) setConfigured(Boolean(data?.perplexity?.configured));
      })
      .catch(() => {});
    return () => controller.abort();
  }, [admin]);
  if (configured === null) return null;
  return (
    <p className="mx-auto my-4 flex max-w-6xl items-center gap-2 rounded-2xl border border-border bg-card px-5 py-3 text-sm">
      <KeyRound size={16} aria-hidden="true" />
      {configured
        ? "Email search uses the Perplexity key saved in Settings."
        : admin
          ? "No admin Perplexity key saved; email search uses the server key if one is set."
          : "Add your Perplexity key to search for author emails."}{" "}
      <a href="#settings" className="text-brand underline">
        {configured ? "Manage in Settings" : "Add it in Settings"}
      </a>
    </p>
  );
}
