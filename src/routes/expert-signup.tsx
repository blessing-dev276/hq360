import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import {
  ArrowUpRight,
  BadgeCheck,
  CheckCircle2,
  FileText,
  ScanSearch,
  UserRound,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { buildSeo } from "@/lib/seo";
import { Eyebrow, Grain, Pill } from "@/components/site/hqd/Hqd";

export const Route = createFileRoute("/expert-signup")({
  head: () =>
    buildSeo({
      title: "Become an Expert | HQ360",
      description:
        "Apply to join the HQ360 expert network. Approved experts get access to Author Reports and Scout, and a public profile page.",
      path: "/expert-signup",
    }),
  component: BecomeAnExpert,
});

const PERKS = [
  {
    icon: UserRound,
    title: "A public expert profile",
    body: "Your own page on hq360.space with your specialties, background and links.",
  },
  {
    icon: FileText,
    title: "Author Reports",
    body: "Research and build author visibility reports with HQ360’s tooling.",
  },
  {
    icon: ScanSearch,
    title: "Scout",
    body: "Find and research new and debut authors with the prospecting workspace.",
  },
  {
    icon: BadgeCheck,
    title: "Reviewed by HQ360",
    body: "Every application is approved by the team before any access is granted.",
  },
];

function BecomeAnExpert() {
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
        emailRedirectTo: `${window.location.origin}/expert`,
        data: {
          account_type: "expert",
          full_name: String(form.get("full_name") || "").trim(),
          headline: String(form.get("headline") || "").trim(),
        },
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
    <div className="hqd dark">
      <section className="hqd-page-hero">
        <div className="hqd-page-panel" style={{ minHeight: "clamp(26rem, 60svh, 36rem)" }}>
          <span className="hqd-hero-glow" aria-hidden="true" />
          <span className="hqd-hero-shade" aria-hidden="true" />
          <Grain />
          <div className="hqd-page-inner">
            <div>
              <p className="hqd-hero-kicker">Join the HQ360 expert network</p>
              <h1 className="hqd-page-title">
                Become an
                <br />
                Expert.
              </h1>
            </div>
            <div className="hqd-hero-aside">
              <p className="hqd-lede">Do your best work, with a team behind you.</p>
              <p>Apply in two minutes. We review every application before access is granted.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="hqd-section">
        <div className="hqd-wrap hqd-join">
          <div>
            <Eyebrow>What you get</Eyebrow>
            <h2 className="hqd-h2">
              Built for
              <br />
              <span className="hqd-orange-text">specialists.</span>
            </h2>
            <div className="hqd-perks">
              {PERKS.map(({ icon: Icon, title, body }) => (
                <div key={title} className="hqd-perk">
                  <span className="hqd-card-arrow" aria-hidden="true">
                    <Icon size={18} />
                  </span>
                  <div>
                    <strong>{title}</strong>
                    <p>{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="hqd-form-shell" style={{ position: "sticky", top: "6rem" }}>
            {done ? (
              <div style={{ display: "grid", gap: "1rem" }}>
                <CheckCircle2 size={40} className="text-brand" aria-hidden="true" />
                <h2 className="hqd-lede" style={{ fontSize: "1.8rem" }}>
                  Application received.
                </h2>
                <p className="hqd-body">
                  If we sent a confirmation email, confirm your address first. Once HQ360 approves
                  your account you can sign in and publish your profile.
                </p>
                <div>
                  <Pill to="/expert">Go to expert sign-in</Pill>
                </div>
              </div>
            ) : (
              <form onSubmit={submit} style={{ display: "grid", gap: "1.1rem" }}>
                <div>
                  <h2 className="hqd-lede" style={{ fontSize: "1.8rem" }}>
                    Create your account
                  </h2>
                  <p className="hqd-note" style={{ marginTop: "0.4rem" }}>
                    Already approved?{" "}
                    <a href="/expert" className="text-brand">
                      Sign in
                    </a>
                  </p>
                </div>
                <label className="hqd-field">
                  Full name
                  <input
                    className="hqd-input"
                    name="full_name"
                    required
                    minLength={2}
                    maxLength={150}
                    autoComplete="name"
                  />
                </label>
                <label className="hqd-field">
                  Your expertise
                  <input
                    className="hqd-input"
                    name="headline"
                    required
                    minLength={3}
                    maxLength={160}
                    placeholder="e.g. Book editor & publishing consultant"
                  />
                </label>
                <label className="hqd-field">
                  Email
                  <input
                    className="hqd-input"
                    type="email"
                    name="email"
                    required
                    autoComplete="email"
                  />
                </label>
                <label className="hqd-field">
                  Password
                  <input
                    className="hqd-input"
                    type="password"
                    name="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                </label>
                {error ? (
                  <p className="hqd-alert" role="alert">
                    {error}
                  </p>
                ) : null}
                <button
                  type="submit"
                  disabled={submitting}
                  className="hqd-pill hqd-pill--orange"
                  style={{ justifyContent: "space-between", border: 0, cursor: "pointer" }}
                >
                  <span>{submitting ? "Creating account…" : "Apply to become an Expert"}</span>
                  <span className="hqd-pill-dot" aria-hidden="true">
                    <ArrowUpRight size={17} strokeWidth={2.4} />
                  </span>
                </button>
                <p className="hqd-note">
                  Your account stays inactive until HQ360 approves it. We’ll only use your details
                  to review your application and run your expert account.
                </p>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
