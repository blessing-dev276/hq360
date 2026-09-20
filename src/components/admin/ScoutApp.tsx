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
  contact_verification_status: string;
  bio: string | null;
  bio_source_url: string | null;
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

type Tab = "discover" | "batches" | "prospects" | "sources";

export function ScoutApp() {
  const [tab, setTab] = useState<Tab>("discover");
  const [focusedBatchId, setFocusedBatchId] = useState<string | null>(null);

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
          {(["discover", "batches", "prospects", "sources"] as const).map((t) => (
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

        {tab === "discover" ? (
          <DiscoverPanel
            onBatchGenerated={(batchId) => {
              setFocusedBatchId(batchId);
              setTab("batches");
            }}
          />
        ) : null}
        {tab === "batches" ? (
          <BatchesPanel
            initialBatchId={focusedBatchId}
            onConsumedInitial={() => setFocusedBatchId(null)}
          />
        ) : null}
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

const GENRE_OPTIONS = [
  "Fiction",
  "Nonfiction",
  "Fantasy",
  "Science Fiction",
  "Mystery",
  "Thriller",
  "Romance",
  "Horror",
  "Historical Fiction",
  "Literary Fiction",
  "Young Adult",
  "Biography",
  "Memoir",
  "Self-Help",
  "Business",
  "History",
  "Poetry",
  "Children's Books",
  "Graphic Novels",
  "Cookbooks",
  "Travel",
  "Religion",
  "Science",
  "Philosophy",
  "True Crime",
];

const AMOUNT_OPTIONS = [10, 20, 40];

function DiscoverPanel({ onBatchGenerated }: { onBatchGenerated: (batchId: string) => void }) {
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("");
  const [amount, setAmount] = useState(20);
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

  const [availability, setAvailability] = useState<{ total: number | null; checking: boolean }>({
    total: null,
    checking: false,
  });
  const [lastBatch, setLastBatch] = useState<{ id: string; count: number } | null>(null);

  useEffect(() => {
    api<{ ok: boolean; items: ScoutSource[] }>("/api/admin/scout-sources").then(({ body }) => {
      if (body.ok) setSources(body.items);
    });
  }, []);

  // Show how many works/authors the enabled sources report for this
  // genre/query before committing to a full discovery run.
  useEffect(() => {
    if (!query.trim() && !genre.trim()) {
      setAvailability({ total: null, checking: false });
      return;
    }
    const enabledSlugs = sources.filter((s) => s.enabled).map((s) => s.slug);
    if (enabledSlugs.length === 0) return;
    let cancelled = false;
    setAvailability((prev) => ({ ...prev, checking: true }));
    const timer = window.setTimeout(async () => {
      const { body } = await api<{ ok: boolean; total: number | null }>(
        "/api/admin/scout-discover-count",
        {
          method: "POST",
          body: JSON.stringify({
            query: query.trim() || undefined,
            genre: genre || undefined,
            sources: enabledSlugs,
          }),
        },
      );
      if (!cancelled) setAvailability({ total: body.ok ? body.total : null, checking: false });
    }, 500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, genre, sources]);

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
    if (!query.trim() && !genre.trim()) return;
    setSearching(true);
    setError("");
    setLastBatch(null);
    const enabledSlugs = sources.filter((s) => s.enabled).map((s) => s.slug);
    const { status, body } = await api<{
      ok: boolean;
      error?: string;
      batchId?: string;
      count?: number;
    }>("/api/admin/scout-discover", {
      method: "POST",
      body: JSON.stringify({
        query: query.trim() || undefined,
        genre: genre || undefined,
        sources: enabledSlugs,
        maxResults: amount,
      }),
    });
    setSearching(false);
    if (status !== 200 || !body.ok) {
      setError(
        body.error === "no_enabled_sources"
          ? "No discovery sources are enabled."
          : "Search failed.",
      );
      return;
    }
    if (body.batchId) setLastBatch({ id: body.batchId, count: body.count ?? 0 });
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
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
          <input
            className={input}
            placeholder="Title, author, or keyword (optional if genre is set)…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select className={input} value={genre} onChange={(e) => setGenre(e.target.value)}>
            <option value="">No genre filter</option>
            {GENRE_OPTIONS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
          <select
            className={input}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
          >
            {AMOUNT_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n} results
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={searching || (!query.trim() && !genre.trim())}
            className={cn(pillButton, "px-6 py-2.5 text-sm")}
          >
            {searching ? "Searching…" : "Discover"}
          </button>
        </div>
        {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
        {availability.checking ? (
          <p className="mt-2 text-xs text-muted-foreground">Checking availability…</p>
        ) : availability.total !== null ? (
          <p className="mt-2 text-xs text-muted-foreground">
            {availability.total.toLocaleString()} authors/works listed for this{" "}
            {query.trim() ? "search" : "genre"} across enabled sources — {amount} will be pulled in.
          </p>
        ) : null}
        {lastBatch ? (
          <p className="mt-2 rounded-lg bg-brand/10 px-3 py-2 text-xs text-brand">
            Batch generated with {lastBatch.count} book{lastBatch.count === 1 ? "" : "s"}.{" "}
            <button
              type="button"
              className="font-semibold underline"
              onClick={() => onBatchGenerated(lastBatch.id)}
            >
              View batch to export
            </button>
          </p>
        ) : null}
        <p className="mt-2 text-xs text-muted-foreground">
          Leave the search box empty and pick only a genre to browse by genre. Country isn't
          searchable directly — Google Books/Open Library don't expose author nationality, so use
          the country filter below once it's been researched for an author (see the Prospects tab).
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Authors already discovered in an earlier search are skipped — see the Prospects tab for
          authors you've already found.
        </p>
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

/* ----------------------------------------------------------------- batches */

type ScoutBatch = {
  id: string;
  created_at: string;
  label: string;
  genre: string | null;
  query: string | null;
  sources: string[];
  requested_max: number | null;
  total_available: number | null;
  item_count: number;
};

function BatchesPanel({
  initialBatchId,
  onConsumedInitial,
}: {
  initialBatchId: string | null;
  onConsumedInitial: () => void;
}) {
  const [batches, setBatches] = useState<ScoutBatch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [batchBooks, setBatchBooks] = useState<ScoutBook[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [savingAll, setSavingAll] = useState(false);

  const loadBatches = useCallback(async () => {
    const { body } = await api<{ ok: boolean; items: ScoutBatch[] }>("/api/admin/scout-batches");
    if (body.ok) setBatches(body.items);
  }, []);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  useEffect(() => {
    if (initialBatchId) {
      setSelectedBatchId(initialBatchId);
      onConsumedInitial();
    }
  }, [initialBatchId, onConsumedInitial]);

  const openBatch = useCallback(async (id: string) => {
    setSelectedBatchId(id);
    setLoadingBooks(true);
    const { body } = await api<{ ok: boolean; items: ScoutBook[] }>(
      `/api/admin/scout-batches/${id}`,
    );
    if (body.ok) setBatchBooks(body.items);
    setLoadingBooks(false);
  }, []);

  useEffect(() => {
    if (selectedBatchId) openBatch(selectedBatchId);
  }, [selectedBatchId, openBatch]);

  async function exportBatch() {
    if (!selectedBatchId) return;
    setExporting(true);
    const res = await fetch(`/api/admin/scout-batches/${selectedBatchId}/export`, {
      method: "POST",
    });
    setExporting(false);
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `scout-batch-${selectedBatchId.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function saveAllToProspects() {
    if (!selectedBatchId) return;
    setSavingAll(true);
    for (const book of batchBooks) {
      if (!book.scout_authors) continue;
      await api("/api/admin/scout-prospects", {
        method: "POST",
        body: JSON.stringify({ scoutAuthorId: book.scout_authors.id, bookId: book.id }),
      });
    }
    await openBatch(selectedBatchId);
    setSavingAll(false);
  }

  const selectedBatch = batches.find((b) => b.id === selectedBatchId) ?? null;

  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-[280px_1fr]">
      <div className="divide-y divide-border rounded-2xl border border-border bg-card">
        {batches.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            No batches yet — run a discovery search to generate one.
          </p>
        ) : null}
        {batches.map((batch) => (
          <button
            key={batch.id}
            type="button"
            onClick={() => setSelectedBatchId(batch.id)}
            className={cn(
              "block w-full p-3 text-left text-sm hover:bg-secondary/50",
              selectedBatchId === batch.id ? "bg-secondary/60" : "",
            )}
          >
            <p className="font-semibold">{batch.label}</p>
            <p className="text-xs text-muted-foreground">
              {batch.item_count} book{batch.item_count === 1 ? "" : "s"}
              {batch.total_available !== null
                ? ` of ${batch.total_available.toLocaleString()} listed`
                : ""}
              {" · "}
              {new Date(batch.created_at).toLocaleDateString()}
            </p>
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card">
        {!selectedBatch ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Select a batch to view it.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
              <div>
                <p className="text-sm font-semibold">{selectedBatch.label}</p>
                <p className="text-xs text-muted-foreground">
                  Sources: {selectedBatch.sources.join(", ")}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={savingAll || batchBooks.length === 0}
                  className={outlineButton}
                  onClick={saveAllToProspects}
                >
                  {savingAll ? "Saving…" : "Save all to prospects"}
                </button>
                <button
                  type="button"
                  disabled={exporting || batchBooks.length === 0}
                  className={pillButton}
                  onClick={exportBatch}
                >
                  {exporting ? "Exporting…" : "Export batch to CSV"}
                </button>
              </div>
            </div>
            <div className="divide-y divide-border">
              {loadingBooks ? (
                <p className="p-6 text-center text-sm text-muted-foreground">Loading…</p>
              ) : null}
              {!loadingBooks && batchBooks.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">
                  No books in this batch.
                </p>
              ) : null}
              {batchBooks.map((book) => (
                <div key={book.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                  <div className="min-w-[220px] flex-1">
                    <p className="font-semibold">{book.title}</p>
                    <p className="text-muted-foreground">
                      {book.scout_authors?.name ?? "Unknown author"}
                    </p>
                  </div>
                  <span className="w-28 text-muted-foreground">{book.genre ?? "—"}</span>
                  <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium">
                    {book.scout_prospects && book.scout_prospects.length > 0
                      ? STATUS_LABEL[book.scout_prospects[0]!.status as ProspectStatus]
                      : "Not saved"}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
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
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
            <button
              type="button"
              className={outlineButton}
              onClick={() => setExpandedId(expandedId === prospect.id ? null : prospect.id)}
            >
              {expandedId === prospect.id ? "Hide research" : "Research author"}
            </button>
            {expandedId === prospect.id ? (
              <AuthorResearchPanel author={prospect.scout_authors} onUpdated={load} />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Country, publishing type, and website contact info aren't provided by
 * Google Books/Open Library -- staff enter them manually, or trigger a
 * single-URL fetch of the author's own site (never a directory crawl). */
function AuthorResearchPanel({
  author,
  onUpdated,
}: {
  author: ScoutAuthor;
  onUpdated: () => Promise<void>;
}) {
  const [country, setCountry] = useState(author.country ?? "");
  const [publishingType, setPublishingType] = useState(author.publishing_type ?? "unknown");
  const [websiteUrl, setWebsiteUrl] = useState(author.website_url ?? "");
  const [saving, setSaving] = useState(false);
  const [researching, setResearching] = useState(false);
  const [note, setNote] = useState("");

  async function saveDetails() {
    setSaving(true);
    await api(`/api/admin/scout-authors/${author.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        country: country.trim() || null,
        publishingType,
        websiteUrl: websiteUrl.trim() || null,
      }),
    });
    setSaving(false);
    await onUpdated();
  }

  async function researchWebsite() {
    if (!websiteUrl.trim()) return;
    setResearching(true);
    setNote("");
    const { body } = await api<{
      ok: boolean;
      error?: string;
      research?: { status: string; contactEmail?: string; contactFormUrl?: string };
    }>(`/api/admin/scout-authors/${author.id}/research-website`, {
      method: "POST",
      body: JSON.stringify({ websiteUrl: websiteUrl.trim() }),
    });
    setResearching(false);
    if (!body.ok) {
      setNote("Could not reach that website.");
    } else if (body.research?.status === "retrieved") {
      setNote(
        body.research.contactEmail
          ? `Found contact email: ${body.research.contactEmail}`
          : body.research.contactFormUrl
            ? "Found a contact form."
            : "Page fetched — no email or contact form detected.",
      );
    } else {
      setNote("Site could not be fetched.");
    }
    await onUpdated();
  }

  return (
    <div className="w-full rounded-xl border border-dashed border-border bg-secondary/30 p-3">
      <div className="grid gap-2 sm:grid-cols-4">
        <input
          className={input}
          placeholder="Country"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
        />
        <select
          className={input}
          value={publishingType}
          onChange={(e) => setPublishingType(e.target.value)}
        >
          <option value="unknown">Publishing type unknown</option>
          <option value="traditional">Traditional</option>
          <option value="independent">Independent</option>
          <option value="hybrid">Hybrid</option>
        </select>
        <input
          className={input}
          placeholder="Author's own website URL"
          value={websiteUrl}
          onChange={(e) => setWebsiteUrl(e.target.value)}
        />
        <div className="flex gap-2">
          <button type="button" disabled={saving} className={outlineButton} onClick={saveDetails}>
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            disabled={researching || !websiteUrl.trim()}
            className={outlineButton}
            onClick={researchWebsite}
          >
            {researching ? "Fetching…" : "Fetch site"}
          </button>
        </div>
      </div>
      {note ? <p className="mt-2 text-xs text-muted-foreground">{note}</p> : null}
      {author.contact_email || author.contact_form_url ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Contact on file: {author.contact_email ?? author.contact_form_url} (
          {author.contact_verification_status})
        </p>
      ) : null}
      {author.bio ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Bio: {author.bio}{" "}
          {author.bio_source_url ? (
            <a href={author.bio_source_url} target="_blank" rel="noreferrer" className="text-brand">
              source
            </a>
          ) : null}
        </p>
      ) : null}
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
