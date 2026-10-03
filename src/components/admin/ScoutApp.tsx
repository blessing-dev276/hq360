import { ArcScout } from "./ArcScout";
import { PresenceNote, type Presence } from "./PresenceNote";
import { ARC_SOURCES, isArcSource } from "@/lib/scout/arc-sources";
import { AudienceScout } from "./AudienceScout";
import { SCOUT_AUDIENCES } from "@/lib/scout/audiences";
import { useEffect, useRef, useState } from "react";
import {
  Bookmark,
  Check,
  Download,
  ExternalLink,
  Loader2,
  Search,
  ShieldCheck,
} from "lucide-react";
import { GlassLoading } from "@/components/ui/glass-loading";
import { useQueryClient } from "@tanstack/react-query";
import { canonicalUrl } from "@/lib/scout/normalize";

type Book = {
  id: string;
  presence?: Presence;
  title: string;
  asin: string | null;
  isbn?: string | null;
  publication_date?: string | null;
  publication_year?: number | null;
  publisher?: string | null;
  book_format?: string | null;
  genre: string | null;
  source_url: string | null;
  source_slug: string;
  description?: string | null;
  discovered_at?: string | null;
  batch_id?: string | null;
  scout_authors: {
    id: string;
    name: string;
    country: string | null;
    bio?: string | null;
    website_url?: string | null;
    contact_email?: string | null;
    contact_verification_status?: string | null;
    contact_form_url?: string | null;
    publishing_type?: string | null;
    author_profile_url?: string | null;
    social_links?: string[];
  } | null;
  scout_review_counts: { platform: string; review_count: number | null; rating?: number | null }[];
  scout_prospects: { id: string; status: string }[];
  scout_batches?: { id: string; label: string; created_at: string } | null;
  localOnly?: boolean;
};

type ReedsyGenre = { id: number; name: string; emoji: string; depth: number; bookCount: number };

function formatDiscoveredAt(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

async function api<T>(
  url: string,
  body?: unknown,
  signal?: AbortSignal,
  fallbackMessage = "Scout could not complete that request.",
): Promise<T> {
  const response = await fetch(url, {
    ...(body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(60000)])
      : AbortSignal.timeout(60000),
  });
  const result = await response.json();
  if (!response.ok || result.ok === false) {
    const messages: Record<string, string> = {
      unauthorized:
        "Your sign-in has expired. Refresh and sign in again. Your browser copy can still be exported.",
    };
    throw new Error(result.message ?? messages[result.error] ?? result.error ?? fallbackMessage);
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

function csvCell(value: string | number | null | undefined) {
  let text = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function BookCard({
  book,
  busy,
  onSave,
}: {
  book: Book;
  busy: string;
  onSave: (book: Book) => void;
}) {
  const saved = book.scout_prospects.length > 0;
  const rating = book.scout_review_counts.find(
    (item) =>
      item.platform === (book.source_slug === "reedsy_discovery" ? "reedsy" : "readers_favorite"),
  );
  const score = rating?.rating ?? (rating?.platform === "reedsy" ? rating.review_count : null);
  const sourceLabel = isArcSource(book.source_slug)
    ? ARC_SOURCES[book.source_slug].name
    : book.source_slug === "reedsy_discovery"
      ? "Reedsy"
      : "Readers’ Favorite";
  return (
    <article className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">{book.scout_authors?.name}</h3>
          <p className="mt-1 text-sm font-medium">{book.title}</p>
          <PresenceNote presence={book.presence} />
        </div>
        <button
          disabled={saved || Boolean(busy)}
          onClick={() => onSave(book)}
          className="inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-xs disabled:opacity-60"
        >
          {saved ? <Check className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
          {saved ? "Scouted" : busy === book.id ? "Marking…" : "Mark scouted"}
        </button>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        {book.genre} ·{" "}
        {score === undefined || score === null
          ? "Score unavailable"
          : `${score}/5 · ${sourceLabel}`}
      </p>
      {book.description && <p className="mt-2 text-sm text-muted-foreground">{book.description}</p>}
      {formatDiscoveredAt(book.discovered_at) && (
        <p className="mt-1 text-xs text-muted-foreground">
          Found {formatDiscoveredAt(book.discovered_at)}
        </p>
      )}
      {book.scout_authors && (
        <div className="mt-4 space-y-2 text-sm">
          <p>{book.scout_authors.bio}</p>
          <p className="text-muted-foreground">
            Country: {book.scout_authors.country || "Unknown"} · Publishing:{" "}
            {book.scout_authors.publishing_type || "Unknown"}
          </p>
          {book.scout_authors.contact_email && (
            <p className="break-all">
              Contact: {book.scout_authors.contact_email} ·{" "}
              {book.scout_authors.contact_verification_status === "verified"
                ? "Verified"
                : "Unverified"}
            </p>
          )}
          <div className="flex flex-wrap gap-4">
            <PublicLink url={book.scout_authors.website_url ?? null}>Website</PublicLink>
            <PublicLink url={book.scout_authors.contact_form_url ?? null}>Contact form</PublicLink>
            <PublicLink url={book.scout_authors.author_profile_url ?? null}>
              Author profile
            </PublicLink>
            {book.scout_authors.social_links?.map((url) => (
              <PublicLink key={url} url={url}>
                {url}
              </PublicLink>
            ))}
          </div>
        </div>
      )}
      <div className="mt-4">
        <PublicLink url={book.source_url}>View {sourceLabel} listing</PublicLink>
      </div>
    </article>
  );
}

type Batch = {
  id: string;
  label: string;
  created_at: string;
  sources: string[];
  genre: string | null;
  item_count: number;
};
type Candidate = {
  title: string;
  authorName: string | null;
  sourceUrl: string;
  genre: string;
  rating: number | null;
  overview?: string | null;
};
const RF_DEFAULT = "/book-reviews/book-reviews-genre-fiction-thriller-general.htm";
const field =
  "mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm disabled:opacity-50";

export function ScoutApp() {
  const [audienceId, setAudienceId] = useState("authors");
  const [locked, setLocked] = useState(false);
  const audience = SCOUT_AUDIENCES.find((item) => item.id === audienceId)!;
  return (
    <div>
      <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
        <label className="block text-sm font-medium">
          Audience
          <select
            aria-label="Audience"
            className={field}
            value={audienceId}
            disabled={locked}
            onChange={(event) => setAudienceId(event.target.value)}
          >
            {SCOUT_AUDIENCES.map((item) => (
              // Only authors are live; other audiences are coming soon.
              <option key={item.id} value={item.id} disabled={item.id !== "authors"}>
                {item.id === "authors" ? item.label : `${item.label} — coming soon`}
              </option>
            ))}
          </select>
        </label>
      </div>
      {audienceId === "authors" ? (
        <AuthorScout onBusyChange={setLocked} />
      ) : (
        <AudienceScout key={audienceId} audience={audience} onBusyChange={setLocked} />
      )}
    </div>
  );
}
function AuthorScout({ onBusyChange }: { onBusyChange: (busy: boolean) => void }) {
  const queryClient = useQueryClient();
  const [genreLoading, setGenreLoading] = useState(true);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [detailError, setDetailError] = useState("");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [stage, setStage] = useState("");

  const [source, setSource] = useState("reedsy_discovery");
  const [arcBusy, setArcBusy] = useState(false);
  const [genres, setGenres] = useState<ReedsyGenre[]>([]);
  const [genreId, setGenreId] = useState("");
  const [rfGenres, setRfGenres] = useState([
    { path: RF_DEFAULT, name: "Fiction - Thriller - General" },
  ]);
  const [rfLoading, setRfLoading] = useState(false);
  const [catalog, setCatalog] = useState(RF_DEFAULT);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selected, setSelected] = useState<Batch | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState("");
  useEffect(() => {
    onBusyChange(Boolean(busy) || arcBusy);
    return () => onBusyChange(false);
  }, [busy, arcBusy, onBusyChange]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [batchSource, setBatchSource] = useState("all");
  const [reviewFilter, setReviewFilter] = useState("all");
  const [retry, setRetry] = useState<{ batch: Batch; items: Candidate[] } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    api<{ items: Batch[] }>("/api/admin/scout-batches", undefined, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setBatches(data.items);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    setGenreLoading(true);
    queryClient
      .fetchQuery({
        queryKey: ["scout-genres"],
        staleTime: 300000,
        queryFn: () => api<{ genres: ReedsyGenre[] }>("/api/admin/scout-reedsy-genres"),
      })
      .then((data) => {
        if (!controller.signal.aborted) {
          setGenres(data.genres);
          setGenreId((current) => current || String(data.genres[0]?.id ?? ""));
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setGenreLoading(false);
      });
    return () => controller.abort();
  }, [loadAttempt, queryClient]);

  useEffect(() => {
    if (source !== "readers_favorite") return;
    setRfLoading(true);
    const controller = new AbortController();
    queryClient
      .fetchQuery({
        queryKey: ["scout-rf-genres"],
        staleTime: 300000,
        queryFn: () =>
          api<{ genres: { path: string; name: string }[] }>("/api/admin/scout-readers-favorite", {
            catalog: RF_DEFAULT,
            page: 1,
          }),
      })
      .then((data) =>
        setRfGenres((current) => [
          ...new Map([...current, ...data.genres].map((item) => [item.path, item])).values(),
        ]),
      )
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setRfLoading(false);
      });
    return () => controller.abort();
  }, [source, loadAttempt, queryClient]);

  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    setDetailLoading(true);
    setDetailError("");
    setBooks([]);
    setReviewFilter("all");
    api<{ items: Book[] }>(`/api/admin/scout-batches/${selected.id}`, undefined, controller.signal)
      .then((data) => setBooks(data.items))
      .catch((e) => {
        if (!controller.signal.aborted) setDetailError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setDetailLoading(false);
      });
    return () => controller.abort();
  }, [selected]);

  async function persist(batch: Batch, items: Candidate[]) {
    const failed: Candidate[] = [];
    setStage("Saving authors to your batch");
    setProgress({ done: 0, total: items.length });
    // Sequential writes preserve the existing batch counter and avoid overwhelming storage.
    for (const item of items) {
      try {
        await api("/api/admin/scout-manual-ingest", {
          sourceSlug: batch.sources[0],
          sourceUrl: item.sourceUrl,
          bookUrl: item.sourceUrl,
          authorName: item.authorName,
          bookTitle: item.title,
          genre: item.genre,
          description: item.overview?.slice(0, 4000),
          batchId: batch.id,
          batchLabel: batch.label,
          ...(item.rating === null
            ? {}
            : {
                reviewPlatform:
                  batch.sources[0] === "reedsy_discovery" ? "reedsy" : "readers_favorite",
                reviewRating: item.rating,
              }),
        });
      } catch {
        failed.push(item);
      } finally {
        setProgress((current) => ({ ...current, done: current.done + 1 }));
      }
    }
    setRetry(failed.length ? { batch, items: failed } : null);
    const data = await api<{ items: Batch[] }>("/api/admin/scout-batches");
    setBatches(data.items);
    setSelected({ ...batch });
    setNotice(
      `${items.length - failed.length} books added to this batch.${failed.length ? ` ${failed.length} could not be saved. Retry below.` : ""}`,
    );
  }

  async function search() {
    setBusy("search");
    setStage("Searching the review catalogue");
    setProgress({ done: 0, total: 0 });
    setError("");
    setNotice("");
    try {
      const genre =
        source === "reedsy_discovery"
          ? genres.find((item) => String(item.id) === genreId)?.name
          : rfGenres.find((item) => item.path === catalog)?.name;
      const { item: batch } = await api<{ item: Batch }>("/api/admin/scout-batches", {
        label: `${source === "reedsy_discovery" ? "Reedsy" : "Readers’ Favorite"} · ${genre ?? "Book reviews"}${source === "readers_favorite" ? ` · Page ${page}` : ""}`,
        source,
        genre,
        requestedMax: source === "reedsy_discovery" ? limit : 10,
      });
      setBatchSource("all");
      setBatches((current) => [batch, ...current]);
      setSelected(batch);
      let items: Candidate[];
      if (source === "reedsy_discovery") {
        const data = await api<{
          items: (Omit<Candidate, "rating"> & { verdictRating: number | null })[];
        }>("/api/admin/scout-reedsy-search", { genreId: Number(genreId), genreName: genre, limit });
        items = data.items.map((item) => ({ ...item, rating: item.verdictRating }));
      } else {
        const data = await api<{ items: Candidate[]; genres: { path: string; name: string }[] }>(
          "/api/admin/scout-readers-favorite",
          { catalog, page },
        );
        items = data.items;
        setRfGenres((current) => [
          ...new Map([...current, ...data.genres].map((item) => [item.path, item])).values(),
        ]);
      }
      const valid = items.filter((item) => item.authorName && item.title && item.sourceUrl);
      await persist(batch, valid);
      if (valid.length !== items.length)
        setNotice(
          (current) =>
            `${current} ${items.length - valid.length} listings were missing an author name, title, or source URL.`,
        );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function save(book: Book) {
    setBusy(book.id);
    setError("");
    try {
      await api("/api/admin/scout-prospects", {
        scoutAuthorId: book.scout_authors?.id,
        bookId: book.id,
      });
      setBooks((current) =>
        current.map((item) =>
          item.id === book.id
            ? { ...item, scout_prospects: [{ id: book.id, status: "saved" }] }
            : item,
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function scoutWholeBatch() {
    if (!selected) return;
    const remaining = books.filter((b) => !b.scout_prospects.length).length;
    if (!remaining) return;
    if (
      !window.confirm(
        `Mark all ${remaining} remaining books in "${selected.label}" as scouted? Each becomes a lead in your Leads & Projects.`,
      )
    )
      return;
    setBusy("batch-scout");
    setError("");
    try {
      const result = await api<{ added: number; skipped: number }>(
        `/api/admin/scout-batches/${selected.id}/scout`,
        {},
        undefined,
        "Could not mark this batch scouted.",
      );
      setNotice(
        `Marked ${result.added} book${result.added === 1 ? "" : "s"} scouted${result.skipped ? ` · ${result.skipped} already scouted or excluded` : ""}.`,
      );
      setSelected((current) => (current ? { ...current } : null));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  const score = (book: Book) => {
    const review = book.scout_review_counts.find(
      (item) =>
        item.platform === (book.source_slug === "reedsy_discovery" ? "reedsy" : "readers_favorite"),
    );
    return review?.rating ?? (review?.platform === "reedsy" ? review.review_count : null);
  };
  const visible = books.filter(
    (book) =>
      reviewFilter === "all" ||
      (reviewFilter === "unknown" ? score(book) == null : score(book) === Number(reviewFilter)),
  );
  const visibleBatches = batches.filter(
    (batch) => batchSource === "all" || batch.sources.includes(batchSource),
  );
  function exportCsv() {
    const rows = [
      [
        "Author",
        "Book",
        "Genre",
        "Review score",
        "Synopsis",
        "Country",
        "Website",
        "Email",
        "Email verification",
        "Contact form",
        "Source",
      ],
      ...visible.map((book) => [
        book.scout_authors?.name,
        book.title,
        book.genre,
        score(book),
        book.description,
        book.scout_authors?.country,
        book.scout_authors?.website_url,
        book.scout_authors?.contact_email,
        book.scout_authors?.contact_verification_status ?? "Unverified",
        book.scout_authors?.contact_form_url,
        book.source_url,
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n")], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `hq360-batch-${selected?.id}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  if (isArcSource(source))
    return (
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <h1 className="font-display text-3xl">Author scouting</h1>
        <label className="block text-sm font-medium">
          Review source
          <select
            aria-label="Review source"
            className={field}
            value={source}
            disabled={arcBusy}
            onChange={(e) => setSource(e.target.value)}
          >
            <option value="reedsy_discovery">Reedsy Discovery</option>
            <option value="readers_favorite">Readers’ Favorite</option>
            {Object.entries(ARC_SOURCES).map(([slug, spec]) => (
              <option key={slug} value={slug}>
                {spec.name}
              </option>
            ))}
          </select>
        </label>
        <ArcScout
          key={source}
          source={source}
          onBusyChange={setArcBusy}
          onOpenBatch={(batch) => {
            setBatches((current) => [
              { ...batch, genre: null },
              ...current.filter((b) => b.id !== batch.id),
            ]);
            setSelected({ ...batch, genre: null });
            setBatchSource("all");
            setSource("reedsy_discovery");
            setLoadAttempt((n) => n + 1);
          }}
        />
      </main>
    );
  return (
    <main className="mx-auto max-w-6xl space-y-7 px-4 py-8 sm:px-6">
      <header className="rounded-3xl border border-border bg-secondary/40 p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand">
          HQ360 · Scouting workspace
        </p>
        <h1 className="mt-3 font-display text-3xl sm:text-4xl">Author scouting</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Discover authors through book reviews. Every search creates a batch you can open, review
          and export from HQ360.
        </p>
      </header>
      <form
        className="rounded-2xl border border-border bg-card p-5 sm:p-6"
        onSubmit={(event) => {
          event.preventDefault();
          void search();
        }}
      >
        <h2 className="text-lg font-semibold">Start a search</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm font-medium">
            Review source
            <select
              aria-label="Review source"
              className={field}
              value={source}
              disabled={Boolean(busy)}
              onChange={(event) => setSource(event.target.value)}
            >
              <option value="reedsy_discovery">Reedsy Discovery</option>
              <option value="readers_favorite">Readers’ Favorite</option>
              {Object.entries(ARC_SOURCES).map(([slug, spec]) => (
                <option key={slug} value={slug}>
                  {spec.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            Book review category
            <select
              aria-label="Book review category"
              className={field}
              value={source === "reedsy_discovery" ? genreId : catalog}
              disabled={Boolean(busy) || (source === "reedsy_discovery" && !genres.length)}
              onChange={(event) => {
                if (source === "reedsy_discovery") setGenreId(event.target.value);
                else {
                  setCatalog(event.target.value);
                  setPage(1);
                }
              }}
            >
              {source === "reedsy_discovery"
                ? genres.map((item) => (
                    <option key={item.id} value={item.id}>
                      {"— ".repeat(item.depth)}
                      {item.name} ({item.bookCount})
                    </option>
                  ))
                : rfGenres.map((item) => (
                    <option key={item.path} value={item.path}>
                      {item.name}
                    </option>
                  ))}
            </select>
          </label>
          {source === "reedsy_discovery" ? (
            <label className="text-sm font-medium">
              Authors to find
              <select
                aria-label="Authors to find"
                className={field}
                value={limit}
                disabled={Boolean(busy)}
                onChange={(event) => setLimit(Number(event.target.value))}
              >
                {[10, 20, 30, 50].map((value) => (
                  <option key={value} value={value}>
                    {value} authors
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="text-sm font-medium">
              Results page
              <select
                aria-label="Results page"
                className={field}
                value={page}
                disabled={Boolean(busy)}
                onChange={(event) => setPage(Number(event.target.value))}
              >
                {Array.from({ length: 100 }, (_, index) => (
                  <option key={index + 1} value={index + 1}>
                    Page {index + 1}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <button
            disabled={
              Boolean(busy) ||
              Boolean(retry) ||
              (source === "readers_favorite" && rfLoading) ||
              (source === "reedsy_discovery" && !genreId)
            }
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy === "search" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Search className="size-4" />
            )}
            {busy === "search" ? "Creating batch…" : "Search & create batch"}
          </button>
          <p className="text-xs text-muted-foreground">
            Results are saved automatically, including books found in earlier searches.
          </p>
        </div>
      </form>
      {(source === "reedsy_discovery" ? genreLoading : rfLoading) && (
        <GlassLoading label="Loading review categories…" />
      )}
      {busy === "search" && (
        <GlassLoading
          label={progress.total ? `${stage} · ${progress.done} of ${progress.total}` : stage}
          progress={progress.total ? progress : undefined}
        />
      )}
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 p-4 text-sm text-destructive"
        >
          {error}{" "}
          <button
            type="button"
            className="ml-3 underline"
            disabled={Boolean(busy)}
            onClick={() => setLoadAttempt((value) => value + 1)}
          >
            Retry loading
          </button>
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-xl bg-secondary p-4 text-sm">
          {notice}
        </p>
      )}
      {retry && (
        <button
          disabled={Boolean(busy)}
          className="rounded-xl border px-4 py-2"
          onClick={async () => {
            setBusy("search");
            setError("");
            try {
              await persist(retry.batch, retry.items);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy("");
            }
          }}
        >
          Retry {retry.items.length} unsaved results
        </button>
      )}
      <section className="space-y-4" aria-label="Batch">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">Batch</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Open a search to see its authors and book details.
            </p>
          </div>
          <label className="text-sm">
            Filter batches
            <select
              aria-label="Filter batches"
              className={field}
              value={batchSource}
              disabled={Boolean(busy)}
              onChange={(event) => {
                setBatchSource(event.target.value);
                setSelected(null);
                setBooks([]);
              }}
            >
              <option value="all">All review sources</option>
              <option value="reedsy_discovery">Reedsy Discovery</option>
              <option value="readers_favorite">Readers’ Favorite</option>
              {Object.entries(ARC_SOURCES).map(([slug, spec]) => (
                <option key={slug} value={slug}>
                  {spec.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {loading ? (
          <GlassLoading label="Loading your batches…" />
        ) : (
          <label className="block text-sm font-medium">
            Choose a batch
            <select
              aria-label="Choose a batch"
              className={field}
              value={selected?.id ?? ""}
              disabled={Boolean(busy) || !visibleBatches.length}
              onChange={(event) => {
                setSelected(batches.find((batch) => batch.id === event.target.value) ?? null);
              }}
            >
              <option value="">
                {visibleBatches.length ? "Select a saved search" : "No batches for this source"}
              </option>
              {visibleBatches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.label} · {formatDiscoveredAt(batch.created_at)} · {batch.item_count} books
                </option>
              ))}
            </select>
          </label>
        )}
      </section>
      {selected && (
        <section className="space-y-4 border-t border-border pt-6" aria-label="Batch details">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-brand">Batch details</p>
              <h2 className="mt-2 text-xl font-semibold">{selected.label}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {visible.length} of {books.length} books
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <button
                type="button"
                disabled={
                  Boolean(busy) || detailLoading || !books.some((b) => !b.scout_prospects.length)
                }
                onClick={() => void scoutWholeBatch()}
                className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {busy === "batch-scout"
                  ? "Marking…"
                  : books.length && books.every((b) => b.scout_prospects.length)
                    ? "Whole batch scouted"
                    : "Mark whole batch scouted"}
              </button>
              <label className="text-sm">
                Book reviews
                <select
                  aria-label="Book reviews"
                  className={field}
                  value={reviewFilter}
                  onChange={(event) => setReviewFilter(event.target.value)}
                >
                  <option value="all">All review scores</option>
                  {[5, 4, 3, 2, 1].map((value) => (
                    <option key={value} value={value}>
                      {value} / 5
                    </option>
                  ))}
                  <option value="unknown">Score unavailable</option>
                </select>
              </label>
              <button
                onClick={exportCsv}
                disabled={!visible.length || detailLoading}
                className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm disabled:opacity-50"
              >
                <Download className="size-4" />
                Export CSV
              </button>
            </div>
          </div>
          {detailError && (
            <p role="alert" className="text-sm text-destructive">
              {detailError}{" "}
              <button
                className="underline"
                onClick={() => setSelected((current) => (current ? { ...current } : null))}
              >
                Retry batch details
              </button>
            </p>
          )}
          {detailLoading ? (
            <GlassLoading label="Loading author details…" cards />
          ) : detailError ? null : !visible.length ? (
            <p className="rounded-xl bg-secondary/40 p-6 text-sm">
              {books.length
                ? "No books match this review filter."
                : busy === "search"
                  ? "Collecting this batch’s results…"
                  : "This batch has no saved results."}
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {visible.map((book) => (
                <BookCard key={book.id} book={book} busy={busy} onSave={save} />
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
