import { useEffect, useState } from "react";
import type { ReadersFavoriteBook } from "@/lib/scout/readers-favorite";
const DEFAULT = "/book-reviews/book-reviews-genre-fiction-thriller-general.htm";
type Result = {
  items: ReadersFavoriteBook[];
  genres: { path: string; name: string }[];
  hasNext: boolean;
};
type Saved = {
  id: string;
  title: string;
  source_url: string;
  scout_authors: { id: string; name: string } | null;
};
async function request<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(
    url,
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {},
  );
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      data.message ||
        (data.error === "unknown_source"
          ? "Apply the Readers’ Favorite source migration before importing."
          : data.error) ||
        "Request failed.",
    );
  return data;
}
const field = "mt-2 w-full rounded-xl border border-border bg-background p-3";
export function ReadersFavoriteScout() {
  const [catalog, setCatalog] = useState(DEFAULT);
  const [genres, setGenres] = useState([{ path: DEFAULT, name: "Fiction - Thriller - General" }]);
  const [items, setItems] = useState<ReadersFavoriteBook[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [saved, setSaved] = useState<Saved[]>([]);
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [minRating, setMinRating] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    request<{ items: Saved[] }>("/api/admin/scout-books?source=readers_favorite")
      .then((data) => {
        if (active) setSaved(data.items);
      })
      .catch(() => {
        if (active)
          setError(
            "Saved books could not load. Search remains available; retry imports carefully.",
          );
      });
    return () => {
      active = false;
    };
  }, []);
  const visible = items.filter(
    (item) => !minRating || (item.rating !== null && item.rating >= minRating),
  );
  async function search(next = 1) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const data = await request<Result>("/api/admin/scout-readers-favorite", {
        catalog,
        page: next,
      });
      setItems((current) =>
        next === 1
          ? data.items
          : [
              ...current,
              ...data.items.filter(
                (item) => !current.some((old) => old.sourceUrl === item.sourceUrl),
              ),
            ],
      );
      setGenres((current) => [
        ...new Map([...current, ...data.genres].map((item) => [item.path, item])).values(),
      ]);
      setPage(next);
      setHasNext(data.hasNext);
      if (next === 1) setSelected([]);
      setMessage(`${data.items.length} listings read from page ${next}. Select authors to import.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    setBusy(true);
    setError("");
    let count = 0;
    let skipped = 0;
    const batchId = crypto.randomUUID();
    try {
      for (const item of visible.filter((item) => selected.includes(item.sourceUrl))) {
        const result = await request<{
          duplicate?: boolean;
          item: { author: { id: string; name: string }; book: { id: string } };
        }>("/api/admin/scout-manual-ingest", {
          sourceSlug: "readers_favorite",
          sourceUrl: item.sourceUrl,
          bookUrl: item.sourceUrl,
          authorName: item.authorName,
          bookTitle: item.title,
          genre: item.genre,
          batchId,
          batchLabel: `Readers' Favorite · ${new Date().toLocaleDateString()}`,
          ...(item.rating === null
            ? {}
            : { reviewPlatform: "readers_favorite", reviewRating: item.rating }),
        });
        if (result.duplicate) {
          skipped++;
          setSelected((current) => current.filter((url) => url !== item.sourceUrl));
          continue;
        }
        setSaved((current) => [
          {
            id: result.item.book.id,
            title: item.title,
            source_url: item.sourceUrl,
            scout_authors: result.item.author,
          },
          ...current.filter((old) => old.source_url !== item.sourceUrl),
        ]);
        setSelected((current) => current.filter((url) => url !== item.sourceUrl));
        count++;
      }
      setMessage(
        `${count} books imported. ${skipped} previously generated authors skipped. Use Save for follow-up below to add authors to the existing lead workflow.`,
      );
    } catch (e) {
      setError(
        `${count} imported before the error: ${(e as Error).message}. Remaining selections can be retried.`,
      );
    } finally {
      setBusy(false);
    }
  }
  async function followUp(book: Saved) {
    if (!book.scout_authors) return;
    setBusy(true);
    setError("");
    try {
      await request("/api/admin/scout-prospects", {
        scoutAuthorId: book.scout_authors.id,
        bookId: book.id,
      });
      setMessage(
        `${book.scout_authors.name} is saved for follow-up. Existing exclusions are respected.`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function exportCsv() {
    const rows = [
      ["Author", "Book", "Genre", "Readers' Favorite score (out of 5)", "Source URL"],
      ...visible.map((item) => [
        item.authorName,
        item.title,
        item.genre,
        item.rating ?? "",
        item.sourceUrl,
      ]),
    ];
    const csv = rows
      .map((row) =>
        row
          .map((value) => {
            let text = String(value);
            if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
            return `"${text.replaceAll('"', '""')}"`;
          })
          .join(","),
      )
      .join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "readers-favorite-authors.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <h1 className="text-3xl font-display">Find authors on Readers’ Favorite</h1>
      <p className="mt-3 text-muted-foreground">
        Browse public genre listings, review the results and import selected authors. A star score
        is not a review count; publishing type, debut status and contact details remain unverified.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void search();
        }}
        className="mt-6 rounded-2xl border bg-card p-5"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            Genre
            <select
              className={field}
              value={genres.some((item) => item.path === catalog) ? catalog : "custom"}
              disabled={busy}
              onChange={(event) => {
                setCatalog(event.target.value === "custom" ? "" : event.target.value);
                setPage(0);
                setHasNext(false);
                setItems([]);
                setSelected([]);
              }}
            >
              {genres.map((item) => (
                <option key={item.path} value={item.path}>
                  {item.name}
                </option>
              ))}
              <option value="custom">Another genre URL</option>
            </select>
          </label>
          <label>
            Readers’ Favorite genre URL
            <input
              required
              className={field}
              value={catalog}
              disabled={busy}
              onChange={(event) => {
                setCatalog(event.target.value);
                setPage(0);
                setHasNext(false);
                setItems([]);
                setSelected([]);
              }}
            />
          </label>
          <label>
            Minimum score
            <select
              className={field}
              value={minRating}
              onChange={(event) => {
                setMinRating(Number(event.target.value));
                setSelected([]);
              }}
            >
              <option value={0}>Any / unknown</option>
              <option value={4}>4 stars or above</option>
              <option value={5}>5 stars</option>
            </select>
          </label>
        </div>
        <button
          disabled={busy}
          className="mt-5 rounded-full bg-primary px-5 py-3 text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Working…" : "Search Readers’ Favorite"}
        </button>
        <a
          href="https://readersfavorite.com/"
          target="_blank"
          rel="noreferrer"
          className="ml-4 underline"
        >
          Browse source genres
        </a>
      </form>
      {error && (
        <p role="alert" className="mt-4 text-destructive">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="mt-4">
          {message}
        </p>
      )}
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          disabled={busy || !visible.length}
          onClick={() =>
            setSelected(
              visible
                .filter((item) => !saved.some((book) => book.source_url === item.sourceUrl))
                .map((item) => item.sourceUrl),
            )
          }
          className="rounded-full border px-4 py-2 disabled:opacity-50"
        >
          Select new results
        </button>
        <button
          disabled={busy || !selected.length}
          onClick={() => void save()}
          className="rounded-full border px-4 py-2 disabled:opacity-50"
        >
          Import selected ({selected.length})
        </button>
        <button
          disabled={!visible.length}
          onClick={exportCsv}
          className="rounded-full border px-4 py-2 disabled:opacity-50"
        >
          Export results CSV
        </button>
      </div>
      <ul className="mt-4 divide-y">
        {visible.map((item) => (
          <li key={item.sourceUrl} className="py-4">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 size-4"
                checked={selected.includes(item.sourceUrl)}
                disabled={busy || saved.some((book) => book.source_url === item.sourceUrl)}
                onChange={(event) =>
                  setSelected((current) =>
                    event.target.checked
                      ? [...current, item.sourceUrl]
                      : current.filter((url) => url !== item.sourceUrl),
                  )
                }
              />
              <span>
                <strong>{item.title}</strong> — {item.authorName}
                <small className="mt-1 block text-muted-foreground">
                  {item.genre} · {item.rating === null ? "Score unknown" : `${item.rating}/5`}{" "}
                  {saved.some((book) => book.source_url === item.sourceUrl) ? "· Imported" : ""}
                </small>
              </span>
            </label>
            <a
              className="ml-7 text-sm underline"
              href={item.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              View source listing
            </a>
          </li>
        ))}
      </ul>
      {page > 0 && !visible.length && <p className="py-6">No listings match this score filter.</p>}
      {hasNext && page < 100 && (
        <button
          disabled={busy}
          onClick={() => void search(page + 1)}
          className="rounded-full border px-4 py-2"
        >
          Load next page
        </button>
      )}
      <h2 className="mt-10 text-2xl">Recent Readers’ Favorite imports</h2>
      <ul className="mt-4 divide-y">
        {saved.map((book) => (
          <li className="flex flex-wrap items-center justify-between gap-3 py-4" key={book.id}>
            <span>
              {book.title} — {book.scout_authors?.name}
            </span>
            <button
              disabled={busy || !book.scout_authors}
              onClick={() => void followUp(book)}
              className="rounded-full border px-4 py-2 disabled:opacity-50"
            >
              Save for follow-up
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
