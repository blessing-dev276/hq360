import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { Logo } from "@/components/Logo";

type AuthState = "signed-out" | "signed-in" | "unconfigured";

export function AdminGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>("signed-out");
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
        : "The username or password is incorrect.",
    );
  }

  if (state !== "signed-in") {
    return (
      <main className="grid min-h-screen place-items-center bg-secondary/40 px-5 py-12">
        <section className="w-full max-w-md rounded-3xl border border-border bg-card p-7 shadow-xl sm:p-9">
          <Logo size={48} />
          <div className="mt-8 inline-flex size-11 items-center justify-center rounded-full bg-brand/10 text-brand">
            <LockKeyhole className="size-5" aria-hidden="true" />
          </div>
          <p className="mt-5 text-xs font-semibold tracking-[0.18em] text-brand uppercase">
            HQ360 admin
          </p>
          <h1 className="mt-2 font-display text-3xl">Sign in to continue</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            This area is restricted to authorised HQ360 staff.
          </p>

          {state === "unconfigured" ? (
            <p className="mt-6 rounded-xl bg-destructive/10 p-4 text-sm text-destructive">
              Admin access is disabled until ADMIN_PASSWORD is available to the production server.
            </p>
          ) : (
            <form className="mt-7 space-y-5" onSubmit={login}>
              <label className="block text-sm font-semibold">
                Username
                <input
                  name="username"
                  autoComplete="username"
                  required
                  autoFocus
                  className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
              <label className="block text-sm font-semibold">
                Password
                <input
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  required
                  className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
              {error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 font-semibold text-primary-foreground transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60"
              >
                {submitting ? "Signing in…" : "Sign in"}
                {!submitting ? <ArrowRight className="size-4" aria-hidden="true" /> : null}
              </button>
            </form>
          )}
        </section>
      </main>
    );
  }

  return children;
}
