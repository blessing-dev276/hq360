import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { Logo } from "@/components/Logo";
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
    void syncServerSession().then(setState);
  }, []);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: String(form.get("email") || ""),
      password: String(form.get("password") || ""),
    });
    if (authError) {
      setSubmitting(false);
      setError("The email or password is incorrect.");
      return;
    }
    const next = await syncServerSession();
    setSubmitting(false);
    setState(next);
    if (next !== "signed-in") await supabase.auth.signOut();
  }

  if (state === "signed-in") return children;

  return (
    <main className="grid min-h-screen place-items-center bg-secondary/40 px-5 py-12">
      <section className="w-full max-w-md rounded-3xl border border-border bg-card p-7 shadow-xl sm:p-9">
        <Logo size={48} />
        <div className="mt-8 inline-flex size-11 items-center justify-center rounded-full bg-brand/10 text-brand">
          <LockKeyhole className="size-5" aria-hidden="true" />
        </div>
        <p className="mt-5 text-xs font-semibold tracking-[0.18em] text-brand uppercase">
          HQ360 experts
        </p>
        <h1 className="mt-2 font-display text-3xl">Sign in to continue</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Access to Author Reports and Scout for approved HQ360 experts.
        </p>

        {state === "pending" ? (
          <p className="mt-6 rounded-xl bg-secondary p-4 text-sm text-muted-foreground">
            Your account is created and waiting on admin approval. Check back soon.
          </p>
        ) : state === "rejected" ? (
          <p className="mt-6 rounded-xl bg-destructive/10 p-4 text-sm text-destructive">
            This account was not approved. Contact HQ360 if you believe this is a mistake.
          </p>
        ) : (
          <form className="mt-7 space-y-5" onSubmit={login}>
            <label className="block text-sm font-semibold">
              Email
              <input
                type="email"
                name="email"
                autoComplete="email"
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
            <p className="text-center text-sm text-muted-foreground">
              New expert?{" "}
              <a href="/expert-signup" className="text-brand">
                Create an account
              </a>
            </p>
          </form>
        )}
      </section>
    </main>
  );
}
