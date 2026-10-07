import { useCallback, useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { api, type Session, type Viewer } from "./shared";
import { Playbook } from "./Playbook";
import { PracticeRoom } from "./PracticeRoom";
import { Demos, MyChats } from "./Library";
import { TrainerTools } from "./TrainerTools";

type Tab = "playbook" | "practice" | "chats" | "demos" | "admin";

export function AcademyApp() {
  const [state, setState] = useState<"loading" | "signin" | "ready">("loading");
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [tab, setTab] = useState<Tab>("playbook");
  const [resume, setResume] = useState<Session | null>(null);
  const [version, setVersion] = useState(0);

  const loadViewer = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      setViewer(null);
      setState("signin");
      return;
    }
    const { status, body } = await api<{ viewer: Viewer }>("/api/academy/me");
    if (status === 200 && body.viewer) {
      setViewer(body.viewer);
      setState("ready");
    } else setState("signin");
  }, []);

  useEffect(() => {
    void loadViewer();
    const { data } = supabase.auth.onAuthStateChange(() => void loadViewer());
    return () => data.subscription.unsubscribe();
  }, [loadViewer]);

  const go = (t: Tab) => {
    setTab(t);
    window.scrollTo({ top: 0 });
  };
  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const tabs: [Tab, string][] = [
    ["playbook", "Playbook"],
    ["practice", "Practice room"],
    ["chats", "My chats"],
    ["demos", "Demos"],
    ...(viewer?.role === "trainer" ? ([["admin", "Admin"]] as [Tab, string][]) : []),
  ];

  return (
    <div className="asa">
      <header className="asa-bar">
        <div className="asa-wrap asa-bar-inner">
          <a href="/academy" aria-label="Author Scout Academy home">
            <img
              src="/logo.png"
              alt="HQ360"
              className="asa-logo"
              onError={(e) => {
                // Fall back to the site logo until /public/logo.png is uploaded.
                if (!e.currentTarget.src.endsWith("/logo-text.png"))
                  e.currentTarget.src = "/logo-text.png";
              }}
            />
          </a>
          {state === "ready" ? (
            <>
              <nav className="asa-tabs" aria-label="Academy">
                {tabs.map(([t, label]) => (
                  <button
                    key={t}
                    type="button"
                    className="asa-tab"
                    aria-current={tab === t ? "page" : undefined}
                    onClick={() => {
                      if (t === "practice") setResume(null);
                      go(t);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </nav>
              <button
                type="button"
                className="asa-btn asa-btn-ghost asa-btn-sm"
                style={{ marginLeft: "auto" }}
                onClick={() => void supabase.auth.signOut()}
              >
                Sign out
              </button>
            </>
          ) : (
            <span className="asa-serif" style={{ fontSize: 18 }}>
              Author Scout Academy
            </span>
          )}
        </div>
      </header>

      {state === "loading" ? (
        <p className="asa-wrap asa-muted" style={{ padding: 40 }}>
          Loading...
        </p>
      ) : null}
      {state === "signin" ? <SignIn /> : null}
      {state === "ready" && viewer ? (
        <main>
          {tab === "playbook" ? <Playbook onPractice={() => go("practice")} /> : null}
          {tab === "practice" ? <PracticeRoom initial={resume} onChanged={bump} /> : null}
          {tab === "chats" ? (
            <MyChats
              viewer={viewer}
              version={version}
              onPractice={() => go("practice")}
              onChanged={bump}
              onContinue={(s) => {
                setResume(s);
                go("practice");
              }}
            />
          ) : null}
          {tab === "demos" ? <Demos viewer={viewer} /> : null}
          {tab === "admin" && viewer.role === "trainer" ? (
            <div className="asa-wrap" style={{ padding: "32px 16px 64px" }}>
              <h2 style={{ fontSize: 32, margin: "0 0 18px" }}>Trainer tools</h2>
              <TrainerTools />
            </div>
          ) : null}
        </main>
      ) : null}
    </div>
  );
}

function SignIn() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const redirectTo =
    typeof window !== "undefined" ? `${window.location.origin}/academy` : undefined;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!email || busy) return;
    setBusy(true);
    setError("");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: redirectTo ? { emailRedirectTo: redirectTo } : {},
    });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <div className="asa-wrap" style={{ padding: "64px 16px" }}>
      <div className="asa-card" style={{ maxWidth: 440, margin: "0 auto", padding: 32 }}>
        <div className="asa-label">HQ360 training</div>
        <h1 style={{ fontSize: 34, margin: "8px 0 10px" }}>
          Author Scout <span className="asa-orange">Academy</span>
        </h1>
        <p className="asa-muted" style={{ marginTop: 0 }}>
          Sign in to read the playbook and practise with demo authors.
        </p>
        {sent ? (
          <p>Check your inbox. We sent a sign in link to {email}.</p>
        ) : (
          <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
            <label htmlFor="asa-email" style={{ fontWeight: 600, fontSize: 14 }}>
              Email
            </label>
            <input
              id="asa-email"
              type="email"
              required
              autoComplete="email"
              className="asa-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button type="submit" className="asa-btn" disabled={busy}>
              {busy ? "Sending..." : "Email me a sign in link"}
            </button>
          </form>
        )}
        <div className="asa-muted" style={{ textAlign: "center", margin: "16px 0", fontSize: 13 }}>
          or
        </div>
        <button
          type="button"
          className="asa-btn asa-btn-ghost"
          style={{ width: "100%" }}
          onClick={() =>
            void supabase.auth.signInWithOAuth({
              provider: "google",
              options: redirectTo ? { redirectTo } : {},
            })
          }
        >
          Continue with Google
        </button>
        {error ? <p style={{ color: "var(--asa-bad)", fontSize: 14 }}>{error}</p> : null}
      </div>
    </div>
  );
}
