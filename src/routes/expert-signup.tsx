import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, LockKeyhole } from "lucide-react";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/expert-signup")({
  head: () => ({
    meta: [
      { title: "Create an expert account | HQ360" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ExpertSignup,
});

function ExpertSignup() {
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const { error: authError } = await supabase.auth.signUp({
      email: String(form.get("email") || ""),
      password: String(form.get("password") || ""),
      options: {
        data: { account_type: "expert", full_name: String(form.get("full_name") || "") },
      },
    });
    setSubmitting(false);
    if (authError) {
      setError(authError.message || "Could not create your account. Please try again.");
      return;
    }
    setDone(true);
  }

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
        <h1 className="mt-2 font-display text-3xl">Create your account</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Get access to Author Reports and Scout once HQ360 approves your account.
        </p>

        {done ? (
          <div className="mt-7 flex items-start gap-3 rounded-xl bg-secondary p-4 text-sm">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden="true" />
            <p>
              Account created. It’s now waiting on admin approval — you’ll be able to sign in at{" "}
              <a href="/expert" className="text-brand">
                /expert
              </a>{" "}
              once approved.
            </p>
          </div>
        ) : (
          <form className="mt-7 space-y-5" onSubmit={submit}>
            <label className="block text-sm font-semibold">
              Full name
              <input
                name="full_name"
                required
                minLength={2}
                maxLength={150}
                autoComplete="name"
                autoFocus
                className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
            <label className="block text-sm font-semibold">
              Email
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
            <label className="block text-sm font-semibold">
              Password
              <input
                type="password"
                name="password"
                required
                minLength={8}
                autoComplete="new-password"
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
              {submitting ? "Creating account…" : "Create account"}
              {!submitting ? <ArrowRight className="size-4" aria-hidden="true" /> : null}
            </button>
            <p className="text-center text-sm text-muted-foreground">
              Already approved?{" "}
              <a href="/expert" className="text-brand">
                Sign in
              </a>
            </p>
          </form>
        )}
      </section>
    </main>
  );
}
