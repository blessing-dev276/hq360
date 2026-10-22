import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AlertCircle, CircleCheck, KeyRound } from "lucide-react";
import { actorHeaders, setTrackerAdminMode } from "./tracker-actor";

type Usage = {
  created_at: string;
  action: string;
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  ok: boolean;
};
type Status = { configured: boolean; provider?: string; lastFour?: string; updatedAt?: string; usage?: Usage[] };

const PROVIDERS = [
  ["anthropic", "Anthropic (Claude)"],
  ["openai", "OpenAI"],
  ["google", "Google (Gemini)"],
] as const;

/** Settings, AI: the expert's own key. It is never sent back to the browser;
 *  after saving only the last four characters are shown. */
export function AiSettings({ admin = false }: { admin?: boolean }) {
  setTrackerAdminMode(admin);
  const [status, setStatus] = useState<Status | null>(null);
  const [provider, setProvider] = useState<string>("anthropic");
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/expert/ai-key", { headers: actorHeaders() });
    const data = await response.json().catch(() => ({}));
    if (response.ok) setStatus(data);
    else setError(data.error || "Could not load AI settings.");
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/expert/ai-key", {
        method: "PUT",
        headers: actorHeaders({ "content-type": "application/json" }),
        body: JSON.stringify({ provider, apiKey }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not save your key.");
      setApiKey("");
      setNotice(`Saved. Your key ending ${data.lastFour} is encrypted and used only for your own trackers.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save your key.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm("Delete your AI key? AI drafting stops until you add a new one.")) return;
    const response = await fetch("/api/expert/ai-key", { method: "DELETE", headers: actorHeaders() });
    if (response.ok) {
      setNotice("Key deleted.");
      await load();
    } else setError("Could not delete your key.");
  }

  const totals = (status?.usage ?? []).reduce(
    (sum, u) => ({ input: sum.input + u.input_tokens, output: sum.output + u.output_tokens }),
    { input: 0, output: 0 },
  );

  return (
    <section className="admin-content-panel">
      <div className="admin-panel-heading" style={{ padding: "0 0 1.5rem" }}>
        <div>
          <h2>AI assisted updates</h2>
          <p>
            {admin
              ? "Admin's own Anthropic, OpenAI or Google key, used when you draft updates on any expert's tracker. Experts' keys are never used by admin."
              : "Use your own Anthropic, OpenAI or Google key to draft tracker updates. Your provider account pays for your requests."}{" "}
            AI only writes drafts: you approve everything before a client sees it.
          </p>
        </div>
      </div>
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
      {status?.configured && (
        <p>
          <KeyRound size={16} aria-hidden="true" /> {PROVIDERS.find(([id]) => id === status.provider)?.[1]} key ending{" "}
          <code>{status.lastFour}</code>, saved {status.updatedAt ? new Date(status.updatedAt).toLocaleDateString("en-GB") : ""}.{" "}
          <button type="button" className="admin-button" onClick={() => void remove()}>
            Delete key
          </button>
        </p>
      )}
      <form onSubmit={save} className="admin-invoice-form" style={{ display: "grid", gap: 10, maxWidth: 560 }}>
        <label className="admin-field">
          <span>Provider</span>
          <select value={provider} onChange={(e) => setProvider(e.target.value)}>
            {PROVIDERS.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-field">
          <span>{status?.configured ? "Replace with a new key" : "API key"}</span>
          <input
            type="password"
            autoComplete="off"
            spellCheck={false}
            required
            minLength={20}
            maxLength={512}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </label>
        <button className="admin-button admin-button-primary" disabled={busy}>
          {busy ? "Saving…" : "Save key"}
        </button>
      </form>

      <h3 style={{ marginTop: 28 }}>Your AI usage</h3>
      {status?.usage?.length ? (
        <>
          <p>
            {status.usage.length} requests, {totals.input.toLocaleString()} input and {totals.output.toLocaleString()} output tokens (latest 200).
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
        <p>No AI requests yet.</p>
      )}
    </section>
  );
}
