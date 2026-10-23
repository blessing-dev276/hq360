import { useEffect, useRef, useState } from "react";
import { CircleAlert, CircleCheck, Loader2, Mail, Send, Square } from "lucide-react";

// An AI Assistant outreach campaign, run in the browser with the same
// endpoints as Scouting and Author Outreach: scout a Reedsy genre into a new
// batch, find each author's email, draft one email per author from the
// admin's own prompt, then wait for the admin to review and press Send.
// Progress is saved per campaign so reopening the chat never re-runs it.

export type CampaignSpec = {
  id: string;
  genre: string;
  count: number;
  prompt: string;
  senderName: string;
};
type Row = {
  authorId: string;
  bookId: string;
  name: string;
  title: string;
  genre: string;
  description: string;
  sourceUrl: string;
  email: string;
  emailStatus: "pending" | "searching" | "found" | "none" | "error";
  subject: string;
  content: string;
  draftStatus: "pending" | "drafting" | "done" | "error";
  selected: boolean;
  requestId: string;
  sendStatus: "idle" | "sending" | "sent" | "failed";
  note: string;
};
type Phase = "setup" | "scouting" | "emails" | "drafting" | "review" | "done";
type State = {
  phase: Phase;
  prompt: string;
  senderName: string;
  batchId: string;
  batchLabel: string;
  saved: number;
  rows: Row[];
  message: string;
  error: string;
};

const PROMPT_STORE = "hq360-outreach-prompt";
const SENDER_STORE = "hq360-outreach-sender";
const key = (id: string) => `hq360-campaign-${id}`;
function read<T>(k: string): T | null {
  try {
    const raw = localStorage.getItem(k);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function write(k: string, value: unknown) {
  try {
    localStorage.setItem(k, typeof value === "string" ? value : JSON.stringify(value));
  } catch {
    // Storage blocked: the campaign still runs for this visit.
  }
}
function readText(k: string) {
  try {
    return localStorage.getItem(k) ?? "";
  } catch {
    return "";
  }
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false)
    throw new Error(data.error || data.message || `Request failed (${response.status})`);
  return data as T;
}
async function get<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) throw new Error(data.error || "Request failed");
  return data as T;
}
/** Runs fn over items with a small worker pool. */
async function pool<T>(
  items: T[],
  size: number,
  fn: (item: T) => Promise<void>,
  stop: () => boolean,
) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length && !stop()) await fn(items[next++]!);
    }),
  );
}

type Genre = { id: number; name: string };
function matchGenre(genres: Genre[], wanted: string) {
  const w = wanted.trim().toLowerCase();
  return (
    genres.find((g) => g.name.toLowerCase() === w) ??
    genres.find((g) => g.name.toLowerCase().includes(w)) ??
    genres.find((g) => w.includes(g.name.toLowerCase()))
  );
}

export function OutreachCampaign({
  spec,
  pastedPrompt = "",
}: {
  spec: CampaignSpec;
  /** The latest long message the admin pasted in the chat, used as the prompt. */
  pastedPrompt?: string;
}) {
  const [state, setState] = useState<State>(() => ({
    phase: "setup",
    prompt: spec.prompt,
    senderName: spec.senderName,
    batchId: "",
    batchLabel: "",
    saved: 0,
    rows: [],
    message: "",
    error: "",
  }));
  const live = useRef(state);
  const stopped = useRef(false);
  const [running, setRunning] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    const saved = read<State>(key(spec.id));
    const next = saved
      ? {
          ...saved,
          rows: saved.rows.map((r) =>
            r.sendStatus === "sending" ? { ...r, sendStatus: "idle" as const } : r,
          ),
        }
      : {
          ...live.current,
          prompt: spec.prompt || pastedPrompt || readText(PROMPT_STORE),
          senderName: spec.senderName || readText(SENDER_STORE) || "HQ360",
        };
    live.current = next;
    setState(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec]);

  function update(patch: Partial<State> | ((s: State) => Partial<State>)) {
    const next = {
      ...live.current,
      ...(typeof patch === "function" ? patch(live.current) : patch),
    };
    live.current = next;
    setState(next);
    write(key(spec.id), next);
  }
  function setRow(authorId: string, patch: Partial<Row>) {
    update((s) => ({
      rows: s.rows.map((r) => (r.authorId === authorId ? { ...r, ...patch } : r)),
    }));
  }

  async function scout() {
    update({ phase: "scouting", message: "Finding the genre on Reedsy Discovery…", error: "" });
    const { genres } = await get<{ genres: Genre[] }>("/api/admin/scout-reedsy-genres");
    const genre = matchGenre(genres, spec.genre);
    if (!genre)
      throw new Error(
        `No Reedsy genre matches "${spec.genre}". Try one of: ${genres
          .slice(0, 12)
          .map((g) => g.name)
          .join(", ")}…`,
      );
    const label = `AI campaign: ${genre.name} (${new Date().toISOString().slice(0, 10)})`;
    let batchId = live.current.batchId;
    let saved = live.current.saved;
    let page: number | null = 1;
    for (let round = 0; round < 12 && page && saved < spec.count && !stopped.current; round++) {
      update({ message: `Searching ${genre.name}, page ${page}… (${saved}/${spec.count} saved)` });
      const data: {
        items: {
          title: string;
          authorName: string | null;
          sourceUrl: string;
          overview: string | null;
          verdictRating: number | null;
          qualified: boolean;
        }[];
        nextPage: number | null;
      } = await post("/api/admin/scout-reedsy-search", {
        genreId: genre.id,
        genreName: genre.name,
        limit: Math.min(100, spec.count - saved),
        page,
      });
      page = data.nextPage;
      const found = data.items.filter((i) => i.qualified && i.authorName);
      if (found.length && !batchId) {
        const { item } = await post<{ item: { id: string } }>("/api/admin/scout-batches", {
          label,
          source: "reedsy_discovery",
          genre: genre.name,
          requestedMax: spec.count,
        });
        batchId = item.id;
        update({ batchId, batchLabel: label });
      }
      await pool(
        found,
        4,
        async (item) => {
          if (saved >= spec.count) return;
          const result = await post<{ duplicate?: boolean }>("/api/admin/scout-manual-ingest", {
            sourceSlug: "reedsy_discovery",
            sourceUrl: item.sourceUrl,
            bookUrl: item.sourceUrl,
            authorName: item.authorName,
            bookTitle: item.title,
            genre: genre.name,
            description: item.overview?.slice(0, 4000),
            batchId,
            batchLabel: label,
            ...(item.verdictRating == null
              ? {}
              : { reviewPlatform: "reedsy", reviewRating: item.verdictRating }),
          });
          if (!result.duplicate) saved++;
          update({ saved, message: `Saving new authors… (${saved}/${spec.count})` });
        },
        () => stopped.current,
      );
    }
    if (!batchId || saved === 0)
      throw new Error(`No new ${genre.name} authors were found. Try another genre.`);
    type Item = {
      id: string;
      title: string;
      genre: string | null;
      description: string | null;
      source_url: string | null;
      scout_authors: { id: string; name: string; contact_email: string | null } | null;
    };
    const { items } = await get<{ items: Item[] }>(`/api/admin/scout-batches/${batchId}`);
    const rows: Row[] = items
      .filter((b) => b.scout_authors)
      .map((b) => ({
        authorId: b.scout_authors!.id,
        bookId: b.id,
        name: b.scout_authors!.name,
        title: b.title,
        genre: b.genre ?? genre.name,
        description: b.description ?? "",
        sourceUrl: b.source_url ?? "",
        email: b.scout_authors!.contact_email ?? "",
        emailStatus: b.scout_authors!.contact_email ? "found" : "pending",
        subject: "",
        content: "",
        draftStatus: "pending",
        selected: true,
        requestId: crypto.randomUUID(),
        sendStatus: "idle",
        note: "",
      }));
    update({ rows, phase: "emails", message: `${rows.length} authors saved to "${label}".` });
  }

  async function findEmails() {
    update({ phase: "emails", error: "" });
    const todo = live.current.rows.filter(
      (r) => r.emailStatus === "pending" || r.emailStatus === "error",
    );
    let n = 0;
    await pool(
      todo,
      3,
      async (row) => {
        setRow(row.authorId, { emailStatus: "searching" });
        try {
          const r = await post<{ emails?: string[] }>(
            `/api/admin/scout-authors/${row.authorId}/find-contact`,
            {
              bookId: row.bookId,
            },
          );
          const email = r.emails?.[0] ?? "";
          setRow(row.authorId, { email, emailStatus: email ? "found" : "none", selected: !!email });
        } catch (e) {
          setRow(row.authorId, {
            emailStatus: "error",
            note: (e as Error).message,
            selected: false,
          });
        }
        update({ message: `Finding emails… (${++n}/${todo.length})` });
      },
      () => stopped.current,
    );
  }

  async function draftAll() {
    const { prompt } = live.current;
    update({ phase: "drafting", error: "" });
    const todo = live.current.rows.filter((r) => r.email && r.draftStatus !== "done");
    let n = 0;
    await pool(
      todo,
      3,
      async (row) => {
        setRow(row.authorId, { draftStatus: "drafting" });
        try {
          const d = await post<{ subject: string; content: string }>("/api/admin/outreach-draft", {
            prompt,
            author: {
              name: row.name,
              bookTitle: row.title,
              genre: row.genre,
              ...(row.description ? { description: row.description.slice(0, 4000) } : {}),
              ...(row.sourceUrl ? { sourceUrl: row.sourceUrl } : {}),
            },
          });
          setRow(row.authorId, { ...d, draftStatus: "done" });
        } catch (e) {
          setRow(row.authorId, {
            draftStatus: "error",
            note: (e as Error).message,
            selected: false,
          });
        }
        update({ message: `Writing personalised emails… (${++n}/${todo.length})` });
      },
      () => stopped.current,
    );
  }

  async function run() {
    const { prompt, senderName } = live.current;
    if (prompt.trim().length < 10) return update({ error: "Paste your outreach prompt first." });
    if (!senderName.trim()) return update({ error: "Add the name to sign the emails with." });
    write(PROMPT_STORE, prompt);
    write(SENDER_STORE, senderName);
    stopped.current = false;
    setRunning(true);
    try {
      if (!live.current.rows.length) await scout();
      if (!stopped.current) await findEmails();
      if (!stopped.current) await draftAll();
      if (!stopped.current)
        update((s) => ({
          phase: "review",
          message: `${s.rows.filter((r) => r.draftStatus === "done").length} emails ready for your review.`,
        }));
    } catch (e) {
      update({ error: (e as Error).message });
    } finally {
      setRunning(false);
    }
  }

  async function sendSelected() {
    const ready = live.current.rows.filter(
      (r) => r.selected && r.email && r.draftStatus === "done" && r.sendStatus !== "sent",
    );
    if (!ready.length) return;
    if (
      !window.confirm(
        `Send ${ready.length} personalised email${ready.length === 1 ? "" : "s"} now? This can't be undone.`,
      )
    )
      return;
    setRunning(true);
    for (const row of ready) {
      setRow(row.authorId, { sendStatus: "sending" });
      try {
        await post("/api/admin/author-email", {
          to: row.email,
          subject: row.subject,
          content: row.content,
          senderName: live.current.senderName,
          requestId: row.requestId,
          isTest: false,
        });
        setRow(row.authorId, { sendStatus: "sent", note: "" });
      } catch (e) {
        setRow(row.authorId, { sendStatus: "failed", note: (e as Error).message });
      }
    }
    setRunning(false);
    update((s) => ({
      phase: s.rows.every((r) => !r.selected || r.sendStatus === "sent") ? "done" : "review",
      message: `${s.rows.filter((r) => r.sendStatus === "sent").length} sent. They're in Author Outreach history.`,
    }));
  }

  const { phase, rows } = state;
  const withEmail = rows.filter((r) => r.email).length;
  const ready = rows.filter(
    (r) => r.selected && r.draftStatus === "done" && r.sendStatus !== "sent",
  ).length;
  const sent = rows.filter((r) => r.sendStatus === "sent").length;
  const steps: [Phase, string][] = [
    ["scouting", `Scout ${spec.count} authors`],
    ["emails", "Find emails"],
    ["drafting", "Write emails"],
    ["review", "Review & send"],
  ];
  const order: Phase[] = ["setup", "scouting", "emails", "drafting", "review", "done"];

  return (
    <div className="oc">
      <div className="oc-head">
        <Mail size={15} aria-hidden="true" />
        <strong>
          Outreach campaign · {spec.count} {spec.genre} authors
        </strong>
      </div>
      <ol className="oc-steps">
        {steps.map(([p, label]) => (
          <li
            key={p}
            className={order.indexOf(phase) > order.indexOf(p) ? "done" : phase === p ? "now" : ""}
          >
            {label}
          </li>
        ))}
      </ol>

      {phase === "setup" && (
        <div className="oc-setup">
          <label>
            <span>Your outreach prompt</span>
            <textarea
              rows={6}
              value={state.prompt}
              onChange={(e) => update({ prompt: e.target.value })}
              placeholder="Paste the prompt you use to write personalised author emails…"
              maxLength={20000}
            />
          </label>
          <label>
            <span>Sign emails as</span>
            <input
              value={state.senderName}
              onChange={(e) => update({ senderName: e.target.value })}
              maxLength={100}
            />
          </label>
          <small className="settings-muted">
            Your prompt is remembered on this device for next time. Email research and drafting use
            your Perplexity key. Nothing is sent until you approve it.
          </small>
        </div>
      )}

      {(state.message || state.error) && (
        <p className={`oc-status${state.error ? " oc-error" : ""}`} role="status">
          {running && !state.error && <Loader2 size={13} className="oc-spin" aria-hidden="true" />}
          {state.error || state.message}
        </p>
      )}

      {rows.length > 0 && (
        <ul className="oc-rows">
          {rows.map((r) => (
            <li key={r.authorId} className={open === r.authorId ? "open" : ""}>
              <div className="oc-row">
                <input
                  type="checkbox"
                  aria-label={`Include ${r.name}`}
                  checked={r.selected}
                  disabled={!r.email || r.draftStatus !== "done" || r.sendStatus === "sent"}
                  onChange={(e) => setRow(r.authorId, { selected: e.target.checked })}
                />
                <button
                  type="button"
                  className="oc-who"
                  onClick={() => setOpen(open === r.authorId ? null : r.authorId)}
                >
                  <strong>{r.name}</strong>
                  <small>
                    {r.title} ·{" "}
                    {r.emailStatus === "searching"
                      ? "finding email…"
                      : r.email ||
                        (r.emailStatus === "pending" ? "email not searched yet" : "no email found")}
                  </small>
                </button>
                <span className="oc-badge">
                  {r.sendStatus === "sent" ? (
                    <CircleCheck size={14} aria-label="Sent" />
                  ) : r.sendStatus === "failed" ||
                    r.draftStatus === "error" ||
                    r.emailStatus === "error" ? (
                    <CircleAlert size={14} aria-label="Problem" />
                  ) : r.sendStatus === "sending" ||
                    r.draftStatus === "drafting" ||
                    r.emailStatus === "searching" ? (
                    <Loader2 size={14} className="oc-spin" aria-label="Working" />
                  ) : r.draftStatus === "done" ? (
                    "Draft"
                  ) : null}
                </span>
              </div>
              {r.note && <small className="oc-note">{r.note}</small>}
              {open === r.authorId && r.draftStatus === "done" && (
                <div className="oc-draft">
                  <input
                    value={r.subject}
                    aria-label="Subject"
                    disabled={r.sendStatus === "sent"}
                    onChange={(e) =>
                      setRow(r.authorId, { subject: e.target.value.replace(/[\r\n]/g, " ") })
                    }
                  />
                  <textarea
                    rows={10}
                    value={r.content}
                    aria-label="Email"
                    disabled={r.sendStatus === "sent"}
                    onChange={(e) => setRow(r.authorId, { content: e.target.value })}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="oc-actions">
        {running && phase !== "review" ? (
          <button type="button" className="admin-button" onClick={() => (stopped.current = true)}>
            <Square size={13} aria-hidden="true" /> Stop
          </button>
        ) : phase === "review" || phase === "done" ? (
          <>
            <button
              type="button"
              className="admin-button admin-button-primary"
              disabled={running || !ready}
              onClick={() => void sendSelected()}
            >
              <Send size={13} aria-hidden="true" /> Send {ready} email{ready === 1 ? "" : "s"}
            </button>
            <small className="settings-muted">
              {withEmail} of {rows.length} have an email · {sent} sent · tap an author to read or
              edit
            </small>
          </>
        ) : (
          <button
            type="button"
            className="admin-button admin-button-primary"
            onClick={() => void run()}
          >
            {phase === "setup" ? "Start campaign" : "Resume"}
          </button>
        )}
      </div>
    </div>
  );
}
