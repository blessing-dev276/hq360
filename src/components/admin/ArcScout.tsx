import { useEffect, useRef, useState } from "react";
import { GlassLoading } from "@/components/ui/glass-loading";
import {
  ARC_GENRES,
  ARC_SOURCES,
  type ArcSource,
  type ArcBatch,
  type ArcListing,
} from "@/lib/scout/arc-sources";
const field = "mt-2 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm";
const button =
  "rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50";
async function api<T>(
  url: string,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
    ...(signal ? { signal } : {}),
  });
  const data = await response.json();
  if (!response.ok || data.ok === false)
    throw new Error(data.message || data.error || "Request failed.");
  return data;
}
const endpoint = "/api/admin/scout-arc-discovery";
function Listing({
  item,
  batch,
  disabled,
  onSave,
}: {
  item: ArcListing;
  batch: ArcBatch;
  disabled: boolean;
  onSave: (
    item: ArcListing,
    values: { title: string; author: string; date: string },
  ) => Promise<void>;
}) {
  const [title, setTitle] = useState(item.title),
    [author, setAuthor] = useState(item.author_name ?? ""),
    [date, setDate] = useState(item.publication_date ?? "");
  return (
    <article className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          {item.discovery_method === "public_catalog"
            ? "Public catalogue"
            : item.discovery_method === "manual"
              ? "Added link"
              : "Search listing"}
        </span>
        <a
          href={item.source_url}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-brand underline"
        >
          Review on {ARC_SOURCES[item.source].name} ↗
        </a>
      </div>
      <h3 className="mt-3 text-lg font-semibold">{item.title || "Book details needed"}</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {item.author_name || "Author unknown"} ·{" "}
        {item.publication_date || "Publication date unknown"} · Review count unknown
      </p>
      {item.evidence && <p className="mt-3 text-sm text-muted-foreground">{item.evidence}</p>}
      {item.book_id ? (
        <p className="mt-4 text-sm font-medium text-brand">
          Author saved to {batch.label}. Open author details below.
        </p>
      ) : item.title.trim() && item.author_name?.trim() ? (
        <p className="mt-4 text-sm text-muted-foreground">Ready to save with the batch.</p>
      ) : (
        <form
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void onSave(item, { title, author, date });
          }}
        >
          <p className="text-xs text-muted-foreground">
            Add the missing details to save this author.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm">
              Book title
              <input
                required
                maxLength={300}
                className={field}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={disabled}
              />
            </label>
            <label className="text-sm">
              Author name
              <input
                required
                maxLength={160}
                className={field}
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                disabled={disabled}
              />
            </label>
            <label className="text-sm">
              Publication date
              <input
                type="date"
                className={field}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={disabled}
              />
            </label>
          </div>
          <button className={button} disabled={disabled || !title.trim() || !author.trim()}>
            Save author details
          </button>
        </form>
      )}
    </article>
  );
}
export function ArcScout({
  source,
  onBusyChange,
  onOpenBatch,
}: {
  source: ArcSource;
  onBusyChange: (busy: boolean) => void;
  onOpenBatch: (batch: ArcBatch) => void;
}) {
  const [genre, setGenre] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [unknown, setUnknown] = useState(true),
    [page, setPage] = useState(1),
    [url, setUrl] = useState("");
  const [batches, setBatches] = useState<ArcBatch[]>([]),
    [selected, setSelected] = useState(""),
    [items, setItems] = useState<ArcListing[]>([]),
    [busy, setBusy] = useState(""),
    [progress, setProgress] = useState<{ done: number; total: number } | undefined>(),
    [batchesLoading, setBatchesLoading] = useState(true),
    [detailsLoading, setDetailsLoading] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [reload, setReload] = useState(0);
  const loading = batchesLoading || detailsLoading;
  const retry = useRef<{ key: string; id: string } | null>(null);
  const spec = ARC_SOURCES[source],
    batch = batches.find((b) => b.id === selected);
  useEffect(() => {
    onBusyChange(Boolean(busy));
    return () => onBusyChange(false);
  }, [busy, onBusyChange]);
  useEffect(() => {
    const controller = new AbortController();
    setBatchesLoading(true);
    setError("");
    api<{ items: ArcBatch[] }>(`${endpoint}?source=${source}`, "GET", undefined, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setBatches(data.items);
        setSelected((current) =>
          data.items.some((b) => b.id === current) ? current : (data.items[0]?.id ?? ""),
        );
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setBatchesLoading(false);
      });
    return () => controller.abort();
  }, [source, reload]);
  useEffect(() => {
    setItems([]);
    if (!selected) {
      setDetailsLoading(false);
      return;
    }
    const controller = new AbortController();
    setDetailsLoading(true);
    api<{ items: ArcListing[] }>(
      `${endpoint}?source=${source}&batchId=${selected}`,
      "GET",
      undefined,
      controller.signal,
    )
      .then((data) => {
        if (!controller.signal.aborted) setItems(data.items);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setDetailsLoading(false);
      });
    return () => controller.abort();
  }, [source, selected, reload]);
  async function search(manual = false) {
    const values = {
      source,
      genre: source === "booknotification" ? "" : genre,
      from: source === "booknotification" ? "" : from,
      to: source === "booknotification" ? "" : to,
      includeUnknown: source === "booknotification" ? true : unknown,
      page: source === "booksirens" || source === "booknotification" ? 1 : page,
      limit: 10,
      ...(manual ? { listingUrl: url } : {}),
    };
    const key = JSON.stringify(values);
    if (retry.current?.key !== key) retry.current = { key, id: crypto.randomUUID() };
    setBusy(manual ? "Saving listing…" : `Discovering ${spec.name} books…`);
    setError("");
    setNotice("");
    try {
      const result = await api<{ batch: ArcBatch; message: string }>(endpoint, "POST", {
        ...values,
        requestId: retry.current.id,
      });
      const discovered = await api<{ items: ArcListing[] }>(
        `${endpoint}?source=${source}&batchId=${result.batch.id}`,
      );
      const summary = await saveReady(discovered.items, result.batch);
      retry.current = null;
      setBatches((current) => [result.batch, ...current.filter((b) => b.id !== result.batch.id)]);
      setSelected(result.batch.id);
      setNotice(`${result.message} ${summary}`);
      setReload((n) => n + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function persistAuthor(
    item: ArcListing,
    target: ArcBatch,
    values: { title: string; author: string; date: string },
  ) {
    const result = await api<{ duplicate?: boolean; item: { book: { id: string } } }>(
      "/api/admin/scout-manual-ingest",
      "POST",
      {
        sourceSlug: source,
        sourceUrl: item.source_url,
        bookUrl: item.source_url,
        bookTitle: values.title.trim(),
        authorName: values.author.trim(),
        ...(values.date ? { publicationDate: values.date } : {}),
        ...(item.genre ? { genre: item.genre } : {}),
        description: item.evidence,
        batchId: target.id,
        batchLabel: target.label,
      },
    );
    if (result.duplicate) return false;
    await api(endpoint, "PATCH", { listingId: item.id, bookId: result.item.book.id });
    setItems((current) =>
      current.map((row) =>
        row.id === item.id
          ? {
              ...row,
              book_id: result.item.book.id,
              title: values.title,
              author_name: values.author,
              publication_date: values.date || null,
            }
          : row,
      ),
    );
    return true;
  }
  async function saveReady(rows: ArcListing[], target: ArcBatch) {
    const pending = rows.filter(
      (item) => !item.book_id && item.title.trim() && item.author_name?.trim(),
    );
    const incomplete = rows.filter(
      (item) => !item.book_id && (!item.title.trim() || !item.author_name?.trim()),
    ).length;
    let saved = 0,
      skipped = 0,
      failed = 0;
    setProgress({ done: 0, total: pending.length });
    for (const [index, item] of pending.entries()) {
      setBusy(`Saving authors ${index + 1} of ${pending.length}…`);
      try {
        const added = await persistAuthor(item, target, {
          title: item.title,
          author: item.author_name!,
          date: item.publication_date ?? "",
        });
        if (added) saved++;
        else skipped++;
      } catch {
        failed++;
      }
      setProgress({ done: index + 1, total: pending.length });
    }
    setProgress(undefined);
    return `${saved} authors saved automatically.${skipped ? ` ${skipped} previously generated authors skipped.` : ""}${incomplete ? ` ${incomplete} listings need a name or book title.` : ""}${failed ? ` ${failed} could not be saved. Use Save all ready authors to retry.` : ""}`;
  }
  async function saveBatch() {
    if (!batch || busy) return;
    setBusy("Saving batch authors…");
    setError("");
    try {
      setNotice(await saveReady(items, batch));
    } finally {
      setBusy("");
      setProgress(undefined);
    }
  }
  async function save(item: ArcListing, values: { title: string; author: string; date: string }) {
    if (!batch) return;
    setBusy("Saving author details…");
    setError("");
    try {
      const added = await persistAuthor(item, batch, values);
      if (!added) setNotice("This author was already generated in your workspace and was skipped.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-border bg-secondary/30 p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand">
          Early-review discovery · {spec.method}
        </p>
        <h2 className="mt-2 text-2xl font-semibold">Find books on {spec.name}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {spec.note} A review-copy listing does not establish a book’s review count or the author’s
          interest in services.
        </p>
      </section>
      <form
        className="space-y-4 rounded-2xl border border-border bg-card p-5"
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        {source === "booknotification" ? (
          <p className="text-sm text-muted-foreground">
            Discover the latest public upcoming-release sample. BookNotification does not provide
            review totals here; check those before treating an author as low-review.
          </p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-sm">
                Genre
                <select
                  aria-label="Genre"
                  className={field}
                  value={genre}
                  disabled={!!busy}
                  onChange={(e) => setGenre(e.target.value)}
                >
                  <option value="">All genres</option>
                  {ARC_GENRES.map((g) => (
                    <option key={g}>{g}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                Publication from
                <input
                  type="date"
                  className={field}
                  value={from}
                  disabled={!!busy}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </label>
              <label className="text-sm">
                Publication until
                <input
                  type="date"
                  min={from || undefined}
                  className={field}
                  value={to}
                  disabled={!!busy}
                  onChange={(e) => setTo(e.target.value)}
                />
              </label>
              {source !== "booksirens" && (
                <label className="text-sm">
                  Search page
                  <select
                    className={field}
                    value={page}
                    disabled={!!busy}
                    onChange={(e) => setPage(Number(e.target.value))}
                  >
                    {Array.from({ length: 10 }, (_, i) => (
                      <option key={i} value={i + 1}>
                        {i + 1}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={unknown}
                disabled={!!busy}
                onChange={(e) => setUnknown(e.target.checked)}
              />
              Include listings with unknown publication dates
            </label>
          </>
        )}
        <p className="text-xs text-muted-foreground">
          Up to 10 listings per search. Missing publication dates are never estimated.
          {source === "booksirens"
            ? " This is a sample of the public catalogue, not its full inventory."
            : source === "booknotification"
              ? " This is a small current-release sample, not a review-count filter."
              : " Search-index coverage may be incomplete or out of date."}
        </p>
        <button className={button} disabled={!!busy}>
          Search and create batch
        </button>
      </form>
      <details className="rounded-2xl border border-border p-5">
        <summary className="cursor-pointer text-sm font-medium">
          Add a specific {source === "booknotification" ? "author" : "book"} link
        </summary>
        <form
          className="mt-3 flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void search(true);
          }}
        >
          <label className="min-w-64 flex-1 text-sm">
            {spec.name} {source === "booknotification" ? "author" : "book"} URL
            <input
              required
              type="url"
              className={field}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={!!busy}
            />
          </label>
          <button className={button} disabled={!!busy}>
            Add to new batch
          </button>
        </form>
      </details>
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 p-4 text-sm text-destructive"
        >
          {error}{" "}
          <button className="underline" disabled={!!busy} onClick={() => setReload((n) => n + 1)}>
            Reload batches
          </button>
        </div>
      )}
      {notice && (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      )}
      {busy && <GlassLoading label={busy} progress={progress} cards />}
      <section className="space-y-4">
        <label className="block text-sm font-medium">
          Batch
          <select
            aria-label="Discovery batch"
            className={field}
            disabled={!!busy || loading}
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">Select a batch</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label} · {new Date(b.created_at).toLocaleString()}
              </option>
            ))}
          </select>
        </label>
        <p className="text-sm text-muted-foreground">
          Authors with a name and book title are saved automatically after each search. Missing
          dates do not block saving.
        </p>
        {batch &&
          items.some((item) => !item.book_id && item.title.trim() && item.author_name?.trim()) && (
            <button
              className={button}
              disabled={!!busy || loading}
              onClick={() => void saveBatch()}
            >
              Save all ready authors
            </button>
          )}
        {loading ? (
          <GlassLoading label="Loading saved discoveries…" cards />
        ) : items.length && batch ? (
          items.map((item) => (
            <Listing key={item.id} item={item} batch={batch} disabled={!!busy} onSave={save} />
          ))
        ) : (
          <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            {selected
              ? "No public listings matched this search. Try another genre, search page, or include unknown publication dates."
              : "Search a source to create your first batch."}
          </p>
        )}
        {batch && items.some((item) => item.book_id) && (
          <button
            className={button}
            disabled={!!busy || loading}
            onClick={() => onOpenBatch(batch)}
          >
            Open author details
          </button>
        )}
      </section>
    </div>
  );
}
