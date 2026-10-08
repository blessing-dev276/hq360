import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUpRight, GraduationCap, Search, Trash2, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Person = {
  id: string;
  name: string | null;
  email: string | null;
  role: "trainer" | "trainee";
  joinedAt: string;
  expert: boolean;
  trainerId: string | null;
  trainerName: string | null;
  assignedAt: string | null;
  trainees: number;
  sessions: number;
  lastActive: string | null;
  averageScore: number | null;
};
type Chat = {
  id: string;
  created_at: string;
  ended: boolean;
  difficulty: string;
  mode: string;
  persona: { name: string; book: string };
  messages: { role: string; text: string }[];
  coaching: { overall: number; outcome: string; summary: string } | null;
};

const card = "rounded-2xl border border-border bg-card";
const btn =
  "inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium transition hover:bg-secondary disabled:opacity-50";
const date = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "-";

async function call<T>(method: string, url: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  return { ok: res.ok, data };
}

/** Admin: every Academy trainee and trainer; manage, reassign, delete. */
export function AcademyPeopleAdmin() {
  const [people, setPeople] = useState<Person[] | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState<"all" | "trainee" | "trainer">("all");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState("");
  const [viewing, setViewing] = useState<Person | null>(null);
  const [deleting, setDeleting] = useState<Person | null>(null);

  const load = useCallback(async () => {
    const { ok, data } = await call<{ people: Person[] }>("GET", "/api/admin/academy");
    if (ok) setPeople(data.people);
    else setError(data.error ?? "Could not load the Academy.");
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const trainers = useMemo(() => (people ?? []).filter((p) => p.role === "trainer"), [people]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (people ?? []).filter(
      (p) =>
        (filter === "all" || p.role === filter) &&
        (!q || `${p.name ?? ""} ${p.email ?? ""}`.toLowerCase().includes(q)),
    );
  }, [people, filter, query]);

  async function patch(person: Person, body: object, success: string) {
    setBusy(person.id);
    setNotice("");
    const { ok, data } = await call("PATCH", "/api/admin/academy", { id: person.id, ...body });
    setBusy("");
    setNotice(ok ? success : (data.error ?? "Something went wrong."));
    if (ok) await load();
  }

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!people) return <p className="text-sm text-muted-foreground">Loading the Academy...</p>;
  const label = (p: Person) => p.name || p.email || "Unnamed";
  const traineeCount = people.length - trainers.length;
  const sessions = people.reduce((n, p) => n + p.sessions, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["Trainees", traineeCount],
          ["Trainers", trainers.length],
          ["Practice chats", sessions],
          [
            "Unassigned trainees",
            people.filter((p) => p.role === "trainee" && !p.trainerId).length,
          ],
        ].map(([k, v]) => (
          <div key={k} className={cn(card, "p-5")}>
            <p className="text-xs text-muted-foreground">{k}</p>
            <p className="mt-1 font-display text-3xl">{v}</p>
          </div>
        ))}
      </div>

      <div className={cn(card, "p-4 sm:p-5")}>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div role="tablist" aria-label="Show" className="flex rounded-full bg-secondary p-1">
            {(
              [
                ["all", "Everyone"],
                ["trainee", "Trainees"],
                ["trainer", "Trainers"],
              ] as const
            ).map(([id, text]) => (
              <button
                key={id}
                role="tab"
                aria-selected={filter === id}
                onClick={() => setFilter(id)}
                className={cn(
                  "rounded-full px-4 py-1.5 text-sm",
                  filter === id ? "bg-background font-semibold shadow-sm" : "text-muted-foreground",
                )}
              >
                {text}
              </button>
            ))}
          </div>
          <label className="relative min-w-52 flex-1">
            <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 opacity-50" />
            <input
              aria-label="Search people"
              placeholder="Search name or email"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-full border border-border bg-background py-2 pr-3 pl-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <a href="/academy" target="_blank" rel="noreferrer" className={btn}>
            Open Academy <ArrowUpRight size={14} />
          </a>
        </div>
        {notice && (
          <p role="status" className="mb-3 text-sm">
            {notice}
          </p>
        )}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-2 pr-3 font-medium">Person</th>
                <th className="py-2 pr-3 font-medium">Role</th>
                <th className="py-2 pr-3 font-medium">Trainer / trainees</th>
                <th className="py-2 pr-3 font-medium">Chats</th>
                <th className="py-2 pr-3 font-medium">Avg score</th>
                <th className="py-2 pr-3 font-medium">Joined</th>
                <th className="py-2 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.id} className="border-b border-border/60 align-middle">
                  <td className="py-3 pr-3">
                    <p className="font-medium">{p.name || "Unnamed"}</p>
                    <p className="text-xs text-muted-foreground">{p.email}</p>
                  </td>
                  <td className="py-3 pr-3">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-xs font-medium",
                        p.role === "trainer"
                          ? "bg-primary/15 text-primary"
                          : "bg-secondary text-muted-foreground",
                      )}
                    >
                      {p.role === "trainer" ? "Trainer" : "Trainee"}
                    </span>
                    {p.expert && (
                      <span className="ml-1.5 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                        Expert
                      </span>
                    )}
                  </td>
                  <td className="py-3 pr-3">
                    {p.role === "trainer" ? (
                      <span className="text-muted-foreground">
                        {p.trainees} trainee{p.trainees === 1 ? "" : "s"}
                      </span>
                    ) : (
                      <select
                        aria-label={`Trainer for ${label(p)}`}
                        value={p.trainerId ?? ""}
                        disabled={busy === p.id}
                        onChange={(e) => {
                          const id = e.target.value || null;
                          const to = trainers.find((t) => t.id === id);
                          void patch(
                            p,
                            { trainerId: id },
                            to
                              ? `${label(p)} now trains with ${label(to)}.`
                              : `${label(p)} will get a random trainer next time they sign in.`,
                          );
                        }}
                        className="max-w-48 rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                      >
                        <option value="">Unassigned (random draw)</option>
                        {trainers.map((t) => (
                          <option key={t.id} value={t.id}>
                            {label(t)}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="py-3 pr-3">{p.sessions}</td>
                  <td className="py-3 pr-3">{p.averageScore ?? "-"}</td>
                  <td className="py-3 pr-3 text-muted-foreground">{date(p.joinedAt)}</td>
                  <td className="py-3">
                    <div className="flex justify-end gap-1.5">
                      <button className={btn} onClick={() => setViewing(p)} disabled={!p.sessions}>
                        Chats
                      </button>
                      <button
                        className={btn}
                        disabled={busy === p.id}
                        onClick={() =>
                          void patch(
                            p,
                            { role: p.role === "trainer" ? "trainee" : "trainer" },
                            p.role === "trainer"
                              ? `${label(p)} is now a trainee. Their trainees will be redrawn.`
                              : `${label(p)} is now a trainer.`,
                          )
                        }
                      >
                        <GraduationCap size={13} />
                        {p.role === "trainer" ? "Remove trainer" : "Make trainer"}
                      </button>
                      <button
                        className={cn(btn, "text-destructive hover:bg-destructive/10")}
                        onClick={() => setDeleting(p)}
                        aria-label={`Delete ${label(p)}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!shown.length && (
            <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Users size={16} /> Nobody here yet.
            </p>
          )}
        </div>
      </div>

      {viewing && <ChatsDrawer person={viewing} onClose={() => setViewing(null)} />}
      {deleting && (
        <DeleteDialog
          person={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={async (msg) => {
            setDeleting(null);
            setNotice(msg);
            await load();
          }}
        />
      )}
    </div>
  );
}

function ChatsDrawer({ person, onClose }: { person: Person; onClose: () => void }) {
  const [chats, setChats] = useState<Chat[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    void call<{ sessions: Chat[] }>(
      "GET",
      `/api/academy/sessions?user=${encodeURIComponent(person.id)}`,
    ).then(({ data }) => setChats(data.sessions ?? []));
  }, [person.id]);
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`${person.name || person.email}'s chats`}
        className="h-full w-full max-w-xl overflow-y-auto bg-background p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Practice chats</p>
            <h3 className="font-display text-2xl">{person.name || person.email}</h3>
          </div>
          <button className={btn} onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </div>
        {chats === null ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : (
          <div className="space-y-3">
            {chats.map((c) => (
              <div key={c.id} className={cn(card, "p-4")}>
                <button
                  className="flex w-full items-center justify-between gap-3 text-left"
                  onClick={() => setOpen(open === c.id ? null : c.id)}
                  aria-expanded={open === c.id}
                >
                  <span>
                    <span className="font-medium">{c.persona.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {" "}
                      · {c.difficulty} · {date(c.created_at)}
                    </span>
                  </span>
                  <span className="text-sm">
                    {c.coaching ? (
                      <>
                        <b>{c.coaching.overall}</b>/100 · {c.coaching.outcome}
                      </>
                    ) : (
                      <span className="text-muted-foreground">
                        {c.ended ? "Ended" : "In progress"}
                      </span>
                    )}
                  </span>
                </button>
                {open === c.id && (
                  <div className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
                    {c.coaching?.summary && (
                      <p className="rounded-xl bg-secondary p-3">{c.coaching.summary}</p>
                    )}
                    {c.messages
                      .filter((m) => m.role !== "sys")
                      .map((m, i) => (
                        <p
                          key={i}
                          className={cn(
                            "max-w-[85%] rounded-2xl px-3 py-2 whitespace-pre-line",
                            m.role === "scout"
                              ? "ml-auto bg-primary text-primary-foreground"
                              : "bg-secondary",
                          )}
                        >
                          {m.text}
                        </p>
                      ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}

function DeleteDialog({
  person,
  onClose,
  onDeleted,
}: {
  person: Person;
  onClose: () => void;
  onDeleted: (message: string) => void | Promise<void>;
}) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const who = person.name || person.email || "this person";
  async function remove() {
    setBusy(true);
    setError("");
    const { ok, data } = await call<{ removed?: string }>(
      "DELETE",
      `/api/admin/academy?id=${encodeURIComponent(person.id)}`,
    );
    setBusy(false);
    if (!ok) return setError(data.error ?? "Could not delete.");
    await onDeleted(
      data.removed === "academy"
        ? `${who}'s Academy data is gone. Their expert account stays.`
        : `${who} has been deleted. They can sign up again any time.`,
    );
  }
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="academy-delete-title"
        className={cn(card, "w-full max-w-md p-6")}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="academy-delete-title" className="font-display text-xl">
          Delete {who}?
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {person.expert
            ? "This removes their Academy profile, trainer badge, chats, scores and saved AI key. Their HQ360 expert account is not touched."
            : "This permanently deletes their Academy account, chats, scores and coaching. Nothing can be recovered. They can register again with the same email."}
          {person.role === "trainer" && person.trainees > 0
            ? ` Their ${person.trainees} trainee${person.trainees === 1 ? "" : "s"} will get a new random trainer on next sign in.`
            : ""}
        </p>
        <label className="mt-4 block text-sm">
          Type <b>DELETE</b> to confirm
          <input
            autoFocus
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2"
          />
        </label>
        {error && (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button className={btn} onClick={onClose}>
            Cancel
          </button>
          <button
            className="inline-flex items-center gap-1.5 rounded-full bg-destructive px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            disabled={typed !== "DELETE" || busy}
            onClick={() => void remove()}
          >
            <Trash2 size={13} /> {busy ? "Deleting..." : "Delete forever"}
          </button>
        </div>
      </div>
    </div>
  );
}
