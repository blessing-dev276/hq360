import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  BookOpen,
  History,
  LogOut,
  MessagesSquare,
  PlayCircle,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { api, type Session, type Viewer } from "./shared";
import { Playbook } from "./Playbook";
import { PracticeRoom } from "./PracticeRoom";
import { Demos, MyChats } from "./Library";
import { TrainerTools } from "./TrainerTools";
import { TrainerReveal, type ReelTrainer } from "./TrainerReveal";

type Tab = "playbook" | "practice" | "chats" | "demos" | "admin";

export function AcademyApp() {
  const [state, setState] = useState<"loading" | "signin" | "ready">("loading");
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [tab, setTab] = useState<Tab>("playbook");
  const [resume, setResume] = useState<Session | null>(null);
  const [version, setVersion] = useState(0);
  const [recovery, setRecovery] = useState(false);
  const [reveal, setReveal] = useState<{ pool: ReelTrainer[]; winner: ReelTrainer } | null>(null);

  // First sign in: the server randomly assigns a trainer, then we reveal it.
  const assignTrainer = useCallback(async (v: Viewer) => {
    if (v.role !== "trainee" || v.trainerId) return;
    const { status, body } = await api<{ trainer: ReelTrainer | null; pool: ReelTrainer[] }>(
      "/api/academy/assign",
      { method: "POST" },
    );
    if (status !== 200 || !body.trainer) return;
    const winner = body.trainer;
    setViewer({ ...v, trainerId: winner.id, trainer: { id: winner.id, name: winner.name } });
    setReveal({ pool: body.pool.length ? body.pool : [winner], winner });
  }, []);

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
      void assignTrainer(body.viewer);
    } else setState("signin");
  }, [assignTrainer]);

  useEffect(() => {
    void loadViewer();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      // A password reset link signs the user in; ask for the new password first.
      if (event === "PASSWORD_RECOVERY") {
        setRecovery(true);
        setState("signin");
        return;
      }
      if (event === "USER_UPDATED") setRecovery(false);
      void loadViewer();
    });
    return () => data.subscription.unsubscribe();
  }, [loadViewer]);

  const go = (t: Tab) => {
    setTab(t);
    window.scrollTo({ top: 0 });
  };
  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const tabs: [Tab, string, LucideIcon][] = [
    ["playbook", "Playbook", BookOpen],
    ["practice", "Practice", MessagesSquare],
    ["chats", "My chats", History],
    ["demos", "Demos", PlayCircle],
    ...(viewer?.role === "trainer"
      ? ([["admin", "Trainer", ShieldCheck]] as [Tab, string, LucideIcon][])
      : []),
  ];
  const who = viewer?.name || viewer?.email || "";
  const nav = (className: string) => (
    <nav className={className} aria-label="Academy">
      {tabs.map(([t, label, Icon]) => (
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
          <Icon size={17} aria-hidden="true" />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );

  return (
    <div className="asa">
      <header className="asa-bar">
        <div className="asa-wrap asa-bar-inner">
          <a href="/academy" aria-label="Author Scout Academy home" className="asa-brand">
            <img src="/logo-text.webp" alt="HQ360" className="asa-logo" />
            <span className="asa-brand-sub">Author Scout Academy</span>
          </a>
          {state === "ready" ? (
            <>
              {nav("asa-tabs")}
              <div className="asa-user">
                <span className="asa-user-avatar" aria-hidden="true">
                  {(who || "?").slice(0, 1).toUpperCase()}
                </span>
                <span className="asa-user-name">
                  {who.split(/[\s@]/)[0]}
                  <small>{viewer?.role === "trainer" ? "Trainer" : "Trainee"}</small>
                </span>
                <button
                  type="button"
                  className="asa-icon-btn"
                  aria-label="Sign out"
                  title="Sign out"
                  onClick={() => void supabase.auth.signOut()}
                >
                  <LogOut size={17} />
                </button>
              </div>
            </>
          ) : null}
        </div>
      </header>
      {state === "ready" ? nav("asa-bottom-nav") : null}

      {state === "loading" ? (
        <p className="asa-wrap asa-muted" style={{ padding: 40 }}>
          Loading...
        </p>
      ) : null}
      {state === "signin" || recovery ? <SignIn recovery={recovery} /> : null}
      {reveal ? (
        <TrainerReveal pool={reveal.pool} winner={reveal.winner} onDone={() => setReveal(null)} />
      ) : null}
      {state === "ready" && viewer && !recovery ? (
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

function SignIn({ recovery = false }: { recovery?: boolean }) {
  const [mode, setMode] = useState<"signin" | "signup" | "reset" | "newpass">(
    recovery ? "newpass" : "signin",
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const back = typeof window !== "undefined" ? `${window.location.origin}/academy` : undefined;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setInfo("");
    const result =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : mode === "signup"
          ? await supabase.auth.signUp({
              email,
              password,
              options: {
                data: { full_name: name.trim() },
                ...(back ? { emailRedirectTo: back } : {}),
              },
            })
          : mode === "reset"
            ? await supabase.auth.resetPasswordForEmail(email, back ? { redirectTo: back } : {})
            : await supabase.auth.updateUser({ password });
    setBusy(false);
    if (result.error) return setError(friendly(result.error.message));
    if (mode === "signup" && !("session" in result.data && result.data.session))
      setInfo(`Almost there. Confirm your email from the link we sent to ${email}, then sign in.`);
    else if (mode === "reset") setInfo(`We sent a password reset link to ${email}.`);
    // Sign in, sign up with a session and new password all continue via onAuthStateChange.
  }

  const title = {
    signin: "Sign in",
    signup: "Create your account",
    reset: "Reset your password",
    newpass: "Choose a new password",
  }[mode];
  return (
    <div className="asa-wrap" style={{ padding: "64px 16px" }}>
      <div className="asa-card" style={{ maxWidth: 440, margin: "0 auto", padding: 32 }}>
        <div className="asa-label">HQ360 training</div>
        <h1 style={{ fontSize: 34, margin: "8px 0 10px" }}>
          Author Scout <span className="asa-orange">Academy</span>
        </h1>
        <p className="asa-muted" style={{ marginTop: 0 }}>
          {title}. Read the playbook, practise with demo authors and learn from your trainer.
        </p>
        <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
          {mode === "signup" ? (
            <Field label="Full name" id="asa-name">
              <input
                id="asa-name"
                required
                autoComplete="name"
                className="asa-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
          ) : null}
          {mode !== "newpass" ? (
            <Field label="Email" id="asa-email">
              <input
                id="asa-email"
                type="email"
                required
                autoComplete="email"
                className="asa-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
          ) : null}
          {mode !== "reset" ? (
            <Field label={mode === "newpass" ? "New password" : "Password"} id="asa-password">
              <input
                id="asa-password"
                type="password"
                required
                minLength={8}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                className="asa-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
          ) : null}
          <button type="submit" className="asa-btn" disabled={busy} style={{ marginTop: 6 }}>
            {busy
              ? "Please wait..."
              : mode === "reset"
                ? "Send reset link"
                : mode === "newpass"
                  ? "Save password"
                  : title}
          </button>
        </form>
        {info ? (
          <p role="status" style={{ fontSize: 14 }}>
            {info}
          </p>
        ) : null}
        {error ? (
          <p role="alert" style={{ color: "var(--asa-bad)", fontSize: 14 }}>
            {error}
          </p>
        ) : null}
        {mode !== "newpass" ? (
          <div
            className="asa-muted"
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              marginTop: 18,
              fontSize: 14,
            }}
          >
            {mode === "signin" ? (
              <>
                <button type="button" className="asa-link" onClick={() => setMode("signup")}>
                  New here? Create an account
                </button>
                <button type="button" className="asa-link" onClick={() => setMode("reset")}>
                  Forgot password?
                </button>
              </>
            ) : (
              <button type="button" className="asa-link" onClick={() => setMode("signin")}>
                Already have an account? Sign in
              </button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <label htmlFor={id} style={{ fontWeight: 600, fontSize: 14 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function friendly(message: string) {
  if (/invalid login credentials/i.test(message))
    return "Wrong email or password. Signed up with an email link before? Use Forgot password to set one.";
  if (/email not confirmed/i.test(message))
    return "Confirm your email first: open the link we sent you, then sign in.";
  if (/already registered|already exists/i.test(message))
    return "That email already has an account. Sign in, or use Forgot password.";
  return message;
}
