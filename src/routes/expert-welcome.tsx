import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowUpRight } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { GlassLoading } from "@/components/ui/glass-loading";
import { getSupabase } from "@/integrations/supabase/lazy";

export const Route = createFileRoute("/expert-welcome")({
  head: () => ({
    meta: [
      { title: "Set your password | HQ360" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: ExpertWelcome,
});

/** Landing page for a guest invite link: set a password, then open /expert. */
function ExpertWelcome() {
  const [token, setToken] = useState("");
  const [invite, setInvite] = useState<{ email: string; full_name: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("token") ?? "";
    setToken(value);
    // Keep the one-time token out of history and later referrers.
    window.history.replaceState(null, "", "/expert-welcome");
    fetch(`/api/expert/invite?token=${encodeURIComponent(value)}`)
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || "This invite link is invalid.");
        setInvite(data);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "This invite link is invalid."))
      .finally(() => setLoading(false));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || !invite) return;
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") || "");
    if (password !== String(form.get("confirm") || "")) {
      setError("The passwords don't match.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/expert/invite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not set your password.");
      await (await getSupabase()).auth.signInWithPassword({ email: invite.email, password });
      window.location.assign("/expert");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not set your password.");
      setSubmitting(false);
    }
  }

  const first = invite?.full_name?.split(/\s+/)[0];
  return (
    <AuthShell
      audience="experts"
      description={
        invite
          ? `${first ? `Welcome, ${first}. ` : ""}Set a password to open your HQ360 workspace.`
          : "Set a password to open your HQ360 workspace."
      }
    >
      {loading ? (
        <GlassLoading label="Checking your invite…" />
      ) : !invite ? (
        <>
          <p className="hq-auth-notice" role="alert">
            {error}
          </p>
          <p className="hq-auth-account" style={{ marginTop: "1rem" }}>
            Already set your password? <a href="/expert">Sign in</a>
          </p>
        </>
      ) : (
        <form onSubmit={submit} aria-busy={submitting}>
          <label>
            Email
            <input type="email" value={invite.email} autoComplete="username" readOnly />
          </label>
          <label>
            New password
            <input
              type="password"
              name="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={72}
              required
            />
          </label>
          <label>
            Confirm password
            <input
              type="password"
              name="confirm"
              autoComplete="new-password"
              minLength={8}
              maxLength={72}
              required
            />
          </label>
          {error ? <p role="alert">{error}</p> : null}
          <button type="submit" disabled={submitting}>
            {submitting ? "Opening your workspace…" : "Set password & continue"}
            <ArrowUpRight aria-hidden="true" />
          </button>
        </form>
      )}
    </AuthShell>
  );
}
