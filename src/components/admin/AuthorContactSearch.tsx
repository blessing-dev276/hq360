import type { ContactEvidence } from "@/lib/scout/email-report";
import { EmailCheckBadge, type EmailCheck } from "./EmailCheckBadge";
import { useCallback, useRef, useState } from "react";
import { Copy, Loader2, MailCheck, MailX, Search, Square } from "lucide-react";

export type EmailSearch = {
  status: "idle" | "queued" | "searching" | "found" | "not_found" | "paused" | "error";
  emails: string[];
  contacts?: ContactEvidence[];
  error?: string;
};
type AuthorRef = {
  id: string;
  contact_emails?: string[] | null;
  contact_search_status?: string | null;
  contact_evidence?: ContactEvidence[] | null;
};

/** Saved result for an author, as the batch API returns it. */
export function savedSearch(author: AuthorRef | null | undefined): EmailSearch {
  if (author?.contact_search_status === "found")
    return {
      status: "found",
      emails: author.contact_emails ?? [],
      contacts: author.contact_evidence ?? [],
    };
  if (author?.contact_search_status === "not_found") return { status: "not_found", emails: [] };
  return { status: "idle", emails: [] };
}

async function searchOne(
  authorId: string,
  bookId: string,
  retry = false,
  runId?: string,
): Promise<EmailSearch> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await fetch(`/api/admin/scout-authors/${authorId}/find-contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookId, retry, runId }),
    }).catch(() => null);
    if (!response) return { status: "error", emails: [], error: "Connection lost." };
    const result = await response.json().catch(() => ({}));
    if (response.status === 429 && attempt === 0) {
      const wait = Math.min(30, Number(response.headers.get("retry-after") || 5));
      await new Promise((resolve) => setTimeout(resolve, wait * 1000));
      continue;
    }
    if (!response.ok)
      return { status: "error", emails: [], error: result.message || "Search failed." };
    return {
      status: result.status,
      emails: result.emails ?? [],
      contacts: result.contacts ?? [],
      error: result.message,
    };
  }
  return { status: "error", emails: [], error: "Busy. Try again shortly." };
}

// Keep a bounded pool while searching more authors in parallel.
const CONCURRENCY = 10;

/** Email search state for a list of authors: one-off searches plus a bulk
 *  run with a small worker pool, progress counts and stop. */
export function useEmailSearch() {
  const [state, setState] = useState<Record<string, EmailSearch>>({});
  const [run, setRun] = useState<{ ids: string[]; startedAt: number } | null>(null);
  const stopRef = useRef(false);
  const [lastRunId, setLastRunId] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [runError, setRunError] = useState("");
  const creating = useRef(false);
  const runIdRef = useRef("");
  const set = (id: string, value: EmailSearch) =>
    setState((current) => ({ ...current, [id]: value }));

  const findOne = useCallback(async (authorId: string, bookId: string) => {
    set(authorId, { status: "searching", emails: [] });
    set(authorId, await searchOne(authorId, bookId));
  }, []);

  const findAll = useCallback(
    async (targets: { authorId: string; bookId: string }[], retry = false) => {
      if (!targets.length || creating.current) return;
      creating.current = true;
      setRunError("");
      let runId: string;
      try {
        const response = await fetch("/api/admin/scout-email-runs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "create", targets }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Could not start search run.");
        runId = data.run.id;
        runIdRef.current = runId;
        setLastRunId(runId);
      } catch (error) {
        setRunError(error instanceof Error ? error.message : "Could not start search run.");
        creating.current = false;
        return;
      }

      stopRef.current = false;
      setState((current) => {
        const next = { ...current };
        for (const t of targets) next[t.authorId] = { status: "queued", emails: [] };
        return next;
      });
      setRun({ ids: targets.map((t) => t.authorId), startedAt: Date.now() });
      const queue = [...targets];
      const worker = async () => {
        while (queue.length && !stopRef.current) {
          const t = queue.shift()!;
          set(t.authorId, { status: "searching", emails: [] });
          set(t.authorId, await searchOne(t.authorId, t.bookId, retry, runId));
          setRevision((r) => r + 1);
        }
      };
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, worker));
      // Anything still queued after Stop goes back to idle.
      setState((current) => {
        const next = { ...current };
        for (const t of targets) if (next[t.authorId]?.status === "queued") delete next[t.authorId];
        return next;
      });
      setRun(null);
      if (!stopRef.current)
        void fetch("/api/admin/scout-email-runs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "complete", id: runId }),
        });
      creating.current = false;
      setRevision((r) => r + 1);
    },
    [],
  );

  return {
    state,
    lastRunId,
    revision,
    runError,
    run: run && { total: run.ids.length, startedAt: run.startedAt },
    runResults: run
      ? run.ids.map((id) => state[id] ?? { status: "idle" as const, emails: [] })
      : [],
    findOne,
    findAll,
    stop: () => {
      stopRef.current = true;
      if (runIdRef.current)
        void fetch("/api/admin/scout-email-runs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "stop", id: runIdRef.current }),
        });
    },
  };
}

/** Live progress for a bulk run. */
export function EmailSearchProgress({
  run,
  results,
  onStop,
}: {
  run: { total: number; startedAt: number };
  results: EmailSearch[];
  onStop: () => void;
}) {
  const found = results.filter((r) => r.status === "found").length;
  const none = results.filter((r) => r.status === "not_found").length;
  const failed = results.filter((r) => r.status === "error").length;
  const searching = results.filter((r) => r.status === "searching").length;
  const paused = results.filter((r) => r.status === "paused").length;
  const done = found + none + failed + paused;
  const elapsed = (Date.now() - run.startedAt) / 1000;
  const eta = done ? Math.round(((elapsed / done) * (run.total - done)) / 60) : null;
  return (
    <div
      role="status"
      className="rounded-2xl border border-brand/40 bg-brand/5 p-4 text-sm"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 font-semibold">
          <Loader2 className="size-4 animate-spin text-brand" />
          Finding author emails · {done} of {run.total}
        </p>
        <button
          onClick={onStop}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs"
        >
          <Square className="size-3" /> Stop
        </button>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-brand transition-all duration-500"
          style={{ width: `${(done / run.total) * 100}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        <span className="text-emerald-500">{found} found</span> · {none} no email
        {paused ? ` · ${paused} paused` : ""}
        {failed ? ` · ${failed} failed` : ""} · {searching} searching now
        {eta !== null && done < run.total ? ` · about ${Math.max(1, eta)} min left` : ""}
      </p>
    </div>
  );
}

export function AuthorContactSearch({
  search,
  onFind,
  primaryEmail,
  primaryCheck,
}: {
  search: EmailSearch;
  onFind: () => void;
  /** The author's main contact email; its automatic check badge is shown. */
  primaryEmail?: string | null | undefined;
  primaryCheck?: EmailCheck | undefined;
}) {
  const [copied, setCopied] = useState("");
  return (
    <div className="mt-4 rounded-xl border border-border p-3 text-sm">
      {search.status === "found" ? (
        <div className="space-y-1.5">
          <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-500">
            <MailCheck className="size-3.5" />
            {search.emails.length > 1
              ? `${search.emails.length} public contact emails`
              : "Public contact email"}
          </p>
          {search.emails.map((email) => (
            <button
              key={email}
              type="button"
              title="Copy email"
              onClick={() =>
                void navigator.clipboard.writeText(email).then(() => {
                  setCopied(email);
                  setTimeout(() => setCopied(""), 1500);
                })
              }
              className="flex w-full items-center justify-between gap-2 break-all rounded-lg bg-secondary/50 px-3 py-2 text-left font-medium"
            >
              <span className="flex flex-wrap items-center gap-2">
                {email}
                <span className="text-xs font-normal text-muted-foreground">
                  {(() => {
                    const c = search.contacts?.find((c) => c.email === email);
                    return c
                      ? `${c.role} · ${c.verified ? "source verified" : "needs review"}`
                      : "Legacy result · needs review";
                  })()}
                </span>
                {primaryEmail?.toLowerCase() === email.toLowerCase() && primaryCheck && (
                  <EmailCheckBadge {...primaryCheck} />
                )}
              </span>
              <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                <Copy className="size-3" /> {copied === email ? "Copied" : "Copy"}
              </span>
            </button>
          ))}
        </div>
      ) : search.status === "paused" ? (
        <p>
          Search paused. {search.emails.length} saved candidates. Start a new run to continue;
          completed passes are reused.
        </p>
      ) : search.status === "not_found" ? (
        <p className="flex items-center gap-1.5 font-medium text-muted-foreground">
          <MailX className="size-4" /> No Author Email Found
        </p>
      ) : search.status === "searching" ? (
        <p className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-brand" />
          Searching website, Google and social pages…
        </p>
      ) : search.status === "queued" ? (
        <p className="flex items-center gap-2 text-muted-foreground">
          <span className="size-2 animate-pulse rounded-full bg-brand" /> Queued for email search
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onFind}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 font-medium"
          >
            <Search className="size-3.5" />
            {search.status === "error" ? "Try again" : "Find author email"}
          </button>
          {search.error && (
            <span role="alert" className="text-xs text-destructive">
              {search.error}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
