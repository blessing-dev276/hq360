import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Bookmark, Check, Download, ExternalLink, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { canonicalUrl } from "@/lib/scout/normalize";
import { amazonProduct } from "@/lib/scout/amazon-url";
import { z } from "zod";

const GENRES = [
  "Horror",
  "Fantasy",
  "Mystery & Crime",
  "Non-Fiction",
  "Romance",
  "Science Fiction",
  "Thriller & Suspense",
  "Young Adult",
] as const;
const MARKETS = [
  { country: "Germany", domain: "amazon.de" },
  { country: "United States", domain: "amazon.com" },
  { country: "United Kingdom", domain: "amazon.co.uk" },
  { country: "Canada", domain: "amazon.ca" },
  { country: "Australia", domain: "amazon.com.au" },
] as const;

type Book = {
  id: string;
  title: string;
  asin: string | null;
  genre: string | null;
  source_url: string | null;
  scout_authors: { id: string; name: string; country: string | null } | null;
  scout_review_counts: { platform: string; review_count: number | null }[];
  scout_prospects: { id: string; status: string }[];
  localOnly?: boolean;
};

const LOCAL_BOOKS_KEY = "hq360-scout-amazon-books";
const localBookSchema = z.object({
  id: z.string(),
  title: z.string(),
  asin: z.string().nullable(),
  genre: z.string().nullable(),
  source_url: z.string().nullable(),
  localOnly: z.boolean().optional(),
  scout_authors: z
    .object({ id: z.string(), name: z.string(), country: z.string().nullable() })
    .nullable(),
  scout_review_counts: z.array(
    z.object({ platform: z.string(), review_count: z.number().nullable() }),
  ),
  scout_prospects: z.array(z.object({ id: z.string(), status: z.string() })),
});

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
      : AbortSignal.timeout(20000),
  });
  const result = await response.json();
  if (!response.ok || !result.ok) {
    const messages: Record<string, string> = {
      invalid_amazon_book:
        "Use a direct Amazon URL containing /dp/ or /gp/product/, and enter 1–49 ratings.",
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

function csvCell(value: string | number | null | undefined) {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function ScoutApp() {
  const [genre, setGenre] = useState<(typeof GENRES)[number]>("Horror");
  const [marketIndex, setMarketIndex] = useState(0);
  const [ratingMin, setRatingMin] = useState(1);
  const [ratingMax, setRatingMax] = useState(49);
  const [savedOnly, setSavedOnly] = useState(false);
  const [books, setBooks] = useState<Book[]>([]);
  const [localBooks, setLocalBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refresh, setRefresh] = useState(0);
  const market = MARKETS[marketIndex]!;
  const googleQuery = useMemo(
    () =>
      `site:${market.domain} ${genre.toLowerCase()} ${market.country} (${ratingMin}..${ratingMax} ratings)`,
    [genre, market.country, market.domain, ratingMax, ratingMin],
  );
  const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(googleQuery)}`;

  const loadBooks = useCallback(
    (signal?: AbortSignal) => {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({
        source: "amazon_books",
        genre,
        platform: "amazon",
        reviewMin: String(ratingMin),
        reviewMax: String(ratingMax),
      });
      return api<{ items: Book[] }>(`/api/admin/scout-books?${params}`, undefined, signal)
        .then((data) => setBooks(data.items))
        .catch((caught) => {
          if (!signal?.aborted)
            setError(caught instanceof Error ? caught.message : "Could not load Amazon books.");
        })
        .finally(() => {
          if (!signal?.aborted) setLoading(false);
        });
    },
    [genre, ratingMax, ratingMin],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadBooks(controller.signal);
    return () => controller.abort();
  }, [loadBooks, refresh]);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(LOCAL_BOOKS_KEY) ?? "[]");
      if (Array.isArray(stored))
        setLocalBooks(
          stored.flatMap((item) => {
            const result = localBookSchema.safeParse(item);
            return result.success ? [result.data] : [];
          }),
        );
    } catch {
      setNotice(
        "Browser storage is unavailable or unreadable. Export your entries before leaving this page.",
      );
    }
  }, []);

  function storeLocalBook(book: Book) {
    const next = [book, ...localBooks.filter((item) => item.source_url !== book.source_url)];
    setLocalBooks(next);
    try {
      localStorage.setItem(LOCAL_BOOKS_KEY, JSON.stringify(next));
    } catch {
      setNotice(
        "Entry is ready to export, but browser storage is unavailable. Export before leaving this page.",
      );
    }
  }

  function removeLocalBook(sourceUrl: string) {
    const next = localBooks.filter((item) => item.source_url !== sourceUrl);
    setLocalBooks(next);
    try {
      localStorage.setItem(LOCAL_BOOKS_KEY, JSON.stringify(next));
    } catch {
      /* The server copy has already been saved. */
    }
  }

  async function importBook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    let product;
    try {
      product = amazonProduct(String(form.get("amazonUrl") ?? ""));
    } catch (caught) {
      setError((caught as Error).message);
      return;
    }
    const { url: amazonUrl, asin } = product;
    const authorName = String(form.get("authorName") ?? "").trim();
    const bookTitle = String(form.get("bookTitle") ?? "").trim();
    const reviewCount = Number(form.get("reviewCount"));
    if (
      !authorName ||
      !bookTitle ||
      !Number.isInteger(reviewCount) ||
      reviewCount < ratingMin ||
      reviewCount > ratingMax
    ) {
      setError(
        "Enter an author, book title and whole-number rating count within the selected range.",
      );
      return;
    }
    const localBook: Book = {
      id: `local-${asin}`,
      title: bookTitle,
      asin,
      genre,
      source_url: amazonUrl,
      scout_authors: { id: `local-${asin}`, name: authorName, country: null },
      scout_review_counts: [{ platform: "amazon", review_count: reviewCount }],
      scout_prospects: [],
      localOnly: true,
    };
    storeLocalBook(localBook);
    formElement.reset();
    setSavedOnly(false);
    await syncBook(localBook);
  }

  async function syncBook(book: Book) {
    setBusy(book.id);
    setError("");
    setNotice("Entry is ready to export. Saving to your account…");
    try {
      const result = await api<{
        item: {
          book: Omit<Book, "scout_authors" | "scout_review_counts" | "scout_prospects">;
          author: NonNullable<Book["scout_authors"]>;
        };
      }>("/api/admin/scout-manual-ingest", {
        sourceSlug: "amazon_books",
        sourceUrl: book.source_url,
        bookUrl: book.source_url,
        authorName: book.scout_authors?.name,
        bookTitle: book.title,
        amazonReviewCount: book.scout_review_counts[0]?.review_count,
        genre: book.genre,
      });
      const savedBook: Book = {
        ...book,
        ...result.item.book,
        scout_authors: result.item.author,
        localOnly: false,
      };
      setBooks((current) => [
        savedBook,
        ...current.filter((item) => item.source_url !== book.source_url),
      ]);
      removeLocalBook(book.source_url!);
      setNotice("Book saved to your account and ready to export.");
    } catch (caught) {
      setNotice("Saved in this browser and ready to export. Database synchronization is pending.");
      setError(
        caught instanceof Error && caught.name !== "TimeoutError"
          ? caught.message
          : "Saving timed out. Export now or use Retry sync to try again.",
      );
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

  const allBooks = [
    ...localBooks.filter((localBook) => {
      const ratings = localBook.scout_review_counts.find(
        (item) => item.platform === "amazon",
      )?.review_count;
      return (
        localBook.genre === genre &&
        ratings !== null &&
        ratings !== undefined &&
        ratings >= ratingMin &&
        ratings <= ratingMax &&
        !books.some((book) => book.source_url === localBook.source_url)
      );
    }),
    ...books,
  ];
  const visibleBooks = savedOnly
    ? allBooks.filter((book) => book.scout_prospects.length > 0)
    : allBooks;

  function exportCsv() {
    const header = ["Author name", "Book title", "Amazon ratings", "Genre", "ASIN", "Amazon URL"];
    const rows = visibleBooks.map((book) => {
      const ratings = book.scout_review_counts.find((item) => item.platform === "amazon");
      return [
        book.scout_authors?.name,
        book.title,
        ratings?.review_count,
        book.genre,
        book.asin,
        book.source_url,
      ];
    });
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `hq360-${genre.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}-authors.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="min-h-[70vh] bg-secondary/30">
      <div className="mx-auto max-w-5xl px-5 py-10 sm:px-6">
        <p className="text-xs font-semibold tracking-widest text-brand uppercase">HQ360 Scout</p>
        <h1 className="mt-2 font-display text-3xl">Find emerging authors on Amazon</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Search Google for Amazon books, verify the listing, then import authors whose books have
          between 1 and 49 ratings.
        </p>

        <section className="mt-7 rounded-2xl border border-border bg-card p-5">
          <h2 className="font-semibold">1. Build the search</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm font-medium" htmlFor="scout-genre">
              Genre
              <select
                id="scout-genre"
                value={genre}
                onChange={(event) => setGenre(event.target.value as (typeof GENRES)[number])}
                className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3"
              >
                {GENRES.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium" htmlFor="scout-rating-min">
              Minimum ratings
              <input
                id="scout-rating-min"
                type="number"
                min="1"
                max={ratingMax}
                value={ratingMin}
                onChange={(event) =>
                  setRatingMin(Math.min(ratingMax, Math.max(1, Number(event.target.value) || 1)))
                }
                className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3"
              />
            </label>
            <label className="text-sm font-medium" htmlFor="scout-rating-max">
              Maximum ratings
              <input
                id="scout-rating-max"
                type="number"
                min={ratingMin}
                max="49"
                value={ratingMax}
                onChange={(event) =>
                  setRatingMax(Math.min(49, Math.max(ratingMin, Number(event.target.value) || 49)))
                }
                className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3"
              />
            </label>
            <label className="text-sm font-medium" htmlFor="scout-market">
              Amazon market
              <select
                id="scout-market"
                value={marketIndex}
                onChange={(event) => setMarketIndex(Number(event.target.value))}
                className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3"
              >
                {MARKETS.map((item, index) => (
                  <option key={item.domain} value={index}>
                    {item.country} · {item.domain}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-4 rounded-xl bg-secondary px-4 py-3 font-mono text-xs text-muted-foreground">
            {googleQuery}
          </div>
          <a
            href={googleUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
          >
            <Search className="h-4 w-4" /> Search Google
          </a>
          <p className="mt-3 text-xs text-muted-foreground">
            Search opens Google in another tab. Results are not automatically collected. Open each
            book's Amazon page, then add its details below to export them.
          </p>
        </section>

        <section className="mt-5 rounded-2xl border border-border bg-card p-5">
          <h2 className="font-semibold">2. Import a qualified Amazon book</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Open a result, confirm its author and rating count, then enter the listing below.
          </p>
          <form onSubmit={importBook} className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium">
              Author name
              <input
                name="authorName"
                required
                className="mt-2 w-full rounded-xl border bg-background px-4 py-3"
              />
            </label>
            <label className="text-sm font-medium">
              Book title
              <input
                name="bookTitle"
                required
                className="mt-2 w-full rounded-xl border bg-background px-4 py-3"
              />
            </label>
            <label className="text-sm font-medium sm:col-span-2">
              Direct Amazon product URL
              <input
                name="amazonUrl"
                required
                type="url"
                placeholder={`https://www.${market.domain}/dp/XXXXXXXXXX`}
                className="mt-2 w-full rounded-xl border bg-background px-4 py-3"
              />
            </label>
            <label className="text-sm font-medium">
              Amazon ratings
              <input
                name="reviewCount"
                required
                type="number"
                min={ratingMin}
                max={ratingMax}
                className="mt-2 w-full rounded-xl border bg-background px-4 py-3"
              />
            </label>
            <button
              disabled={Boolean(busy)}
              className="self-end rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {busy ? "Saving…" : "Import author"}
            </button>
          </form>
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
                onClick={() => setSavedOnly(saved)}
                className={cn(
                  "rounded-full px-4 py-2 text-sm",
                  savedOnly === saved
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground",
                )}
              >
                {saved ? "Saved authors" : "Imported authors"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <p className="text-sm text-muted-foreground">{visibleBooks.length} books</p>
            <button
              type="button"
              disabled={visibleBooks.length === 0}
              onClick={exportCsv}
              className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium disabled:opacity-40"
            >
              <Download className="h-4 w-4" /> Export CSV
            </button>
          </div>
        </div>

        {loading && visibleBooks.length === 0 ? (
          <div role="status" className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="sr-only">Loading authors</span>
          </div>
        ) : visibleBooks.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed p-12 text-center">
            <h2 className="font-semibold">No qualifying Amazon authors imported yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Run the Google search and import the first verified listing above.
            </p>
          </div>
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {visibleBooks.map((book) => {
              const saved = book.scout_prospects.length > 0;
              const amazonReviews = book.scout_review_counts.find(
                (item) => item.platform === "amazon",
              );
              return (
                <article key={book.id} className="rounded-2xl border border-border bg-card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold">{book.scout_authors?.name}</h2>
                      <p className="mt-1 text-sm font-medium">{book.title}</p>
                    </div>
                    <button
                      disabled={saved || Boolean(busy)}
                      onClick={() => (book.localOnly ? syncBook(book) : save(book))}
                      className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs disabled:opacity-60"
                    >
                      {saved ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Bookmark className="h-3.5 w-3.5" />
                      )}
                      {book.localOnly
                        ? busy === book.id
                          ? "Syncing…"
                          : "Retry sync"
                        : saved
                          ? "Saved"
                          : busy === book.id
                            ? "Saving…"
                            : "Save"}
                    </button>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {book.genre} · {amazonReviews?.review_count} verified Amazon ratings
                  </p>
                  {book.localOnly ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Stored in this browser and included in CSV export.
                    </p>
                  ) : null}
                  <div className="mt-4">
                    <PublicLink url={book.source_url}>View Amazon listing</PublicLink>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
