import { useCallback, useEffect, useState } from "react";
import { Bookmark, Check, Download, ExternalLink, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { canonicalUrl } from "@/lib/scout/normalize";

type Book = {
  id: string;
  title: string;
  asin: string | null;
  genre: string | null;
  source_url: string | null;
  source_slug: string;
  discovered_at?: string | null;
  batch_id?: string | null;
  scout_authors: { id: string; name: string; country: string | null } | null;
  scout_review_counts: { platform: string; review_count: number | null }[];
  scout_prospects: { id: string; status: string }[];
  scout_batches?: { id: string; label: string; created_at: string } | null;
  localOnly?: boolean;
};

type UnqualifiedResult = {
  key: string;
  title: string;
  authorName: string | null;
  ratingLabel: string;
  sourceUrl: string;
  genre: string;
  reasons: string[];
};

type ReedsyGenre = { id: number; name: string; emoji: string; depth: number; bookCount: number };

type ContactResult = {
  found: boolean;
  candidateUrl: string | null;
  candidateTitle: string | null;
  contactEmail: string | null;
  contactFormUrl: string | null;
  message?: string;
};

type BatchGroup = { batchId: string; label: string; createdAt: string | null; books: Book[] };

function formatDiscoveredAt(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function groupByBatch(books: Book[]): BatchGroup[] {
  const groups = new Map<string, BatchGroup>();
  for (const book of books) {
    const batchId = book.scout_batches?.id ?? book.batch_id ?? "ungrouped";
    const existing = groups.get(batchId);
    if (existing) {
      existing.books.push(book);
      continue;
    }
    groups.set(batchId, {
      batchId,
      label: book.scout_batches?.label ?? "Earlier / ungrouped saves",
      createdAt: book.scout_batches?.created_at ?? null,
      books: [book],
    });
  }
  return [...groups.values()].sort((a, b) => {
    if (!a.createdAt) return 1;
    if (!b.createdAt) return -1;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

async function api<T>(url: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    ...(body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(20000)])
      : AbortSignal.timeout(60000),
  });
  const result = await response.json();
  if (!response.ok || !result.ok) {
    const messages: Record<string, string> = {
      storage: "The book could not be saved. Please try again.",
      unauthorized:
        "Your sign-in has expired. Refresh and sign in again. Your browser copy can still be exported.",
    };
    throw new Error(
      result.message ?? messages[result.error] ?? "Scout could not complete that request.",
    );
  }
  return result;
}

function PublicLink({ url, children }: { url: string | null; children: React.ReactNode }) {
  const safe = canonicalUrl(url ?? undefined);
  return safe ? (
    <a
      href={safe}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-sm text-brand hover:underline"
    >
      {children}
      <ExternalLink className="h-3 w-3" />
    </a>
  ) : null;
}

function ContactFinder({
  authorId,
  busy,
  result,
  onFind,
}: {
  authorId: string;
  busy: boolean;
  result: ContactResult | undefined;
  onFind: (authorId: string) => void;
}) {
  return (
    <div className="mt-3">
      <button
        type="button"
        disabled={busy}
        onClick={() => onFind(authorId)}
        className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
        {busy ? "Searching…" : "Find contact info"}
      </button>
      {result && (
        <p className="mt-2 text-xs text-muted-foreground">
          {result.found ? (
            <>
              Candidate site:{" "}
              <PublicLink url={result.candidateUrl}>
                {result.candidateTitle ?? result.candidateUrl}
              </PublicLink>
              {result.contactEmail
                ? ` · email found: ${result.contactEmail}`
                : result.contactFormUrl
                  ? " · contact form found"
                  : " · no contact method found"}
              {" — unverified, confirm before outreach."}
            </>
          ) : (
            (result.message ?? "No likely official website found.")
          )}
        </p>
      )}
    </div>
  );
}

function csvCell(value: string | number | null | undefined) {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function ScoutApp() {
  const [resultLimit, setResultLimit] = useState(20);
  const [debutOnly, setDebutOnly] = useState(false);
  const [reedsyMinRating, setReedsyMinRating] = useState(1);
  const [reedsyBooks, setReedsyBooks] = useState<Book[]>([]);
  const [reedsyUnqualified, setReedsyUnqualified] = useState<UnqualifiedResult[]>([]);
  const [reedsySavedOnly, setReedsySavedOnly] = useState(false);
  const [reedsyLoading, setReedsyLoading] = useState(true);
  const [reedsyGenres, setReedsyGenres] = useState<ReedsyGenre[]>([]);
  const [reedsyGenreId, setReedsyGenreId] = useState<number | null>(null);
  const [contactBusy, setContactBusy] = useState("");
  const [contactResults, setContactResults] = useState<Record<string, ContactResult>>({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refresh, setRefresh] = useState(0);

  const reedsyGenre = reedsyGenres.find((item) => item.id === reedsyGenreId) ?? null;

  useEffect(() => {
    const controller = new AbortController();
    api<{ genres: ReedsyGenre[] }>("/api/admin/scout-reedsy-genres", undefined, controller.signal)
      .then((data) => {
        setReedsyGenres(data.genres);
        setReedsyGenreId((current) => current ?? data.genres[0]?.id ?? null);
      })
      .catch((caught) => {
        if (!controller.signal.aborted)
          setError(caught instanceof Error ? caught.message : "Could not load Reedsy genres.");
      });
    return () => controller.abort();
  }, []);

  const loadReedsyBooks = useCallback(
    (signal?: AbortSignal) => {
      if (!reedsyGenre) return Promise.resolve();
      setReedsyLoading(true);
      const params = new URLSearchParams({ source: "reedsy_discovery", genre: reedsyGenre.name });
      return api<{ items: Book[] }>(`/api/admin/scout-books?${params}`, undefined, signal)
        .then((data) => setReedsyBooks(data.items))
        .catch((caught) => {
          if (!signal?.aborted)
            setError(caught instanceof Error ? caught.message : "Could not load Reedsy books.");
        })
        .finally(() => {
          if (!signal?.aborted) setReedsyLoading(false);
        });
    },
    [reedsyGenre],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadReedsyBooks(controller.signal);
    return () => controller.abort();
  }, [loadReedsyBooks, refresh]);

  async function ingestBook(book: Book, batch?: { id: string; label: string }) {
    const reviewEntry = book.scout_review_counts[0];
    const result = await api<{
      item: {
        book: Omit<Book, "scout_authors" | "scout_review_counts" | "scout_prospects">;
        author: NonNullable<Book["scout_authors"]>;
      };
    }>("/api/admin/scout-manual-ingest", {
      sourceSlug: book.source_slug,
      sourceUrl: book.source_url,
      bookUrl: book.source_url,
      authorName: book.scout_authors?.name,
      bookTitle: book.title,
      genre: book.genre,
      country: book.scout_authors?.country ?? undefined,
      ...(reviewEntry && reviewEntry.review_count !== null
        ? { reviewPlatform: reviewEntry.platform, reviewCount: reviewEntry.review_count }
        : {}),
      ...(batch ? { batchId: batch.id, batchLabel: batch.label } : {}),
    });
    return {
      ...book,
      ...result.item.book,
      scout_authors: result.item.author,
      scout_batches: batch
        ? { id: batch.id, label: batch.label, created_at: new Date().toISOString() }
        : null,
      localOnly: false,
    } satisfies Book;
  }

  async function runReedsySearch() {
    if (!reedsyGenre) return;
    setBusy("reedsy-search");
    setError("");
    setNotice("Searching Reedsy Discovery and checking each result against your filters…");
    try {
      const result = await api<{
        items: Array<{
          title: string;
          authorName: string | null;
          sourceUrl: string;
          verdictRating: number | null;
          genre: string;
          qualified: boolean;
          reasons: string[];
        }>;
        searched: number;
        qualifying: number;
      }>("/api/admin/scout-reedsy-search", {
        genreId: reedsyGenre.id,
        genreName: reedsyGenre.name,
        limit: resultLimit,
        minVerdictRating: reedsyMinRating,
        debutOnly,
      });
      const qualifiedItems = result.items.filter((item) => item.qualified);
      const unqualifiedItems = result.items.filter((item) => !item.qualified);

      // The same book being found again on a later search (same genre or
      // not) must not create a second row -- skip re-ingesting anything
      // whose source URL is already saved, rather than relying only on the
      // server's upsert-on-conflict behavior.
      const knownUrls = new Set(reedsyBooks.map((book) => book.source_url));
      const alreadySavedCount = qualifiedItems.filter((item) =>
        knownUrls.has(item.sourceUrl),
      ).length;
      const newQualifiedItems = qualifiedItems.filter((item) => !knownUrls.has(item.sourceUrl));

      const batchId = crypto.randomUUID();
      const batchLabel =
        `Reedsy: ${reedsyGenre.name} · min ${reedsyMinRating}/5` +
        `${debutOnly ? " · debut only" : ""} · ${new Date().toLocaleString()}`;
      const batch = { id: batchId, label: batchLabel };

      const candidates: Book[] = newQualifiedItems.map((item, index) => ({
        id: `local-reedsy-${index}-${item.sourceUrl}`,
        title: item.title,
        asin: null,
        genre: item.genre,
        source_url: item.sourceUrl,
        source_slug: "reedsy_discovery",
        discovered_at: new Date().toISOString(),
        scout_authors: {
          id: `local-reedsy-${index}-${item.sourceUrl}`,
          name: item.authorName!,
          country: null,
        },
        scout_review_counts:
          item.verdictRating === null
            ? []
            : [{ platform: "reedsy", review_count: item.verdictRating }],
        scout_prospects: [],
        localOnly: true,
      }));
      setReedsySavedOnly(false);
      setReedsyUnqualified(
        unqualifiedItems.map((item, index) => ({
          key: `${index}-${item.sourceUrl}`,
          title: item.title,
          authorName: item.authorName,
          ratingLabel:
            item.verdictRating === null ? "no review score found" : `${item.verdictRating}/5`,
          sourceUrl: item.sourceUrl,
          genre: item.genre,
          reasons: item.reasons,
        })),
      );
      const settled = await Promise.allSettled(candidates.map((book) => ingestBook(book, batch)));
      const saved = settled.flatMap((item) => (item.status === "fulfilled" ? [item.value] : []));
      const failed = settled.length - saved.length;
      setReedsyBooks((current) => [
        ...saved,
        ...current.filter((book) => !saved.some((item) => item.source_url === book.source_url)),
      ]);
      setNotice(
        `${result.items.length} Reedsy results checked: ${candidates.length} new qualified` +
          ` (${saved.length} saved to your account${failed ? `, ${failed} failed to save — rerun the search to retry them` : ""})` +
          `${alreadySavedCount ? `, ${alreadySavedCount} already saved from an earlier search` : ""}` +
          ` and ${unqualifiedItems.length} did not qualify. All results are available to export below.`,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Reedsy search failed.");
      setNotice("");
    } finally {
      setBusy("");
    }
  }

  async function save(book: Book) {
    if (!book.scout_authors) return;
    setBusy(book.id);
    setError("");
    try {
      await api("/api/admin/scout-prospects", {
        scoutAuthorId: book.scout_authors.id,
        bookId: book.id,
      });
      setRefresh((value) => value + 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save this author.");
    } finally {
      setBusy("");
    }
  }

  async function findContact(authorId: string) {
    setContactBusy(authorId);
    setError("");
    try {
      const result = await api<ContactResult>(
        `/api/admin/scout-authors/${authorId}/find-contact`,
        {},
      );
      setContactResults((current) => ({ ...current, [authorId]: result }));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not search for this author's contact info.",
      );
    } finally {
      setContactBusy("");
    }
  }

  const reedsyVisibleBooks = reedsySavedOnly
    ? reedsyBooks.filter((book) => book.scout_prospects.length > 0)
    : reedsyBooks;
  const reedsyBatchGroups = groupByBatch(reedsyVisibleBooks);

  function downloadCsv(
    rows: (string | number | null | undefined)[][],
    genreLabel: string,
    filenameSuffix: string,
  ) {
    const header = [
      "Author name",
      "Book title",
      "Rating",
      "Genre",
      "Reference",
      "URL",
      "Qualified",
      "Notes",
      "Discovered",
    ];
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `hq360-${genreLabel.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}-${filenameSuffix}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function bookRow(book: Book) {
    const rating = book.scout_review_counts.find((item) => item.platform === "reedsy");
    return [
      book.scout_authors?.name,
      book.title,
      rating?.review_count === undefined || rating.review_count === null
        ? null
        : `${rating.review_count}/5`,
      book.genre,
      null,
      book.source_url,
      "Yes",
      "",
      formatDiscoveredAt(book.discovered_at),
    ];
  }

  function exportReedsyCsv(books: Book[], filenameSuffix: string) {
    const qualifiedRows = books.map(bookRow);
    const unqualifiedRows = reedsyUnqualified.map((item) => [
      item.authorName,
      item.title,
      item.ratingLabel,
      item.genre,
      null,
      item.sourceUrl,
      "No",
      item.reasons.join("; "),
      null,
    ]);
    downloadCsv(
      [...qualifiedRows, ...unqualifiedRows],
      reedsyGenre?.name ?? "reedsy",
      filenameSuffix,
    );
  }

  return (
    <div className="min-h-[70vh] bg-secondary/30">
      <div className="mx-auto max-w-5xl px-5 py-10 sm:px-6">
        <p className="text-xs font-semibold tracking-widest text-brand uppercase">HQ360 Scout</p>
        <h1 className="mt-2 font-display text-3xl">Find new and debut authors on Reedsy</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Reedsy Discovery only features self-published and indie authors who submitted a book for
          editorial review — the pool is inherently new/aspiring authors. Each book gets one
          reviewer's 1–5 score instead of a rating count.
        </p>

        <section className="mt-7 rounded-2xl border border-border bg-card p-5">
          <h2 className="font-semibold">Search Reedsy Discovery and save qualified authors</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-sm font-medium" htmlFor="reedsy-genre">
              Genre
              <select
                id="reedsy-genre"
                value={reedsyGenreId ?? ""}
                onChange={(event) => setReedsyGenreId(Number(event.target.value))}
                disabled={reedsyGenres.length === 0}
                className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3"
              >
                {reedsyGenres.length === 0 && <option>Loading genres…</option>}
                {reedsyGenres.map((item) => (
                  <option key={item.id} value={item.id}>
                    {"—".repeat(item.depth)}
                    {item.depth > 0 ? " " : ""}
                    {item.emoji} {item.name} ({item.bookCount})
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium" htmlFor="reedsy-limit">
              Authors to find
              <input
                id="reedsy-limit"
                type="number"
                min="1"
                max="50"
                value={resultLimit}
                onChange={(event) =>
                  setResultLimit(Math.min(50, Math.max(1, Number(event.target.value) || 1)))
                }
                className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3"
              />
            </label>
            <label className="text-sm font-medium" htmlFor="reedsy-min-rating">
              Minimum Reedsy score
              <select
                id="reedsy-min-rating"
                value={reedsyMinRating}
                onChange={(event) => setReedsyMinRating(Number(event.target.value))}
                className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3"
              >
                <option value={1}>Any score</option>
                <option value={2}>2/5 or higher</option>
                <option value={3}>3/5 or higher</option>
                <option value={4}>4/5 or higher</option>
                <option value={5}>5/5 only</option>
              </select>
            </label>
            <label className="flex items-center gap-2 self-end pb-3 text-sm font-medium">
              <input
                type="checkbox"
                checked={debutOnly}
                onChange={(event) => setDebutOnly(event.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              Debut authors only
            </label>
          </div>
          <button
            type="button"
            disabled={Boolean(busy) || !reedsyGenre}
            onClick={runReedsySearch}
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
          >
            {busy === "reedsy-search" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            {busy === "reedsy-search" ? "Searching and saving…" : "Search Reedsy"}
          </button>
          <p className="mt-3 text-xs text-muted-foreground">
            Genres and book counts come straight from Reedsy's own catalog. Results are saved
            automatically with the date found, grouped below by the search that found them;
            searching the same genre again skips anything already saved rather than duplicating it.
          </p>
        </section>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-destructive/10 p-4 text-sm text-destructive"
          >
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="mt-4 rounded-xl bg-primary/10 p-4 text-sm">
            {notice}
          </p>
        )}

        <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1 rounded-full border bg-card p-1">
            {[false, true].map((saved) => (
              <button
                key={String(saved)}
                onClick={() => setReedsySavedOnly(saved)}
                className={cn(
                  "rounded-full px-4 py-2 text-sm",
                  reedsySavedOnly === saved
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground",
                )}
              >
                {saved ? "Saved Reedsy authors" : "Imported Reedsy authors"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <p className="text-sm text-muted-foreground">
              {reedsyVisibleBooks.length} qualified · {reedsyUnqualified.length} not qualified
            </p>
            <button
              type="button"
              disabled={reedsyBooks.length === 0 && reedsyUnqualified.length === 0}
              onClick={() => exportReedsyCsv(reedsyVisibleBooks, "reedsy-authors")}
              className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium disabled:opacity-40"
            >
              <Download className="h-4 w-4" /> Export Reedsy results (CSV)
            </button>
          </div>
        </div>

        {reedsyLoading && reedsyVisibleBooks.length === 0 ? (
          <div role="status" className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="sr-only">Loading Reedsy authors</span>
          </div>
        ) : reedsyVisibleBooks.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed p-12 text-center">
            <h2 className="font-semibold">No qualifying Reedsy authors imported yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Choose the genre above, then run the Reedsy search.
            </p>
          </div>
        ) : (
          reedsyBatchGroups.map((group) => (
            <div key={group.batchId} className="mt-8">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-semibold">{group.label}</h2>
                  <p className="text-xs text-muted-foreground">{group.books.length} authors</p>
                </div>
                <button
                  type="button"
                  onClick={() => exportReedsyCsv(group.books, `reedsy-batch-${group.batchId}`)}
                  className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs"
                >
                  <Download className="h-3.5 w-3.5" /> Export this batch
                </button>
              </div>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                {group.books.map((book) => {
                  const saved = book.scout_prospects.length > 0;
                  const rating = book.scout_review_counts.find(
                    (item) => item.platform === "reedsy",
                  );
                  return (
                    <article key={book.id} className="rounded-2xl border border-border bg-card p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold">{book.scout_authors?.name}</h3>
                          <p className="mt-1 text-sm font-medium">{book.title}</p>
                        </div>
                        <button
                          disabled={saved || Boolean(busy)}
                          onClick={() => save(book)}
                          className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs disabled:opacity-60"
                        >
                          {saved ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <Bookmark className="h-3.5 w-3.5" />
                          )}
                          {saved ? "Saved" : busy === book.id ? "Saving…" : "Save"}
                        </button>
                      </div>
                      <p className="mt-3 text-sm text-muted-foreground">
                        {book.genre} ·{" "}
                        {rating?.review_count === undefined || rating.review_count === null
                          ? "no Reedsy score on file"
                          : `${rating.review_count}/5 Reedsy score`}
                      </p>
                      {formatDiscoveredAt(book.discovered_at) && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Found {formatDiscoveredAt(book.discovered_at)}
                        </p>
                      )}
                      {book.scout_authors && (
                        <ContactFinder
                          authorId={book.scout_authors.id}
                          busy={contactBusy === book.scout_authors.id}
                          result={contactResults[book.scout_authors.id]}
                          onFind={findContact}
                        />
                      )}
                      <div className="mt-4">
                        <PublicLink url={book.source_url}>View Reedsy listing</PublicLink>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          ))
        )}

        {reedsyUnqualified.length > 0 && (
          <div className="mt-10">
            <h2 className="font-semibold">Not qualified from the last Reedsy search</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              These didn't meet your filters, but are shown here and included in the export so
              nothing found is hidden.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {reedsyUnqualified.map((item) => (
                <article
                  key={item.key}
                  className="rounded-2xl border border-dashed border-border bg-card/60 p-5"
                >
                  <h3 className="text-lg font-semibold">{item.authorName ?? "Unknown author"}</h3>
                  <p className="mt-1 text-sm font-medium">{item.title}</p>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {item.genre} · {item.ratingLabel}
                  </p>
                  <p className="mt-2 text-xs text-destructive">{item.reasons.join("; ")}</p>
                  <div className="mt-4">
                    <PublicLink url={item.sourceUrl}>View Reedsy listing</PublicLink>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
