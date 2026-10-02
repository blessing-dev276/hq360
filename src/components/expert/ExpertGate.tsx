import { GlassLoading } from "@/components/ui/glass-loading";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { supabase } from "@/integrations/supabase/client";

type AuthState = "checking" | "signed-out" | "signed-in" | "pending" | "rejected";

async function syncServerSession(): Promise<AuthState> {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) return "signed-out";
  const response = await fetch("/api/expert/session", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ access_token: accessToken }),
  }).catch(() => null);
  if (response?.ok) return "signed-in";
  if (response?.status === 403) {
    const body = await response.json().catch(() => ({}) as { status?: string });
    return body.status === "rejected" ? "rejected" : "pending";
  }
  return "signed-out";
}

export function ExpertGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>("checking");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    void syncServerSession()
      .then((next) => {
        if (active) setState(next);
      })
      .catch(() => {
        if (active) setState("signed-out");
      });
    return () => {
      active = false;
    };
  }, []);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: String(form.get("email") || ""),
        password: String(form.get("password") || ""),
      });
      if (authError) {
        setError(
          /email not confirmed/i.test(authError.message)
            ? "Your email hasn't been confirmed yet. Contact HQ360 if this persists."
            : "The email or password is incorrect.",
        );
        return;
      }
      const next = await syncServerSession();
      setState(next);
      if (next !== "signed-in") {
        if (next === "signed-out") setError("Could not open your workspace. Please try again.");
        await supabase.auth.signOut();
      }
    } catch {
      setError("Could not connect. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (state === "signed-in") return children;

  return (
    <AuthShell
      audience="experts"
      description="Access Scouting with your approved HQ360 expert account. Audit is coming soon."
    >
      {state === "checking" ? (
        <GlassLoading label="Opening your workspace…" />
      ) : state === "pending" ? (
        <p className="hq-auth-notice" role="status">
          Your account is created and waiting on admin approval. Check back soon.
        </p>
      ) : state === "rejected" ? (
        <p className="hq-auth-notice" role="alert">
          This account was not approved. Contact HQ360 if you believe this is a mistake.
        </p>
      ) : (
        <form onSubmit={login} aria-busy={submitting}>
          <label>
            Email
            <input type="email" name="email" autoComplete="email" required />
          </label>
          <label>
            Password
            <input type="password" name="password" autoComplete="current-password" required />
          </label>
          {error ? <p role="alert">{error}</p> : null}
          <button type="submit" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
            <ArrowUpRight aria-hidden="true" />
          </button>
          <p className="hq-auth-account">
            New expert? <a href="/expert-signup">Create an account</a>
          </p>
        </form>
      )}
      {state === "pending" || state === "rejected" ? (
        <p className="hq-auth-account" style={{ marginTop: "1rem" }}>
          <a href="/contact">Contact HQ360</a>
        </p>
      ) : null}
    </AuthShell>
  );
}
