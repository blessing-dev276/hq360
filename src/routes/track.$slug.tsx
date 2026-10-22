import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { TrackerView } from "@/components/trackers/TrackerView";
import type { ClientSnapshot } from "@/lib/trackers/core";

export const Route = createFileRoute("/track/$slug")({
  head: () => ({
    meta: [
      { title: "Your private progress page | HQ360" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: TrackPage,
});

type State =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "locked"; lockedUntil: string | null }
  | { kind: "open"; page: ClientSnapshot };

function TrackPage() {
  const { slug } = Route.useParams();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch(`/api/track/${encodeURIComponent(slug)}`, { credentials: "same-origin" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return setState({ kind: "missing" });
    setState(data.locked ? { kind: "locked", lockedUntil: data.lockedUntil ?? null } : { kind: "open", page: data.page });
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  async function unlock(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/track/${encodeURIComponent(slug)}/unlock`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || "That passcode is not right.");
        if (data.lockedUntil) setState({ kind: "locked", lockedUntil: data.lockedUntil });
        return;
      }
      setPasscode("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="trk-shell">
      {state.kind === "loading" && <p className="trk-meta" aria-live="polite">Loading your page…</p>}
      {state.kind === "missing" && (
        <div className="trk-gate">
          <h1>Page not available</h1>
          <p className="trk-meta">Check the link in your email, or contact your HQ360 expert.</p>
        </div>
      )}
      {state.kind === "locked" && (
        <form className="trk-gate" onSubmit={unlock}>
          <p className="trk-eyebrow">HQ360</p>
          <h1>Your private progress page</h1>
          <p className="trk-meta">Enter the passcode from our email to see the progress of your project.</p>
          <label htmlFor="trk-passcode">Passcode</label>
          <input
            id="trk-passcode"
            name="passcode"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            required
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            aria-describedby={error ? "trk-passcode-error" : undefined}
            aria-invalid={Boolean(error)}
          />
          <button className="trk-button" type="submit" disabled={busy}>
            {busy ? "Checking…" : "View my project"}
          </button>
          {error && (
            <p id="trk-passcode-error" className="trk-error" role="alert">
              {error}
            </p>
          )}
          {state.lockedUntil && !error && (
            <p className="trk-error" role="alert">
              Too many wrong tries. Please wait 15 minutes and try again.
            </p>
          )}
        </form>
      )}
      {state.kind === "open" && (
        <TrackerView
          page={state.page}
          fileHref={(file, mode) =>
            `/api/track/${encodeURIComponent(slug)}/file/${file.id}${mode === "view" ? "" : `?mode=${mode}`}`
          }
        />
      )}
    </main>
  );
}
