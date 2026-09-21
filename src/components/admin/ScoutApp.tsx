import { REEDSY_GENRES } from "@/lib/scout/sources/reedsy/policy";
import { useCallback, useEffect, useState } from "react";
import { Bookmark, Check, ExternalLink, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { canonicalUrl } from "@/lib/scout/normalize";

const GENRES = REEDSY_GENRES;
type Book = {
  id: string;
  title: string;
  genre: string | null;
  source_url: string | null;
  cover_image_url: string | null;
};
type Author = {
  id: string;
  name: string;
  bio: string | null;
  author_profile_url: string | null;
  website_url: string | null;
  identity_status: string;
  scout_discovered_books: Book[];
  scout_prospects: { id: string; status: string; do_not_contact: boolean }[];
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
  if (!response.ok || !result.ok)
    throw new Error(result.message ?? result.error ?? "Could not load Scout. Please try again.");
  return result;
}
function PublicLink({
  url,
  children,
}: {
  url: string | null | undefined;
  children: React.ReactNode;
}) {
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
  const [genre, setGenre] = useState("Fantasy"),
    [savedOnly, setSavedOnly] = useState(false),
    [page, setPage] = useState(0);
  const [authors, setAuthors] = useState<Author[]>([]),
    [total, setTotal] = useState(0),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [access, setAccess] = useState<{ canCrawl: boolean; message: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ genre, page: String(page), saved: String(savedOnly) });
    api<{ items: Author[]; total: number; access: { canCrawl: boolean; message: string } }>(
      `/api/admin/scout-reedsy-authors?${params}`,
      undefined,
      controller.signal,
    )
      .then((data) => {
        setAuthors(data.items);
        setTotal(data.total);
        setAccess(data.access);
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "Could not load authors.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [genre, page, savedOnly, refresh]);
  const findAuthors = useCallback(async () => {
    setBusy("crawl");
    setError("");
    try {
      await api("/api/admin/scout-discover", { genre });
      setPage(0);
      setRefresh((v) => v + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not collect authors.");
    } finally {
      setBusy("");
    }
  }, [genre]);
  async function save(author: Author) {
    setBusy(author.id);
    setError("");
    try {
      await api("/api/admin/scout-prospects", {
        scoutAuthorId: author.id,
        bookId: author.scout_discovered_books[0]?.id ?? null,
      });
      setRefresh((v) => v + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save author.");
    } finally {
      setBusy("");
    }
  }
  return (
    <div className="min-h-[70vh] bg-secondary/30">
      <div className="mx-auto max-w-5xl px-5 py-10 sm:px-6">
        <p className="text-xs font-semibold tracking-widest text-brand uppercase">HQ360 Scout</p>
        <h1 className="mt-2 font-display text-3xl">Find authors on Reedsy</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Choose a genre. Find recently featured authors and save the ones you want to research.
        </p>
        <div className="mt-7 rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex-1 text-sm font-medium" htmlFor="scout-genre">
              Genre
              <select
                id="scout-genre"
                value={genre}
                onChange={(e) => {
                  setGenre(e.target.value);
                  setPage(0);
                }}
                className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3"
              >
                {GENRES.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </label>
            <button
              onClick={findAuthors}
              disabled={!access?.canCrawl || Boolean(busy) || loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {busy === "crawl" && <Loader2 className="h-4 w-4 animate-spin" />}Find authors
            </button>
          </div>
          {access && !access.canCrawl && (
            <p className="mt-3 text-sm text-muted-foreground">
              {access.message}{" "}
              <a
                href="https://reedsy.com/about/tou"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                Reedsy terms
              </a>
            </p>
          )}
        </div>
        <div className="mt-7 flex items-center justify-between gap-3">
          <div className="flex gap-1 rounded-full border bg-card p-1">
            {[false, true].map((saved) => (
              <button
                key={String(saved)}
                onClick={() => {
                  setSavedOnly(saved);
                  setPage(0);
                }}
                className={cn(
                  "rounded-full px-4 py-2 text-sm",
                  savedOnly === saved
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground",
                )}
              >
                {saved ? "Saved authors" : "Authors"}
              </button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            {loading ? "Loading…" : `${total} ${total === 1 ? "author" : "authors"}`}
          </p>
        </div>
        {error && (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-destructive/10 p-4 text-sm text-destructive"
          >
            {error}
          </p>
        )}
        {loading ? (
          <div role="status" className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="sr-only">Loading authors</span>
          </div>
        ) : authors.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed p-12 text-center">
            <h2 className="font-semibold">
              {savedOnly ? "No saved authors in this genre" : "No Reedsy authors in this genre yet"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {savedOnly
                ? "Save an author from the Authors tab to keep them here."
                : access?.canCrawl
                  ? "Choose Find authors to collect authors from Reedsy."
                  : "Collection is currently unavailable. Existing Reedsy records will appear here."}
            </p>
          </div>
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {authors.map((author) => {
              const saved = author.scout_prospects.length > 0;
              return (
                <article key={author.id} className="rounded-2xl border border-border bg-card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold">{author.name}</h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {author.identity_status === "verified"
                          ? "Identity verified"
                          : "Needs identity review"}
                      </p>
                    </div>
                    <button
                      disabled={saved || Boolean(busy)}
                      onClick={() => save(author)}
                      className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs disabled:opacity-60"
                    >
                      {saved ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Bookmark className="h-3.5 w-3.5" />
                      )}
                      {saved ? "Saved" : busy === author.id ? "Saving…" : "Save"}
                    </button>
                  </div>
                  {author.bio && (
                    <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{author.bio}</p>
                  )}
                  <ul className="mt-4 space-y-2">
                    {author.scout_discovered_books.map((book) => (
                      <li key={book.id}>
                        <p className="text-sm font-medium">{book.title}</p>
                        <PublicLink url={book.source_url}>View on Reedsy</PublicLink>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <PublicLink url={author.author_profile_url}>Author profile</PublicLink>
                    <PublicLink url={author.website_url}>Website</PublicLink>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        {!loading && total > 25 && (
          <div className="mt-6 flex items-center justify-center gap-4">
            <button
              disabled={page === 0}
              onClick={() => setPage((v) => v - 1)}
              className="rounded-full border px-4 py-2 text-sm disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-sm">
              Page {page + 1} of {Math.ceil(total / 25)}
            </span>
            <button
              disabled={(page + 1) * 25 >= total}
              onClick={() => setPage((v) => v + 1)}
              className="rounded-full border px-4 py-2 text-sm disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
