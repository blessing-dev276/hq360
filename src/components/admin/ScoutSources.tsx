import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { ScoutSource, ScoutAuthor } from "@/lib/scout/db";
const input = "rounded-lg border border-border bg-background p-2 text-sm w-full";
const button = "rounded-full border border-border px-3 py-1.5 text-sm disabled:opacity-40";
async function api<T>(url: string, body?: unknown, method = "POST"): Promise<T> {
  const response = await fetch(
    url,
    body === undefined
      ? {}
      : { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) },
  );
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.error ?? "Request failed");
  return data;
}
type History = {
  runs: {
    id: string;
    status: string;
    started_at: string;
    pages: number;
    records: number;
    errors: { message: string; url: string }[];
  }[];
  urls: { source_url: string; collected_at: string }[];
};
export function ScoutSources() {
  const [sources, setSources] = useState<ScoutSource[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(""),
    [message, setMessage] = useState("");
  const load = useCallback(async () => {
    try {
      const data = await api<{ items: ScoutSource[] }>("/api/admin/scout-sources");
      setSources(data.items);
    } catch (e) {
      setError(String(e));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function save(source: ScoutSource, body: unknown) {
    setBusy(source.slug);
    setError("");
    try {
      await api(`/api/admin/scout-sources/${source.slug}`, body, "PATCH");
      await load();
      setMessage("Source settings saved.");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy("");
    }
  }
  async function crawl(source: ScoutSource) {
    setBusy(source.slug);
    setMessage("Crawl running…");
    setError("");
    try {
      const result = await api<{
        status?: string;
        count?: number;
        reason?: string;
        errors?: { message: string }[];
      }>("/api/admin/scout-crawl", { slug: source.slug });
      setMessage(
        result.reason ??
          `${result.status}: ${result.count ?? 0} records. ${result.errors?.map((e) => e.message).join("; ") ?? ""}`,
      );
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy("");
    }
  }
  return (
    <div className="mt-6 space-y-5">
      <p className="text-sm text-muted-foreground">
        Public sources only. Identity and outreach require manual review. Daily and weekly schedules
        run when the host scheduler calls Scout.
      </p>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {sources.map((s) => (
        <SourceCard
          key={s.slug}
          source={s}
          busy={Boolean(busy)}
          save={(body) => save(s, body)}
          crawl={() => crawl(s)}
        />
      ))}
      <IdentityReview />
    </div>
  );
}
function SourceCard({
  source: s,
  busy,
  save,
  crawl,
}: {
  source: ScoutSource;
  busy: boolean;
  save: (body: unknown) => Promise<void>;
  crawl: () => Promise<void>;
}) {
  const [history, setHistory] = useState<History | null>(null),
    [error, setError] = useState("");
  const permitted = s.kind === "api" && ["allowed", "limited"].includes(s.source_access_status);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    await save({
      max_pages: Number(data.get("pages")),
      max_records: Number(data.get("records")),
      crawl_delay_ms: Number(data.get("delay")),
      sync_schedule: data.get("schedule"),
      config: { query: String(data.get("query")), genre: String(data.get("genre")) },
    });
  }
  async function showHistory() {
    try {
      setHistory(
        await api<History>(`/api/admin/scout-crawl-history?slug=${encodeURIComponent(s.slug)}`),
      );
    } catch (e) {
      setError(String(e));
    }
  }
  return (
    <article className="rounded-2xl border border-border bg-card p-5 space-y-3">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h3 className="font-semibold">{s.name}</h3>
          <p className="text-sm">
            {s.enabled ? "Enabled" : "Disabled"} · Access: {s.source_access_status} · Robots:{" "}
            {s.robots_status}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className={button}
            disabled={busy || (!s.enabled && !permitted)}
            onClick={() => save({ enabled: !s.enabled })}
          >
            {s.enabled ? "Disable" : "Enable"}
          </button>
          <button className={button} disabled={busy || !s.enabled || !permitted} onClick={crawl}>
            Run crawl
          </button>
          <button className={button} onClick={showHistory}>
            Errors & source URLs
          </button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{s.terms_notes}</p>
      <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        {[
          ["Last crawl", s.last_synced_at ? new Date(s.last_synced_at).toLocaleString() : "Never"],
          ["Next crawl", s.next_crawl_at ? new Date(s.next_crawl_at).toLocaleString() : "Manual"],
          ["Records discovered", s.records_discovered],
          ["Books / authors added", `${s.books_added} / ${s.authors_added}`],
          ["Errors", s.error_count],
          ["Request interval", `${s.crawl_delay_ms / 1000}s + jitter`],
          ["Daily records / limit", `${s.daily_records} / ${s.collection_limit_per_day ?? 200}`],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-muted-foreground">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {s.last_error && <p className="text-sm text-destructive">{s.last_error}</p>}
      {permitted && (
        <form onSubmit={submit} className="grid sm:grid-cols-3 gap-3">
          <label className="text-sm">
            Search query
            <input
              name="query"
              className={input}
              maxLength={200}
              defaultValue={String(s.config.query ?? "")}
            />
          </label>
          <label className="text-sm">
            Genre
            <input
              name="genre"
              className={input}
              maxLength={80}
              defaultValue={String(s.config.genre ?? "")}
            />
          </label>
          <label className="text-sm">
            Frequency
            <select name="schedule" className={input} defaultValue={s.sync_schedule ?? "manual"}>
              <option value="manual">Manual</option>
              {s.slug !== "open_library" && (
                <>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </>
              )}
            </select>
          </label>
          <label className="text-sm">
            Maximum pages
            <input
              name="pages"
              type="number"
              min={1}
              max={s.slug === "open_library" ? 1 : 10}
              defaultValue={s.max_pages}
              className={input}
            />
          </label>
          <label className="text-sm">
            Maximum records
            <input
              name="records"
              type="number"
              min={1}
              max={s.slug === "open_library" ? 40 : 200}
              defaultValue={s.max_records}
              className={input}
            />
          </label>
          <label className="text-sm">
            Request interval (ms)
            <input
              name="delay"
              type="number"
              min={1000}
              max={60000}
              defaultValue={s.crawl_delay_ms}
              className={input}
            />
          </label>
          <button className={button} disabled={busy}>
            Save settings
          </button>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
      {history && (
        <div className="text-sm space-y-2">
          <button className={button} onClick={() => setHistory(null)}>
            Close history
          </button>
          {history.runs.map((r) => (
            <div key={r.id} className="border-t pt-2">
              <p>
                {new Date(r.started_at).toLocaleString()} · {r.status} · {r.pages} pages ·{" "}
                {r.records} records
              </p>
              {r.errors.map((e, i) => (
                <p key={i} className="text-destructive">
                  {e.message} {e.url}
                </p>
              ))}
            </div>
          ))}
          <p className="font-medium">Latest source URLs</p>
          {history.urls.map((u) => (
            <a
              key={u.source_url}
              href={u.source_url}
              target="_blank"
              rel="noreferrer"
              className="block break-all underline"
            >
              {u.source_url}
            </a>
          ))}
        </div>
      )}
    </article>
  );
}
type Review = {
  id: string;
  author_id: string;
  candidate_id: string;
  confidence_score: number;
  evidence: Record<string, unknown>;
  candidate?: { name: string; source_url: string | null; author_profile_url: string | null } | null;
};
function IdentityReview() {
  const [authors, setAuthors] = useState<ScoutAuthor[]>([]),
    [reviews, setReviews] = useState<Review[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const data = await api<{ authors: ScoutAuthor[]; reviews: Review[] }>(
        "/api/admin/scout-identity",
      );
      setAuthors(data.authors);
      setReviews(data.reviews);
    } catch (e) {
      setError(String(e));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function decide(e: FormEvent<HTMLFormElement>, author: ScoutAuthor) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(e.currentTarget);
    try {
      await api("/api/admin/scout-identity", {
        authorId: author.id,
        action: data.get("action"),
        evidence: data.get("evidence"),
        ...(data.get("target") ? { targetId: data.get("target") } : {}),
      });
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-3">
      <h3 className="text-lg font-semibold">Identity review</h3>
      <p className="text-sm text-muted-foreground">
        Compare linked sources before verifying or merging. Name-only matches must remain separate.
        A merge requires a fresh review of the surviving identity.
      </p>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {authors.length === 0 && <p>No identities awaiting review.</p>}
      {authors.map((a) => (
        <form key={a.id} onSubmit={(e) => decide(e, a)} className="rounded-xl border p-4 space-y-2">
          <p className="font-semibold">
            {a.name} · confidence {a.confidence_score}/100
          </p>
          <p className="text-xs break-all">Author ID: {a.id}</p>
          {a.source_url && (
            <a className="underline text-sm" href={a.source_url} target="_blank" rel="noreferrer">
              Original source
            </a>
          )}
          {a.author_profile_url && (
            <a
              className="ml-3 underline text-sm"
              href={a.author_profile_url}
              target="_blank"
              rel="noreferrer"
            >
              Author profile
            </a>
          )}
          <p className="text-xs">{JSON.stringify(a.qualification)}</p>
          {reviews
            .filter((r) => r.author_id === a.id)
            .map((r) => (
              <p key={r.id} className="text-xs break-all">
                Possible match: {r.candidate?.name ?? r.candidate_id} ({r.candidate_id}) ·{" "}
                {r.confidence_score}/100 · {JSON.stringify(r.evidence)}
                {r.candidate?.source_url && (
                  <a
                    href={r.candidate.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-2 underline"
                  >
                    Compare source
                  </a>
                )}
              </p>
            ))}
          <div className="grid sm:grid-cols-3 gap-2">
            <select name="action" className={input}>
              <option value="verify">Verify identity</option>
              <option value="reject">Reject record</option>
              <option value="merge">Merge into author</option>
            </select>
            <input
              name="target"
              className={input}
              placeholder="Target author UUID (merge only)"
              aria-label="Merge target author ID"
            />
            <input
              name="evidence"
              required
              minLength={10}
              maxLength={2000}
              className={input}
              placeholder="Evidence and source URLs"
              aria-label="Verification evidence"
            />
          </div>
          <button className={button} disabled={busy}>
            Save review
          </button>
        </form>
      ))}
    </section>
  );
}
