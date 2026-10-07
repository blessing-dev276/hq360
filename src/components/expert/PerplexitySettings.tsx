import { useEffect, useState } from "react";

export function PerplexitySettings() {
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const endpoint = "/api/expert/perplexity-settings";
  useEffect(() => {
    const controller = new AbortController();
    void fetch(endpoint, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load settings.");
        setConfigured(data.configured);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);
  async function save(method: "PUT" | "DELETE") {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        ...(method === "PUT" ? { body: JSON.stringify({ apiKey: key }) } : {}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update settings.");
      setConfigured(data.configured);
      setKey("");
      setMessage(
        method === "PUT"
          ? "Key saved securely. New paid searches will use your Perplexity account."
          : "Key removed. Paid email searches are disabled until you add another key.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update settings.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <details
      className="mx-auto my-4 max-w-6xl rounded-2xl border border-border bg-card p-5"
      open={!loading && !configured ? true : undefined}
    >
      <summary className="cursor-pointer font-semibold">
        Email search settings · {loading ? "Loading…" : configured ? "Key saved" : "Add your key"}
      </summary>
      <div className="mt-4 max-w-2xl space-y-4 text-sm">
        <p>
          Use your own Perplexity account to find author emails. API usage is billed to your
          account; HQ360’s key is never used for your paid searches. Saved results and website
          checks are reused first to reduce cost.
        </p>
        <p>
          Create an API key and add credits in the{" "}
          <a
            href="https://console.perplexity.ai"
            target="_blank"
            rel="noreferrer"
            className="text-brand underline"
          >
            Perplexity Console
          </a>
          , then paste the key below. Email research uses GPT-6 Luna through Perplexity.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save("PUT");
          }}
          className="space-y-3"
        >
          <label className="block">
            {configured ? "Replace Perplexity API key" : "Perplexity API key"}
            <input
              aria-label="Perplexity API key"
              type="password"
              autoComplete="new-password"
              spellCheck={false}
              value={key}
              onChange={(event) => setKey(event.target.value)}
              placeholder="pplx-…"
              maxLength={512}
              required
              disabled={busy || loading}
              className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2"
            />
          </label>
          <p className="text-xs text-muted-foreground">
            Your saved key is encrypted and is never shown again. To change it, enter a replacement.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              disabled={busy || loading || !key.trim()}
              className="rounded-xl bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
            >
              {busy ? "Saving…" : configured ? "Replace key" : "Save key"}
            </button>
            {configured && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void save("DELETE")}
                className="rounded-xl border border-border px-4 py-2 disabled:opacity-50"
              >
                Remove key
              </button>
            )}
          </div>
        </form>
        {message && <p role="status">{message}</p>}
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
      </div>
    </details>
  );
}
