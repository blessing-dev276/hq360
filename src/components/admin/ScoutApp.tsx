import { EmailCheckBadge } from "./EmailCheckBadge";
import {
  AuthorContactSearch,
  EmailSearchProgress,
  savedSearch,
  useEmailSearch,
  type EmailSearch,
} from "./AuthorContactSearch";
import { ArcScout } from "./ArcScout";
import { PresenceNote, type Presence } from "./PresenceNote";
import { ARC_SOURCES, isArcSource } from "@/lib/scout/arc-sources";
import { AudienceScout } from "./AudienceScout";
import { SCOUT_AUDIENCES } from "@/lib/scout/audiences";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Bookmark,
  Check,
  Download,
  ExternalLink,
  Loader2,
  Mail,
  Search,
  ShieldCheck,
} from "lucide-react";
import { GlassLoading } from "@/components/ui/glass-loading";
import { ScoutBatchPicker } from "./ScoutBatchPicker";
import { useQueryClient } from "@tanstack/react-query";
import { canonicalUrl } from "@/lib/scout/normalize";
import { emailSearchEstimate } from "@/lib/scout/email-cost";

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
    email_check_status?: string | null;
    email_check?: { reasons?: string[] } | null;
    contact_form_url?: string | null;
    contact_emails?: string[] | null;
    contact_search_status?: string | null;
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
  attempt = 0,
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
  if (response.status === 429 && attempt < 8) {
    await new Promise((resolve) => setTimeout(resolve, 2000 + Math.random() * 1000));
    return api<T>(url, body, signal, fallbackMessage, attempt + 1);
  }
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
  canFindEmail,
  emailSearch,
  onFindEmail,
}: {
  book: Book;
  canFindEmail: boolean;
  emailSearch: EmailSearch;
  onFindEmail: () => void;
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
      {canFindEmail && book.scout_authors && !book.localOnly && (
        <AuthorContactSearch
          search={emailSearch}
          onFind={onFindEmail}
          primaryEmail={book.scout_authors?.contact_email}
          primaryCheck={{
            status: book.scout_authors?.email_check_status,
            details: book.scout_authors?.email_check,
          }}
        />
      )}
      {book.scout_authors && (
        <div className="mt-4 space-y-2 text-sm">
          <p>{book.scout_authors.bio}</p>
          <p className="text-muted-foreground">
            Country: {book.scout_authors.country || "Unknown"} · Publishing:{" "}
            {book.scout_authors.publishing_type || "Unknown"}
          </p>
          {book.scout_authors.contact_email &&
            !(canFindEmail && emailSearch.status === "found") && (
              <p className="flex flex-wrap items-center gap-2 break-all">
                <span>
                  Contact: {book.scout_authors.contact_email} ·{" "}
                  {book.scout_authors.contact_verification_status === "verified"
                    ? "Confirmed by staff"
                    : "Not confirmed by staff"}
                </span>
                <EmailCheckBadge
                  status={book.scout_authors.email_check_status}
                  details={book.scout_authors.email_check}
                />
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
type SearchJob = {
  id: string;
  label: string;
  batch?: Batch;
  source: string;
  genre: string;
  genreId: number;
  catalog: string;
  target: number;
  nextPage: number | null;
  queue: Candidate[];
  saved: number;
  skipped: number;
  status: "running" | "paused" | "completed" | "error";
  message: string;
  resume?: () => void;
  stopped?: boolean;
};
const RF_DEFAULT = "/book-reviews/book-reviews-genre-fiction-thriller-general.htm";
const field =
  "mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm disabled:opacity-50";

export function ScoutApp({ canFindEmail = false }: { canFindEmail?: boolean }) {
  const [audienceId, setAudienceId] = useState("authors");
  const [locked, setLocked] = useState(false);
  const [batchPage, setBatchPage] = useState(false);
  const audience = SCOUT_AUDIENCES.find((item) => item.id === audienceId)!;
  return (
    <div>
      <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6" hidden={batchPage}>
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
        <AuthorScout
          onBusyChange={setLocked}
          onBatchPageChange={setBatchPage}
          canFindEmail={canFindEmail}
        />
      ) : (
        <AudienceScout
          key={audienceId}
          audience={audience}
          onBusyChange={setLocked}
          canFindEmail={canFindEmail}
        />
      )}
    </div>
  );
}
function AuthorScout({
  onBusyChange,
  onBatchPageChange,
  canFindEmail,
}: {
  onBusyChange: (busy: boolean) => void;
  /** True while a single batch is open as its own page. */
  onBatchPageChange?: (open: boolean) => void;
  canFindEmail: boolean;
}) {
  const queryClient = useQueryClient();
  const [view, setView] = useState<"scouting" | "batches">("scouting");
  const [genreLoading, setGenreLoading] = useState(true);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [detailError, setDetailError] = useState("");
  const jobsRef = useRef<SearchJob[]>([]);
  const [jobs, setJobs] = useState<SearchJob[]>([]);
  const publishJobs = () => {
    jobsRef.current = jobsRef.current.filter((job) => job.status !== "completed");
    setJobs(jobsRef.current.map((job) => ({ ...job })));
  };
  const activeCount = jobs.filter((job) => job.status !== "completed").length;
  useEffect(
    () => () => {
      for (const job of jobsRef.current) {
        job.stopped = true;
        job.resume?.();
      }
    },
    [],
  );

  const [source, setSource] = useState("reedsy_discovery");
  const [arcBusy, setArcBusy] = useState(false);
  const [genres, setGenres] = useState<ReedsyGenre[]>([]);
  const [genreId, setGenreId] = useState("");
  const [rfGenres, setRfGenres] = useState<
    { path: string; name: string; bookCount?: number | null; minimumBookCount?: number }[]
  >([{ path: RF_DEFAULT, name: "Fiction - Thriller - General" }]);
  const [rfLoading, setRfLoading] = useState(false);
  const [catalog, setCatalog] = useState(RF_DEFAULT);
  const page = 1;
  const [limit, setLimit] = useState(20);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selected, setSelected] = useState<Batch | null>(null);
  // A batch opens as its own page: the list is replaced by the batch, and the
  // URL carries ?batch=<id> (the #tab hash is untouched) so Back, reload and
  // shared links all work.
  const pendingBatchRef = useRef<string | null>(
    typeof window === "undefined" ? null : new URL(window.location.href).searchParams.get("batch"),
  );
  function setBatchParam(id: string | null, push: boolean) {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("batch", id);
    else url.searchParams.delete("batch");
    if (url.href === window.location.href) return;
    window.history[push ? "pushState" : "replaceState"](window.history.state, "", url);
  }
  function openBatch(batch: Batch) {
    setSelected(batch);
    setView("batches");
    setBatchParam(batch.id, true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function closeBatch() {
    setSelected(null);
    setBatchParam(null, true);
  }
  const batchPage = Boolean(selected) && view === "batches";
  useEffect(() => {
    onBatchPageChange?.(batchPage);
  }, [batchPage, onBatchPageChange]);
  const [books, setBooks] = useState<Book[]>([]);
  const emails = useEmailSearch();
  const emailSearchFor = (book: Book) =>
    (book.scout_authors && emails.state[book.scout_authors.id]) || savedSearch(book.scout_authors);
  // One search per author (an author can have several books); skip any
  // already searched, so a bulk run never pays twice for the same person.
  const emailTargets = (() => {
    const seen = new Set<string>();
    const targets: { authorId: string; bookId: string }[] = [];
    for (const book of books) {
      const id = book.scout_authors?.id;
      if (!id || book.localOnly || seen.has(id)) continue;
      seen.add(id);
      const status = emailSearchFor(book).status;
      if (status === "idle" || status === "error") targets.push({ authorId: id, bookId: book.id });
    }
    return targets;
  })();
  function findAllEmails() {
    const n = emailTargets.length;
    if (
      !n ||
      !window.confirm(
        `Find emails for ${n} author${n === 1 ? "" : "s"}?\n\nEstimated Perplexity cost: about ${emailSearchEstimate(n).typical} (at most ${emailSearchEstimate(n).max}). Authors whose own website lists an email cost nothing, and authors already searched are skipped.`,
      )
    )
      return;
    void emails.findAll(emailTargets);
  }
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState("");
  useEffect(() => {
    onBusyChange(Boolean(busy) || arcBusy || activeCount > 0);
    return () => onBusyChange(false);
  }, [busy, arcBusy, activeCount, onBusyChange]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [batchSource, setBatchSource] = useState("all");
  const [reviewFilter, setReviewFilter] = useState("all");

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
        queryKey: ["scout-rf-genres", catalog],
        staleTime: 300000,
        queryFn: () =>
          api<{
            genres: {
              path: string;
              name: string;
              bookCount: number | null;
              minimumBookCount: number;
            }[];
          }>("/api/admin/scout-readers-favorite", {
            catalog,
            page: 1,
            metadataOnly: true,
          }),
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        setRfGenres((current) => {
          const merged = new Map(current.map((item) => [item.path, item]));
          for (const item of data.genres) {
            const previous = merged.get(item.path);
            merged.set(item.path, {
              ...item,
              bookCount: item.bookCount ?? previous?.bookCount ?? null,
              minimumBookCount: Math.max(
                item.minimumBookCount ?? 0,
                previous?.minimumBookCount ?? 0,
              ),
            });
          }
          return [...merged.values()];
        });
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setRfLoading(false);
      });
    return () => controller.abort();
  }, [source, catalog, loadAttempt, queryClient]);

  useEffect(() => {
    const sync = () => {
      const id = new URL(window.location.href).searchParams.get("batch");
      if (!id) {
        setSelected(null);
        return;
      }
      const match = batches.find((b) => b.id === id);
      if (match) {
        setSelected((current) => (current?.id === id ? current : match));
        setView("batches");
      } else pendingBatchRef.current = id;
    };
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [batches]);
  // Open a batch named in the URL once the batch list has loaded.
  useEffect(() => {
    const id = pendingBatchRef.current;
    if (!id || !batches.length) return;
    pendingBatchRef.current = null;
    const match = batches.find((b) => b.id === id);
    if (match) {
      setSelected(match);
      setView("batches");
    } else setBatchParam(null, false);
  }, [batches]);

  // Re-opening the same batch (retry/refresh) keeps its rows on screen;
  // switching to a different batch clears them so results never mislabel.
  const shownBatchRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    setDetailLoading(true);
    setDetailError("");
    if (shownBatchRef.current !== selected.id) {
      setBooks([]);
      setReviewFilter("all");
    }
    shownBatchRef.current = selected.id;
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

  async function waitForJob(job: SearchJob) {
    if (job.status === "paused")
      await new Promise<void>((resolve) => {
        job.resume = resolve;
      });
    if (job.stopped) throw new Error("Search closed");
  }

  async function runJob(job: SearchJob) {
    try {
      await waitForJob(job);
      while (job.saved < job.target) {
        await waitForJob(job);
        if (!job.queue.length) {
          if (!job.nextPage) break;
          job.message = `Searching catalogue page ${job.nextPage}`;
          publishJobs();
          if (job.source === "reedsy_discovery") {
            const data = await api<{
              items: (Candidate & { verdictRating: number | null; qualified: boolean })[];
              nextPage: number | null;
            }>("/api/admin/scout-reedsy-search", {
              genreId: job.genreId,
              genreName: job.genre,
              limit: job.target - job.saved,
              page: job.nextPage,
            });
            job.queue = data.items
              .filter((item) => item.qualified)
              .map((item) => ({ ...item, rating: item.verdictRating }));
            job.nextPage = data.nextPage;
          } else {
            const data = await api<{ items: Candidate[]; hasNext: boolean }>(
              "/api/admin/scout-readers-favorite",
              { catalog: job.catalog, page: job.nextPage },
            );
            job.queue = data.items.filter(
              (item) => item.authorName && item.title && item.sourceUrl,
            );
            job.nextPage = data.hasNext && job.nextPage < 100 ? job.nextPage + 1 : null;
          }
          continue;
        }
        await waitForJob(job);
        if (!job.batch) {
          const { item } = await api<{ item: Batch }>("/api/admin/scout-batches", {
            label: job.label,
            source: job.source,
            genre: job.genre,
            requestedMax: job.target,
          });
          job.batch = item;
        }
        job.message = "Saving new authors";
        publishJobs();
        // Four independent writes at once; the database atomically claims authors.
        const chunk = job.queue.slice(0, Math.min(4, job.target - job.saved));
        const outcomes = await Promise.allSettled(
          chunk.map(async (item) => {
            const result = await api<{ duplicate?: boolean }>("/api/admin/scout-manual-ingest", {
              sourceSlug: job.source,
              sourceUrl: item.sourceUrl,
              bookUrl: item.sourceUrl,
              authorName: item.authorName,
              bookTitle: item.title,
              genre: item.genre,
              description: item.overview?.slice(0, 4000),
              batchId: job.batch!.id,
              batchLabel: job.label,
              ...(item.rating == null
                ? {}
                : {
                    reviewPlatform:
                      job.source === "reedsy_discovery" ? "reedsy" : "readers_favorite",
                    reviewRating: item.rating,
                  }),
            });
            if (result.duplicate) job.skipped++;
            else job.saved++;
            job.queue.splice(job.queue.indexOf(item), 1);
          }),
        );
        if (job.saved > 0)
          setBatches((current) => [
            { ...job.batch!, item_count: job.saved },
            ...current.filter((batch) => batch.id !== job.batch!.id),
          ]);
        publishJobs();
        const failure = outcomes.find((result) => result.status === "rejected");
        if (failure?.status === "rejected") throw failure.reason;
      }
      if (job.saved === 0 && job.batch) {
        const response = await fetch(`/api/admin/scout-batches/${job.batch.id}`, {
          method: "DELETE",
        });
        const result = await response.json();
        if (!response.ok || !result.ok)
          throw new Error(result.error ?? "Could not discard empty batch.");
        if (!result.removed)
          throw new Error("Batch changed while searching. Open Batches to review it.");
        setBatches((current) => current.filter((batch) => batch.id !== job.batch!.id));
      }
      setNotice(
        job.saved === 0
          ? "No books found. No batch was saved. Try another category or source."
          : `${job.label}: ${job.saved} of ${job.target} new authors saved.${job.saved < job.target ? " No more new authors were found in the available catalogue." : ""}`,
      );
      job.status = "completed";
      job.message =
        job.saved >= job.target
          ? "Batch complete"
          : "Catalogue exhausted; fewer new authors available";
    } catch (e) {
      if (job.stopped) return;
      job.status = "error";
      job.message = (e as Error).message;
    } finally {
      if (!job.stopped) {
        publishJobs();
        setSelected((current) =>
          current && current.id === job.batch?.id ? { ...current } : current,
        );
      }
    }
  }

  function search() {
    const active = jobsRef.current.filter((job) => job.status !== "completed").length;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100 || active >= 3) {
      setError("Choose 1–100 authors per batch and no more than 3 unfinished batches.");
      return;
    }
    const genre =
      (source === "reedsy_discovery"
        ? genres.find((item) => String(item.id) === genreId)?.name
        : rfGenres.find((item) => item.path === catalog)?.name) ?? "Book reviews";
    const job: SearchJob = {
      id: crypto.randomUUID(),
      label: `${source === "reedsy_discovery" ? "Reedsy" : "Readers’ Favorite"} · ${genre}`,
      source,
      genre,
      genreId: Number(genreId),
      catalog,
      target: limit,
      nextPage: source === "reedsy_discovery" ? 1 : page,
      queue: [],
      saved: 0,
      skipped: 0,
      status: "running",
      message: "Creating batch",
    };
    jobsRef.current.push(job);
    setError("");
    publishJobs();
    void runJob(job);
  }

  function toggleJob(id: string) {
    const job = jobsRef.current.find((item) => item.id === id)!;
    if (job.status === "running") job.status = "paused";
    else if (job.status === "paused") {
      job.status = "running";
      job.resume?.();
      delete job.resume;
    } else if (job.status === "error") {
      job.status = "running";
      void runJob(job);
    }
    publishJobs();
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
  if (isArcSource(source) && view === "scouting")
    return (
      <main className="scout-studio mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <header className="scout-hero" hidden={false}>
          <div>
            <p className="scout-kicker">HQ360 · Research desk</p>
            <h1 className="scout-title">
              Author <em>scouting</em>
            </h1>
            <p className="scout-lede">
              Discover authors through the reviews their books earn. Every search becomes a batch
              you can study, qualify and export.
            </p>
          </div>
          <ol className="scout-method" aria-label="How scouting works">
            <li>
              <span>01</span>
              <strong>Discover</strong>
              <small>Pick a review source and category</small>
            </li>
            <li>
              <span>02</span>
              <strong>Qualify</strong>
              <small>Review authors, scores and contacts</small>
            </li>
            <li>
              <span>03</span>
              <strong>Export</strong>
              <small>Save prospects or download a CSV</small>
            </li>
          </ol>
        </header>
        <nav aria-label="Scouting sections" className="scout-tabs" hidden={false}>
          <button type="button" aria-pressed onClick={() => setView("scouting")}>
            <Search className="size-4" aria-hidden="true" />
            Scouting
          </button>
          <button type="button" aria-pressed={false} onClick={() => setView("batches")}>
            <Bookmark className="size-4" aria-hidden="true" />
            Batches
          </button>
        </nav>
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
              <option key={slug} value={slug} disabled={activeCount > 0}>
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
            setBatchSource("all");
            openBatch({ ...batch, genre: null });
            setSource("reedsy_discovery");
            setLoadAttempt((n) => n + 1);
          }}
        />
      </main>
    );
  return (
    <main className="scout-studio mx-auto max-w-6xl space-y-7 px-4 py-8 sm:px-6">
      <header className="scout-hero" hidden={batchPage}>
        <div>
          <p className="scout-kicker">HQ360 · Research desk</p>
          <h1 className="scout-title">
            Author <em>scouting</em>
          </h1>
          <p className="scout-lede">
            Discover authors through the reviews their books earn. Every search becomes a batch you
            can study, qualify and export.
          </p>
        </div>
        <ol className="scout-method" aria-label="How scouting works">
          <li>
            <span>01</span>
            <strong>Discover</strong>
            <small>Pick a review source and category</small>
          </li>
          <li>
            <span>02</span>
            <strong>Qualify</strong>
            <small>Review authors, scores and contacts</small>
          </li>
          <li>
            <span>03</span>
            <strong>Export</strong>
            <small>Save prospects or download a CSV</small>
          </li>
        </ol>
      </header>
      <nav aria-label="Scouting sections" className="scout-tabs" hidden={batchPage}>
        <button
          type="button"
          aria-pressed={view === "scouting"}
          onClick={() => setView("scouting")}
        >
          <Search className="size-4" aria-hidden="true" />
          Scouting
        </button>
        <button type="button" aria-pressed={view === "batches"} onClick={() => setView("batches")}>
          <Bookmark className="size-4" aria-hidden="true" />
          Batches
        </button>
      </nav>
      <form
        hidden={view !== "scouting"}
        className="scout-panel"
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
                <option key={slug} value={slug} disabled={activeCount > 0}>
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
                }
              }}
            >
              {source === "reedsy_discovery"
                ? genres.map((item) => (
                    <option key={item.id} value={item.id}>
                      {"— ".repeat(item.depth)}
                      {item.name} ({item.bookCount.toLocaleString()} books)
                    </option>
                  ))
                : rfGenres.map((item) => (
                    <option key={item.path} value={item.path}>
                      {item.name} (
                      {item.bookCount != null
                        ? `${item.bookCount.toLocaleString()} books`
                        : item.minimumBookCount
                          ? `${item.minimumBookCount.toLocaleString()}+ books; total unavailable`
                          : "total unavailable"}
                      )
                    </option>
                  ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            Authors per batch (maximum 100)
            <input
              aria-label="Authors to find"
              className={field}
              type="number"
              min={1}
              max={100}
              step={1}
              required
              value={Number.isNaN(limit) ? "" : limit}
              onChange={(event) => {
                const value = event.target.valueAsNumber;
                setLimit(Number.isNaN(value) ? NaN : Math.min(100, Math.max(1, Math.trunc(value))));
              }}
            />
          </label>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <button
            disabled={
              Boolean(busy) ||
              activeCount >= 3 ||
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
            Only authors new to your workspace are added.
          </p>
        </div>
      </form>
      {(source === "reedsy_discovery" ? genreLoading : rfLoading) && (
        <GlassLoading label="Loading review categories…" rows={1} />
      )}
      {jobs.length > 0 && (
        <section aria-label="Generation batches" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Generation batches</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Keep this tab open while generating. Pausing lets requests in progress finish; saved
                authors stay available.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex gap-1" aria-hidden="true">
                {[0, 1, 2].map((slot) => (
                  <span
                    key={slot}
                    className={`h-2 w-6 rounded-full ${slot < activeCount ? "bg-brand" : "bg-secondary"}`}
                  />
                ))}
              </span>
              {activeCount}/3 slots in use
            </div>
          </div>
          {jobs.map((job) => {
            const pct = job.target ? Math.min(100, Math.round((job.saved / job.target) * 100)) : 0;
            const tone = {
              running: {
                label: "Generating",
                dot: "bg-brand animate-pulse",
                text: "text-brand",
                bar: "bg-brand",
              },
              paused: {
                label: "Paused",
                dot: "bg-amber-400",
                text: "text-amber-400",
                bar: "bg-amber-400",
              },
              completed: {
                label: "Complete",
                dot: "bg-emerald-400",
                text: "text-emerald-400",
                bar: "bg-emerald-400",
              },
              error: {
                label: "Stopped",
                dot: "bg-destructive",
                text: "text-destructive",
                bar: "bg-destructive",
              },
            }[job.status];
            const [source, ...rest] = job.label.split(" · ");
            return (
              <article key={job.id} className="rounded-2xl border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      {source}
                    </p>
                    <h3 className="mt-1 truncate text-base font-semibold">
                      {rest.length ? rest.join(" · ") : job.label}
                    </h3>
                  </div>
                  <span
                    role="status"
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${tone.text}`}
                  >
                    <span className={`size-2 rounded-full ${tone.dot}`} aria-hidden="true" />
                    {tone.label}
                  </span>
                </div>

                <div className="mt-5 flex items-baseline justify-between gap-3">
                  <p className="text-sm">
                    <span className="text-2xl font-semibold tabular-nums">{job.saved}</span>
                    <span className="text-muted-foreground"> / {job.target} authors saved</span>
                  </p>
                  <span className="text-sm font-semibold tabular-nums">{pct}%</span>
                </div>
                <div
                  role="progressbar"
                  aria-label={`${job.label} progress`}
                  aria-valuenow={job.saved}
                  aria-valuemin={0}
                  aria-valuemax={job.target}
                  className="mt-2 h-2 overflow-hidden rounded-full bg-secondary"
                >
                  <div
                    className={`h-full rounded-full transition-[width] duration-500 ${tone.bar}`}
                    style={{ width: `${Math.max(pct, job.saved ? 2 : 0)}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {job.skipped > 0
                    ? `${job.skipped} already in your workspace, skipped`
                    : "No duplicates so far"}
                </p>

                {job.status === "error" && job.message && (
                  <p className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {job.message} Retry picks up where it stopped — nothing saved is lost.
                  </p>
                )}
                {job.status !== "error" && job.message && (
                  <p className="mt-3 text-xs text-muted-foreground">{job.message}</p>
                )}

                {(job.status !== "completed" || (job.batch && job.saved > 0)) && (
                  <div className="mt-5 flex flex-wrap gap-2">
                    {job.status !== "completed" && (
                      <button
                        type="button"
                        className={`rounded-full px-4 py-2 text-sm font-semibold ${
                          job.status === "running"
                            ? "border hover:bg-secondary"
                            : "bg-primary text-primary-foreground"
                        }`}
                        onClick={() => toggleJob(job.id)}
                      >
                        {job.status === "running"
                          ? "Pause"
                          : job.status === "error"
                            ? "Retry"
                            : "Resume"}
                      </button>
                    )}
                    {job.batch && job.saved > 0 && (
                      <button
                        type="button"
                        className="rounded-full border px-4 py-2 text-sm font-semibold hover:bg-secondary"
                        onClick={() => {
                          openBatch({ ...job.batch!, item_count: job.saved });
                        }}
                      >
                        Open batch ({job.saved})
                      </button>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </section>
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
      <div hidden={view !== "batches"} className="space-y-6">
        <section className="space-y-4" aria-label="Batches" hidden={Boolean(selected)}>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold">Batches</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Open a search to see its authors and book details.
              </p>
            </div>
          </div>
          {loading && batches.length === 0 ? (
            <GlassLoading label="Loading your batches…" variant="list" rows={4} />
          ) : (
            <ScoutBatchPicker
              batches={batches}
              source={batchSource}
              onSourceChange={(value) => {
                setBatchSource(value);
                setSelected(null);
                setBooks([]);
              }}
              selectedId={selected?.id ?? null}
              onSelect={(batch) => {
                const match = batches.find((b) => b.id === batch.id);
                if (match) openBatch(match);
              }}
              disabled={Boolean(busy)}
              lockArcSources={activeCount > 0}
            />
          )}
        </section>
        {selected && (
          <section className="space-y-4 hq-fade-in" aria-label="Batch details">
            <nav aria-label="Breadcrumb" className="scout-batch-crumbs">
              <button type="button" onClick={closeBatch} className="scout-batch-back">
                <ArrowLeft size={15} aria-hidden="true" /> All batches
              </button>
              <span aria-hidden="true">/</span>
              <span aria-current="page">{selected.genre || selected.label}</span>
            </nav>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-widest text-brand">Batch details</p>
                <h2 className="mt-2 text-xl font-semibold">{selected.label}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {visible.length} of {books.length} books
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {canFindEmail && (
                  <button
                    type="button"
                    disabled={Boolean(emails.run) || detailLoading || !emailTargets.length}
                    onClick={findAllEmails}
                    className="inline-flex h-11 items-center gap-2 rounded-xl border border-brand/50 px-4 text-sm font-semibold text-brand hover:bg-brand/10 disabled:opacity-50"
                  >
                    {emails.run ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Mail className="size-4" />
                    )}
                    {emails.run
                      ? "Finding emails…"
                      : emailTargets.length
                        ? `Find all emails (${emailTargets.length})`
                        : "All emails searched"}
                  </button>
                )}
                <button
                  type="button"
                  disabled={
                    Boolean(busy) || detailLoading || !books.some((b) => !b.scout_prospects.length)
                  }
                  onClick={() => void scoutWholeBatch()}
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  <Bookmark className="size-4" />
                  {busy === "batch-scout"
                    ? "Marking…"
                    : books.length && books.every((b) => b.scout_prospects.length)
                      ? "Whole batch scouted"
                      : "Mark whole batch scouted"}
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card/60 px-4 py-3">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                Reviews
                <select
                  aria-label="Book reviews"
                  className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
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
              {canFindEmail && emailTargets.length > 0 && !emails.run && (
                <p className="text-xs text-muted-foreground">
                  Email search est. Perplexity cost{" "}
                  <span className="font-medium text-foreground">
                    ~{emailSearchEstimate(emailTargets.length).typical}
                  </span>{" "}
                  · max {emailSearchEstimate(emailTargets.length).max}
                </p>
              )}
              <button
                onClick={exportCsv}
                disabled={!visible.length || detailLoading}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm hover:bg-secondary disabled:opacity-50"
              >
                <Download className="size-4" />
                Export CSV
              </button>
            </div>
            {emails.run && (
              <EmailSearchProgress
                run={emails.run}
                results={emails.runResults}
                onStop={emails.stop}
              />
            )}
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
            {detailLoading && books.length > 0 && (
              <p className="text-xs text-muted-foreground" role="status">
                Refreshing batch…
              </p>
            )}
            {detailLoading && books.length === 0 ? (
              <GlassLoading label="Loading author details…" variant="table" rows={6} />
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
                  <BookCard
                    key={book.id}
                    book={book}
                    busy={busy}
                    onSave={save}
                    canFindEmail={canFindEmail}
                    emailSearch={emailSearchFor(book)}
                    onFindEmail={() =>
                      book.scout_authors && void emails.findOne(book.scout_authors.id, book.id)
                    }
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
