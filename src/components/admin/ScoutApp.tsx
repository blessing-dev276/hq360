import { useCallback, useEffect, useState, type FormEvent } from "react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ types */

type ReviewCount = {
  platform: string;
  review_count: number | null;
  rating: number | null;
  verified: boolean;
};

type ScoutAuthor = {
  id: string;
  name: string;
  country: string | null;
  publishing_type: string | null;
  website_url: string | null;
  contact_email: string | null;
  contact_form_url: string | null;
};

type ScoutBook = {
  id: string;
  scout_author_id: string;
  title: string;
  genre: string | null;
  publication_date: string | null;
  book_format: string | null;
  source_slug: string;
  source_url: string | null;
  scout_authors: ScoutAuthor | null;
  scout_review_counts: ReviewCount[];
  scout_prospects: { id: string; status: string }[];
};

type ProspectStatus =
  "new" | "research_needed" | "qualified" | "contacted" | "replied" | "interested" | "excluded";

type ScoutProspect = {
  id: string;
  status: ProspectStatus;
  excluded_reason: string | null;
  research_notes: string | null;
  do_not_contact: boolean;
  last_verified_at: string | null;
  audit_id: string | null;
  scout_authors: ScoutAuthor;
  scout_discovered_books: (ScoutBook & { scout_review_counts: ReviewCount[] }) | null;
};

type ScoutSource = {
  slug: string;
  name: string;
  kind: string;
  enabled: boolean;
  last_error: string | null;
};

const STATUS_LABEL: Record<ProspectStatus, string> = {
  new: "New",
  research_needed: "Research needed",
  qualified: "Qualified",
  contacted: "Contacted",
  replied: "Replied",
  interested: "Interested",
  excluded: "Excluded",
};

const PLATFORM_LABEL: Record<string, string> = {
  google_books: "Google Books",
  open_library: "Open Library",
  goodreads: "Goodreads",
  amazon: "Amazon",
  reedsy: "Reedsy",
  bookbub: "BookBub",
  other: "Other",
};

/* --------------------------------------------------------------- fetchers */

async function api<T>(url: string, init?: RequestInit): Promise<{ status: number; body: T }> {
  const res = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json" },
  });
  const body = (await res.json().catch(() => ({}))) as T;
  return { status: res.status, body };
}

const input =
  "w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
const pillButton =
  "rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60";
const outlineButton =
  "rounded-full border border-border px-4 py-1.5 text-xs font-medium hover:border-brand hover:text-brand disabled:opacity-40";

function reviewText(counts: ReviewCount[], platform: string) {
  const match = counts.find((c) => c.platform === platform);
  if (!match || match.review_count === null || !match.verified) return "—";
  return String(match.review_count);
}

/* ------------------------------------------------------------------- root */

type Tab = "discover" | "prospects" | "sources";

export function ScoutApp() {
  const [tab, setTab] = useState<Tab>("discover");

  return (
    <div className="min-h-[70vh] bg-secondary/40">
      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-6">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">
            HQ360 admin
          </p>
          <h1 className="mt-1 font-display text-2xl">Scout — Author Prospecting</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Discover books, screen review activity by platform, research authors, and build a
            qualified outreach list.
          </p>
        </div>

        <div className="mt-6 flex gap-1 rounded-full border border-border bg-card p-1 text-sm">
          {(["discover", "prospects", "sources"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "rounded-full px-4 py-1.5 font-medium capitalize transition",
                tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "discover" ? <DiscoverPanel /> : null}
        {tab === "prospects" ? <ProspectsPanel /> : null}
        {tab === "sources" ? <SourcesPanel /> : null}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- discover */

const REVIEW_THRESHOLDS = [
  { label: "Any", min: "", max: "" },
  { label: "0–5", min: "0", max: "5" },
  { label: "0–10", min: "0", max: "10" },
  { label: "0–20", min: "0", max: "20" },
  { label: "0–50", min: "0", max: "50" },
];

function DiscoverPanel() {
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("");
  const [sources, setSources] = useState<ScoutSource[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<ScoutBook[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());

  const [format, setFormat] = useState("");
  const [platform, setPlatform] = useState("google_books");
  const [threshold, setThreshold] = useState(0);
  const [country, setCountry] = useState("");
  const [publishingType, setPublishingType] = useState("");
  const [contactAvailable, setContactAvailable] = useState("");

  useEffect(() => {
    api<{ ok: boolean; items: ScoutSource[] }>("/api/admin/scout-sources").then(({ body }) => {
      if (body.ok) setSources(body.items);
    });
  }, []);

  const loadResults = useCallback(
    async (nextPage: number) => {
      const params = new URLSearchParams({ page: String(nextPage) });
      if (genre) params.set("genre", genre);
      if (format) params.set("format", format);
      if (platform) params.set("platform", platform);
      const t = REVIEW_THRESHOLDS[threshold] ?? REVIEW_THRESHOLDS[0]!;
      if (t.min) params.set("reviewMin", t.min);
      if (t.max) params.set("reviewMax", t.max);
      if (country) params.set("country", country);
      if (publishingType) params.set("publishingType", publishingType);
      if (contactAvailable) params.set("contactAvailable", contactAvailable);
      const { body } = await api<{ ok: boolean; items: ScoutBook[]; total: number }>(
        `/api/admin/scout-books?${params}`,
      );
      if (body.ok) {
        setResults(body.items);
        setTotal(body.total);
        setPage(nextPage);
      }
    },
    [genre, format, platform, threshold, country, publishingType, contactAvailable],
  );

  useEffect(() => {
    loadResults(0);
  }, [loadResults]);

  async function runSearch(event: FormEvent) {
    event.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setError("");
    const enabledSlugs = sources.filter((s) => s.enabled).map((s) => s.slug);
    const { status, body } = await api<{ ok: boolean; error?: string }>(
      "/api/admin/scout-discover",
      {
        method: "POST",
        body: JSON.stringify({ query, genre: genre || undefined, sources: enabledSlugs }),
      },
    );
    setSearching(false);
    if (status !== 200 || !body.ok) {
      setError(
        body.error === "no_enabled_sources"
          ? "No discovery sources are enabled."
          : "Search failed.",
      );
      return;
    }
    await loadResults(0);
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function saveProspects(bookIds: string[]) {
    setSavingIds((prev) => new Set([...prev, ...bookIds]));
    for (const bookId of bookIds) {
      const book = results.find((b) => b.id === bookId);
      if (!book?.scout_authors) continue;
      await api("/api/admin/scout-prospects", {
        method: "POST",
        body: JSON.stringify({ scoutAuthorId: book.scout_authors.id, bookId: book.id }),
      });
    }
    await loadResults(page);
    setSavingIds((prev) => {
      const next = new Set(prev);
      bookIds.forEach((id) => next.delete(id));
      return next;
    });
    setSelected(new Set());
  }

  const totalPages = Math.max(1, Math.ceil(total / 25));

  return (
    <div className="mt-6 space-y-6">
      <form onSubmit={runSearch} className="rounded-2xl border border-border bg-card p-5">
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr_auto]">
          <input
            className={input}
            placeholder="Search by title, author, or keyword…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <input
            className={input}
            placeholder="Genre (optional)"
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
          />
          <button
            type="submit"
            disabled={searching}
            className={cn(pillButton, "px-6 py-2.5 text-sm")}
          >
            {searching ? "Searching…" : "Discover"}
          </button>
        </div>
        {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
        <div className="mt-3 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
          Sources:
          {sources.map((s) => (
            <span
              key={s.slug}
              className={cn(
                "rounded-full px-2.5 py-1 font-medium",
                s.enabled ? "bg-brand/10 text-brand" : "bg-secondary text-muted-foreground",
              )}
            >
              {s.name}
            </span>
          ))}
        </div>
      </form>

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Filters
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <select className={input} value={format} onChange={(e) => setFormat(e.target.value)}>
            <option value="">Any format</option>
            <option value="ebook">Ebook</option>
            <option value="paperback">Paperback</option>
            <option value="hardcover">Hardcover</option>
            <option value="audiobook">Audiobook</option>
          </select>
          <select className={input} value={platform} onChange={(e) => setPlatform(e.target.value)}>
            {Object.entries(PLATFORM_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label} reviews
              </option>
            ))}
          </select>
          <select
            className={input}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
          >
            {REVIEW_THRESHOLDS.map((t, i) => (
              <option key={t.label} value={i}>
                {t.label} reviews
              </option>
            ))}
          </select>
          <input
            className={input}
            placeholder="Author country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          />
          <select
            className={input}
            value={publishingType}
            onChange={(e) => setPublishingType(e.target.value)}
          >
            <option value="">Any publishing type</option>
            <option value="traditional">Traditional</option>
            <option value="independent">Independent</option>
            <option value="hybrid">Hybrid</option>
            <option value="unknown">Unknown</option>
          </select>
          <select
            className={input}
            value={contactAvailable}
            onChange={(e) => setContactAvailable(e.target.value)}
          >
            <option value="">Any contact availability</option>
            <option value="true">Has contact info</option>
            <option value="false">No contact info</option>
          </select>
        </div>
        <button type="button" className={cn(outlineButton, "mt-3")} onClick={() => loadResults(0)}>
          Apply filters
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border p-4">
          <p className="text-sm font-semibold">
            {total} book{total === 1 ? "" : "s"} found
          </p>
          <button
            type="button"
            disabled={selected.size === 0}
            className={outlineButton}
            onClick={() => saveProspects([...selected])}
          >
            Save {selected.size > 0 ? selected.size : ""} to prospects
          </button>
        </div>
        <div className="divide-y divide-border">
          {results.map((book) => {
            const alreadyProspect = book.scout_prospects && book.scout_prospects.length > 0;
            return (
              <div key={book.id} className="flex flex-wrap items-center gap-3 p-4 text-sm">
                <input
                  type="checkbox"
                  checked={selected.has(book.id)}
                  onChange={() => toggleSelected(book.id)}
                  className="size-4"
                />
                <div className="min-w-[220px] flex-1">
                  <p className="font-semibold">{book.title}</p>
                  <p className="text-muted-foreground">
                    {book.scout_authors?.name ?? "Unknown author"}
                  </p>
                </div>
                <span className="w-28 text-muted-foreground">{book.genre ?? "—"}</span>
                <span className="w-24 text-muted-foreground">{book.publication_date ?? "—"}</span>
                <span className="w-32 text-xs text-muted-foreground">
                  GB {reviewText(book.scout_review_counts, "google_books")} · OL{" "}
                  {reviewText(book.scout_review_counts, "open_library")}
                </span>
                <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium">
                  {book.source_slug}
                </span>
                <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium">
                  {book.scout_authors?.contact_email || book.scout_authors?.contact_form_url
                    ? "Contact known"
                    : "No contact"}
                </span>
                <button
                  type="button"
                  disabled={alreadyProspect || savingIds.has(book.id)}
                  className={outlineButton}
                  onClick={() => saveProspects([book.id])}
                >
                  {alreadyProspect ? "Saved" : savingIds.has(book.id) ? "Saving…" : "Save"}
                </button>
              </div>
            );
          })}
          {results.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No books yet — run a discovery search above.
            </p>
          ) : null}
        </div>
        <div className="flex items-center justify-between border-t border-border p-4 text-xs text-muted-foreground">
          <span>
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page === 0}
              className={outlineButton}
              onClick={() => loadResults(page - 1)}
            >
              Previous
            </button>
            <button
              disabled={page + 1 >= totalPages}
              className={outlineButton}
              onClick={() => loadResults(page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- prospects */

function ProspectsPanel() {
  const [items, setItems] = useState<ScoutProspect[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = statusFilter ? `?status=${statusFilter}` : "";
    const { body } = await api<{ ok: boolean; items: ScoutProspect[] }>(
      `/api/admin/scout-prospects${params}`,
    );
    if (body.ok) setItems(body.items);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  async function updateStatus(id: string, status: ProspectStatus) {
    setBusyId(id);
    await api(`/api/admin/scout-prospects/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    await load();
    setBusyId(null);
  }

  async function runFullAudit(prospect: ScoutProspect) {
    if (!prospect.scout_discovered_books) return;
    setBusyId(prospect.id);
    const { body } = await api<{ ok: boolean; item?: { id: string } }>("/api/admin/author-audits", {
      method: "POST",
      body: JSON.stringify({
        authorName: prospect.scout_authors.name,
        bookTitle: prospect.scout_discovered_books.title,
        websiteUrl: prospect.scout_authors.website_url ?? undefined,
      }),
    });
    if (body.ok && body.item) {
      await api(`/api/admin/scout-prospects/${prospect.id}`, {
        method: "PATCH",
        body: JSON.stringify({ auditId: body.item.id, status: "research_needed" }),
      });
      await load();
    }
    setBusyId(null);
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function exportCsv(ids: string[]) {
    const res = await fetch("/api/admin/scout-export", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prospectIds: ids }),
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `scout-prospects-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const exportTargets = selected.size > 0 ? [...selected] : items.map((i) => i.id);

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
        <select
          className={cn(input, "w-56")}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={pillButton}
          disabled={exportTargets.length === 0}
          onClick={() => exportCsv(exportTargets)}
        >
          Export {selected.size > 0 ? `${selected.size} selected` : "all filtered"} to CSV
        </button>
      </div>

      <div className="divide-y divide-border rounded-2xl border border-border bg-card">
        {loading ? <p className="p-6 text-center text-sm text-muted-foreground">Loading…</p> : null}
        {!loading && items.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">No prospects saved yet.</p>
        ) : null}
        {items.map((prospect) => (
          <div key={prospect.id} className="flex flex-wrap items-center gap-3 p-4 text-sm">
            <input
              type="checkbox"
              checked={selected.has(prospect.id)}
              onChange={() => toggleSelected(prospect.id)}
              className="size-4"
            />
            <div className="min-w-[220px] flex-1">
              <p className="font-semibold">{prospect.scout_authors.name}</p>
              <p className="text-muted-foreground">
                {prospect.scout_discovered_books?.title ?? "No linked book"}
              </p>
            </div>
            <select
              className={cn(input, "w-40")}
              value={prospect.status}
              disabled={busyId === prospect.id}
              onChange={(e) => updateStatus(prospect.id, e.target.value as ProspectStatus)}
            >
              {Object.entries(STATUS_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {prospect.do_not_contact ? (
              <span className="rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
                Do not contact
              </span>
            ) : null}
            <button
              type="button"
              className={outlineButton}
              disabled={busyId === prospect.id || !prospect.scout_discovered_books}
              onClick={() => runFullAudit(prospect)}
            >
              {prospect.audit_id ? "Re-run full audit" : "Run full author audit"}
            </button>
            <span
              className="text-xs text-muted-foreground"
              title="Outreach drafting ships in a later stage"
            >
              Outreach draft — coming soon
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- sources */

function SourcesPanel() {
  const [items, setItems] = useState<ScoutSource[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const { body } = await api<{ ok: boolean; items: ScoutSource[] }>("/api/admin/scout-sources");
    if (body.ok) setItems(body.items);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(source: ScoutSource) {
    setBusy(source.slug);
    setError("");
    const { status, body } = await api<{ ok: boolean; error?: string }>(
      `/api/admin/scout-sources/${source.slug}`,
      {
        method: "PATCH",
        body: JSON.stringify({ enabled: !source.enabled }),
      },
    );
    if (status !== 200 || !body.ok) {
      setError(
        body.error === "source_not_implemented"
          ? `${source.name} has no authorized programmatic access yet — it can't be enabled until an adapter ships.`
          : "Could not update source.",
      );
    }
    await load();
    setBusy(null);
  }

  return (
    <div className="mt-6 space-y-3">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="divide-y divide-border rounded-2xl border border-border bg-card">
        {items.map((source) => (
          <div key={source.slug} className="flex flex-wrap items-center gap-3 p-4 text-sm">
            <div className="min-w-[200px] flex-1">
              <p className="font-semibold">{source.name}</p>
              <p className="text-xs text-muted-foreground capitalize">
                {source.kind.replace("_", " ")}
              </p>
            </div>
            {source.last_error ? (
              <span className="rounded-full bg-destructive/10 px-2.5 py-1 text-xs text-destructive">
                {source.last_error}
              </span>
            ) : null}
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-medium",
                source.enabled ? "bg-brand/10 text-brand" : "bg-secondary text-muted-foreground",
              )}
            >
              {source.enabled ? "Enabled" : "Disabled"}
            </span>
            <button
              type="button"
              disabled={busy === source.slug || source.kind === "unimplemented"}
              className={outlineButton}
              onClick={() => toggle(source)}
              title={
                source.kind === "unimplemented"
                  ? "No authorized API — implement an adapter first"
                  : undefined
              }
            >
              {source.enabled ? "Disable" : "Enable"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
