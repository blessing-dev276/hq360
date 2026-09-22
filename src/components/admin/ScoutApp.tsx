import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Bookmark, Check, ExternalLink, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { canonicalUrl } from "@/lib/scout/normalize";

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
  genre: string | null;
  source_url: string | null;
  scout_authors: { id: string; name: string; country: string | null } | null;
  scout_review_counts: { platform: string; review_count: number | null }[];
  scout_prospects: { id: string; status: string }[];
};

async function api<T>(url: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    ...(body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
    ...(signal ? { signal } : {}),
  });
  const result = await response.json();
  if (!response.ok || !result.ok) {
    const messages: Record<string, string> = {
      invalid_amazon_book:
        "Use a direct Amazon URL containing /dp/ or /gp/product/, and enter 1–49 ratings.",
      storage: "The book could not be saved. Please try again.",
    };
    throw new Error(
      messages[result.error] ?? result.message ?? "Scout could not complete that request.",
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

export function ScoutApp() {
  const [genre, setGenre] = useState<(typeof GENRES)[number]>("Horror");
  const [marketIndex, setMarketIndex] = useState(0);
  const [savedOnly, setSavedOnly] = useState(false);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refresh, setRefresh] = useState(0);
  const market = MARKETS[marketIndex]!;
  const googleQuery = useMemo(
    () => `site:${market.domain} ${genre.toLowerCase()} ${market.country} "ratings"`,
    [genre, market.country, market.domain],
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
        reviewMin: "1",
        reviewMax: "49",
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
    [genre],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadBooks(controller.signal);
    return () => controller.abort();
  }, [loadBooks, refresh]);

  async function importBook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy("import");
    setError("");
    setNotice("");
    try {
      await api("/api/admin/scout-manual-ingest", {
        sourceSlug: "amazon_books",
        sourceUrl: String(form.get("amazonUrl") ?? ""),
        bookUrl: String(form.get("amazonUrl") ?? ""),
        authorName: String(form.get("authorName") ?? ""),
        bookTitle: String(form.get("bookTitle") ?? ""),
        amazonReviewCount: Number(form.get("reviewCount")),
        genre,
      });
      formElement.reset();
      setNotice("Amazon book imported and its 1–49 ratings qualification recorded.");
      setRefresh((value) => value + 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not import this book.");
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

  const visibleBooks = savedOnly ? books.filter((book) => book.scout_prospects.length > 0) : books;

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
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
            Google finds candidates; confirm the rating count on the Amazon product page.
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
                min="1"
                max="49"
                className="mt-2 w-full rounded-xl border bg-background px-4 py-3"
              />
            </label>
            <button
              disabled={busy === "import"}
              className="self-end rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {busy === "import" ? "Importing…" : "Import author"}
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

        <div className="mt-7 flex items-center justify-between gap-3">
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
          <p className="text-sm text-muted-foreground">{visibleBooks.length} books</p>
        </div>

        {loading ? (
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
                    {book.genre} · {amazonReviews?.review_count} verified Amazon ratings
                  </p>
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
