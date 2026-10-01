import { GlassLoading } from "@/components/ui/glass-loading";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";

type AuthState = "checking" | "signed-out" | "signed-in" | "unconfigured";

export function AdminGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>("checking");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    fetch("/api/admin/session", { credentials: "same-origin", signal: controller.signal })
      .then((response) => response.json())
      .then((result: { authed?: boolean; configured?: boolean }) => {
        setState(
          result.configured === false ? "unconfigured" : result.authed ? "signed-in" : "signed-out",
        );
      })
      .catch(() => {
        setState("signed-out");
      })
      .finally(() => window.clearTimeout(timeout));
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, []);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/session", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: form.get("username"), password: form.get("password") }),
    }).catch(() => null);
    setSubmitting(false);
    if (response?.ok) {
      setState("signed-in");
      window.dispatchEvent(new Event("hq360-admin-auth"));
      return;
    }
    setError(
      response?.status === 503
        ? "Admin login has not been configured on this server."
        : !response
          ? "Could not connect. Please try again."
          : "The username or password is incorrect.",
    );
  }

  if (state === "signed-in") return children;

  return (
    <AuthShell audience="admin" description="This area is restricted to authorised HQ360 staff.">
      {state === "checking" ? (
        <GlassLoading label="Opening your workspace…" />
      ) : state === "unconfigured" ? (
        <p className="hq-auth-notice" role="alert">
          Admin sign-in is currently unavailable. Contact your site administrator.
        </p>
      ) : (
        <form onSubmit={login} aria-busy={submitting}>
          <label>
            Username
            <input name="username" autoComplete="username" required />
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
        </form>
      )}
    </AuthShell>
  );
}
