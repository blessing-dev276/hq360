import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  AlertCircle,
  CircleCheck,
  KeyRound,
  LogOut,
  Monitor,
  Moon,
  Palette,
  Sparkles,
  Sun,
  UserRound,
} from "lucide-react";
import { getSupabase } from "@/integrations/supabase/lazy";
import { readPanelTheme, setPanelTheme, type PanelTheme } from "@/components/admin/PanelThemeToggle";

type Usage = {
  created_at: string;
  action: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  ok: boolean;
};
type KeyStatus = {
  perplexity: { configured: boolean; updatedAt: string | null };
  other:
    | { configured: false }
    | { configured: true; provider: string; lastFour: string; updatedAt: string };
  usage: Usage[];
};
type Section = "ai" | "account" | "appearance";

const OTHER_PROVIDERS = [
  ["anthropic", "Anthropic (Claude)", "sk-ant-…"],
  ["openai", "OpenAI", "sk-…"],
  ["google", "Google (Gemini)", "AIza…"],
] as const;

const date = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : "";

/** Settings for the Admin and Expert workspaces. AI keys are set here and
 *  nowhere else; every AI feature in the app reads the key saved here. */
export function SettingsPage({
  admin = false,
  guest = false,
  email,
  onSignOut,
}: {
  admin?: boolean;
  guest?: boolean;
  email?: string | undefined;
  onSignOut: () => void;
}) {
  const [section, setSection] = useState<Section>("ai");
  const tabs: [Section, string, typeof Sparkles][] = [
    ["ai", "AI keys", Sparkles],
    ["account", "Account", UserRound],
    ["appearance", "Appearance", Palette],
  ];
  return (
    <section className="admin-content-panel settings-page">
      <div className="admin-segmented settings-tabs" role="tablist" aria-label="Settings sections">
        {tabs.map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={section === id}
            className={section === id ? "active" : ""}
            onClick={() => setSection(id)}
          >
            <Icon size={14} aria-hidden="true" /> {label}
          </button>
        ))}
      </div>
      {section === "ai" ? (
        <AiKeys admin={admin} guest={guest} />
      ) : section === "account" ? (
        <Account admin={admin} email={email} onSignOut={onSignOut} />
      ) : (
        <Appearance />
      )}
    </section>
  );
}

function Feedback({ error, notice }: { error: string; notice: string }) {
  return (
    <>
      {error && (
        <div className="admin-alert" role="alert">
          <AlertCircle size={18} /> {error}
        </div>
      )}
      {notice && (
        <div className="admin-notice" role="status">
          <CircleCheck size={18} /> {notice}
        </div>
      )}
    </>
  );
}

function Card({ title, badge, children }: { title: string; badge?: ReactNode; children: ReactNode }) {
  return (
    <div className="settings-card">
      <div className="settings-card-head">
        <h3>{title}</h3>
        {badge}
      </div>
      {children}
    </div>
  );
}

function AiKeys({ admin, guest }: { admin: boolean; guest: boolean }) {
  const [status, setStatus] = useState<KeyStatus | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [pplxKey, setPplxKey] = useState("");
  const [provider, setProvider] = useState<string>("anthropic");
  const [otherKey, setOtherKey] = useState("");
  const headers = useCallback(
    (extra: Record<string, string> = {}) =>
      admin ? { ...extra, "x-hq360-actor": "admin" } : extra,
    [admin],
  );

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/expert/ai-key", { headers: headers() });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not load AI settings.");
      setStatus(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load AI settings.");
    }
  }, [headers]);
  useEffect(() => {
    void load();
  }, [load]);

  async function save(event: FormEvent, chosen: string, apiKey: string, clear: () => void) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/expert/ai-key", {
        method: "PUT",
        headers: headers({ "content-type": "application/json" }),
        body: JSON.stringify({ provider: chosen, apiKey: apiKey.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not save your key.");
      clear();
      setNotice(`Saved. Key ending ${data.lastFour} is encrypted and now used across the app.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save your key.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(which: "perplexity" | "other") {
    if (!window.confirm("Remove this key? Features that use it stop until you add a new one."))
      return;
    setError("");
    setNotice("");
    const response = await fetch(`/api/expert/ai-key?key=${which}`, {
      method: "DELETE",
      headers: headers(),
    });
    if (!response.ok) return setError("Could not remove the key. Please try again.");
    setNotice("Key removed.");
    await load();
  }

  const pplx = status?.perplexity;
  const other = status?.other;
  const usedBy = admin
    ? "Scouting email search, Audit AI research, Client tracking drafts"
    : guest
      ? "Scouting email search"
      : "Scouting email search, Client tracking drafts and, if you are an Academy trainer, the Practice Room AI";
  const totals = (status?.usage ?? []).reduce(
    (sum, u) => ({ input: sum.input + u.input_tokens, output: sum.output + u.output_tokens }),
    { input: 0, output: 0 },
  );

  return (
    <div className="settings-body">
      <p className="admin-lede">
        Save your keys once here. Every AI feature in your workspace uses them, so you never enter a
        key anywhere else. Keys are encrypted and never shown again; only the last four characters
        of optional keys are kept for reference.
      </p>
      <Feedback error={error} notice={notice} />

      <Card
        title="Perplexity"
        badge={
          <span className={`settings-badge ${pplx?.configured ? "on" : ""}`}>
            {status == null ? "Checking…" : pplx?.configured ? `Saved ${date(pplx.updatedAt)}` : "Not set"}
          </span>
        }
      >
        <p className="settings-muted">
          Primary key. Used by: {usedBy}. Create a key and add credits in the{" "}
          <a href="https://console.perplexity.ai" target="_blank" rel="noreferrer">
            Perplexity Console
          </a>
          .
        </p>
        <form
          className="admin-invoice-form settings-form"
          onSubmit={(e) => void save(e, "perplexity", pplxKey, () => setPplxKey(""))}
        >
          <label>
            {pplx?.configured ? "Replace Perplexity key" : "Perplexity API key"}
            <input
              type="password"
              autoComplete="new-password"
              spellCheck={false}
              placeholder="pplx-…"
              maxLength={512}
              value={pplxKey}
              onChange={(e) => setPplxKey(e.target.value)}
            />
          </label>
          <div className="admin-button-row">
            <button
              className="admin-button admin-button-primary"
              disabled={busy || !pplxKey.trim().startsWith("pplx-")}
            >
              {busy ? "Saving…" : pplx?.configured ? "Replace key" : "Save key"}
            </button>
            {pplx?.configured && (
              <button type="button" className="admin-button" onClick={() => void remove("perplexity")}>
                Remove
              </button>
            )}
          </div>
        </form>
      </Card>

      {!guest && (
        <Card
          title="Other AI provider (optional)"
          badge={
            <span className={`settings-badge ${other?.configured ? "on" : ""}`}>
              {status == null
                ? "Checking…"
                : other?.configured
                  ? `${OTHER_PROVIDERS.find(([id]) => id === other.provider)?.[1] ?? other.provider} ··${other.lastFour}`
                  : "Not set"}
            </span>
          }
        >
          <p className="settings-muted">
            Only used for Client tracking drafts when no Perplexity key is saved.
          </p>
          <form
            className="admin-invoice-form settings-form"
            onSubmit={(e) => void save(e, provider, otherKey, () => setOtherKey(""))}
          >
            <label>
              Provider
              <select value={provider} onChange={(e) => setProvider(e.target.value)}>
                {OTHER_PROVIDERS.map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {other?.configured ? "Replace key" : "API key"}
              <input
                type="password"
                autoComplete="new-password"
                spellCheck={false}
                placeholder={OTHER_PROVIDERS.find(([id]) => id === provider)?.[2]}
                maxLength={512}
                value={otherKey}
                onChange={(e) => setOtherKey(e.target.value)}
              />
            </label>
            <div className="admin-button-row">
              <button className="admin-button admin-button-primary" disabled={busy || otherKey.trim().length < 16}>
                {busy ? "Saving…" : "Save key"}
              </button>
              {other?.configured && (
                <button type="button" className="admin-button" onClick={() => void remove("other")}>
                  Remove
                </button>
              )}
            </div>
          </form>
        </Card>
      )}

      {!guest && (
        <Card title="AI usage">
          {status?.usage?.length ? (
            <>
              <p className="settings-muted">
                {status.usage.length} requests · {totals.input.toLocaleString()} input and{" "}
                {totals.output.toLocaleString()} output tokens (latest 200).
              </p>
              <div style={{ overflowX: "auto" }}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th scope="col">Date</th>
                      <th scope="col">Action</th>
                      <th scope="col">Model</th>
                      <th scope="col">Tokens</th>
                      <th scope="col">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {status.usage.map((u, i) => (
                      <tr key={i}>
                        <td>{new Date(u.created_at).toLocaleString("en-GB")}</td>
                        <td>{u.action.replace(/_/g, " ")}</td>
                        <td>{u.model}</td>
                        <td>{u.input_tokens + u.output_tokens}</td>
                        <td>{u.ok ? "Draft saved" : "Failed"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="settings-muted">No AI drafting requests yet.</p>
          )}
        </Card>
      )}
    </div>
  );
}

function Account({
  admin,
  email,
  onSignOut,
}: {
  admin: boolean;
  email?: string | undefined;
  onSignOut: () => void;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (next.length < 8) return setError("Use at least 8 characters for the new password.");
    if (next !== confirm) return setError("The new passwords do not match.");
    if (!email) return setError("Your account email could not be loaded. Refresh and try again.");
    setBusy(true);
    try {
      const supabase = await getSupabase();
      const check = await supabase.auth.signInWithPassword({ email, password: current });
      if (check.error) throw new Error("Your current password is not correct.");
      const { error: updateError } = await supabase.auth.updateUser({ password: next });
      if (updateError) throw new Error(updateError.message);
      setCurrent("");
      setNext("");
      setConfirm("");
      setNotice("Password changed. Use the new one next time you sign in.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not change your password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="settings-body">
      <Feedback error={error} notice={notice} />
      <Card title="Signed in as">
        <p className="settings-strong">
          <KeyRound size={15} aria-hidden="true" /> {admin ? "HQ360 Administrator" : email || "…"}
        </p>
        <p className="settings-muted">
          {admin
            ? "The admin username and password are set on the server (ADMIN_USERNAME and ADMIN_PASSWORD). Sessions last 12 hours."
            : "Your profile details are edited in My profile."}
        </p>
      </Card>
      {!admin && (
        <Card title="Change password">
          <form className="admin-invoice-form settings-form" onSubmit={(e) => void changePassword(e)}>
            <label>
              Current password
              <input
                type="password"
                autoComplete="current-password"
                required
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
            </label>
            <label>
              New password
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={next}
                onChange={(e) => setNext(e.target.value)}
              />
            </label>
            <label>
              Confirm new password
              <input
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </label>
            <div className="admin-button-row">
              <button className="admin-button admin-button-primary" disabled={busy}>
                {busy ? "Saving…" : "Change password"}
              </button>
            </div>
          </form>
        </Card>
      )}
      <Card title="Session">
        <p className="settings-muted">Sign out of this browser.</p>
        <div className="admin-button-row">
          <button type="button" className="admin-button" onClick={onSignOut}>
            <LogOut size={14} aria-hidden="true" /> Sign out
          </button>
        </div>
      </Card>
    </div>
  );
}

function Appearance() {
  const [choice, setChoice] = useState<PanelTheme>("system");
  useEffect(() => setChoice(readPanelTheme()), []);
  const options: [PanelTheme, string, typeof Sun][] = [
    ["system", "Match my computer", Monitor],
    ["light", "Light", Sun],
    ["dark", "Dark", Moon],
  ];
  return (
    <div className="settings-body">
      <Card title="Theme">
        <p className="settings-muted">Applies to this workspace on this browser.</p>
        <div className="admin-segmented" role="radiogroup" aria-label="Theme">
          {options.map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={choice === id}
              className={choice === id ? "active" : ""}
              onClick={() => {
                setChoice(id);
                setPanelTheme(id);
              }}
            >
              <Icon size={14} aria-hidden="true" /> {label}
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}
