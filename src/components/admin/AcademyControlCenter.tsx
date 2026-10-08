import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  BookOpenText,
  Bot,
  KeyRound,
  LayoutDashboard,
  MessagesSquare,
  RefreshCw,
  Search,
  Settings2,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { AcademyPeopleAdmin } from "./AcademyPeopleAdmin";
import { TrainerTools } from "@/components/academy/TrainerTools";
import type { Fetcher } from "@/components/academy/Library";
import "@/components/academy/academy.css";

type Section = "overview" | "people" | "chats" | "ai" | "content" | "settings";
const SECTIONS: [Section, string, typeof Users][] = [
  ["overview", "Overview", LayoutDashboard],
  ["people", "People", Users],
  ["chats", "Chats", MessagesSquare],
  ["ai", "AI & API", Bot],
  ["content", "Content", BookOpenText],
  ["settings", "Settings", Settings2],
];

const API = "/api/admin/academy-control";
async function call<T>(method: string, url: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}
/** Trainer tools in /admin run on the admin passphrase cookie. */
const cookieFetcher: Fetcher = async (url, init) => {
  const res = await fetch(url, {
    method: init?.method ?? "GET",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    ...(init?.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};

const usd = (n: number) => (n < 0.01 && n > 0 ? "<$0.01" : `$${n.toFixed(2)}`);
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
const LEVEL_TONE: Record<string, string> = {
  easy: "paid",
  medium: "pending",
  hard: "overdue",
  extreme: "overdue",
};

function Stat({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="admin-stat">
      <div>{label}</div>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </div>
  );
}

/** Admin: monitor and manage the whole Author Scout Academy in one place. */
export function AcademyControlCenter() {
  const [section, setSection] = useState<Section>("overview");
  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div className="admin-segmented" style={{ alignSelf: "start", flexWrap: "wrap" }}>
        {SECTIONS.map(([id, label, Icon]) => (
          <button
            key={id}
            className={section === id ? "active" : ""}
            onClick={() => setSection(id)}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>
      {section === "overview" && <Overview />}
      {section === "people" && <AcademyPeopleAdmin />}
      {section === "chats" && <Chats />}
      {section === "ai" && <AiUsage />}
      {section === "content" && (
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <h2>Practice content</h2>
              <p>
                Author reply lines, hints, coaching feedback and weak spots: everything the Practice
                Room says.
              </p>
            </div>
          </div>
          <div className="asa" style={{ background: "transparent", minHeight: 0 }}>
            <TrainerTools fetcher={cookieFetcher} />
          </div>
        </section>
      )}
      {section === "settings" && <SettingsPanel />}
    </div>
  );
}

function useLoad<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(() => {
    setError("");
    call<T>("GET", url)
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, [url]);
  useEffect(load, [load]);
  return { data, error, reload: load };
}

type OverviewData = {
  people: { total: number; trainers: number; trainees: number; new7: number; active7: number };
  chats: {
    total: number;
    today: number;
    week: number;
    scored: number;
    avgScore: number | null;
    won: number;
  };
  difficulty: { level: string; chats: number; avgScore: number | null; winRate: number | null }[];
  authors: { name: string; chats: number; won: number }[];
};
function Overview() {
  const { data, error, reload } = useLoad<OverviewData>(`${API}?view=overview`);
  const ai = useLoad<AiData>(`${API}?view=ai`).data;
  if (error) return <div className="admin-alert">{error}</div>;
  if (!data) return <div className="admin-empty">Loading the Academy…</div>;
  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div
        className="admin-stats"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}
      >
        <Stat
          label="People"
          value={data.people.total}
          note={`${data.people.trainers} trainers · ${data.people.trainees} trainees`}
        />
        <Stat
          label="Active this week"
          value={data.people.active7}
          note={`${data.people.new7} joined this week`}
        />
        <Stat
          label="Practice chats"
          value={data.chats.total}
          note={`${data.chats.today} today · ${data.chats.week} this week`}
        />
        <Stat
          label="Average score"
          value={data.chats.avgScore ?? "–"}
          note={`${data.chats.won} won of ${data.chats.scored} scored`}
        />
        <Stat
          label="AI cost (30 days)"
          value={ai ? usd(ai.totals.cost) : "…"}
          note={ai ? `${ai.totals.ai} AI calls · ${ai.totals.fallback} fallbacks` : ""}
        />
      </div>
      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <h2>By difficulty</h2>
            <p>How trainees do at each level.</p>
          </div>
          <button className="admin-icon-button" aria-label="Refresh" onClick={reload}>
            <RefreshCw size={16} />
          </button>
        </div>
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Level</th>
                <th>Chats</th>
                <th>Average score</th>
                <th>Win rate</th>
              </tr>
            </thead>
            <tbody>
              {data.difficulty.map((d) => (
                <tr key={d.level}>
                  <td>
                    <span
                      className={`admin-status ${LEVEL_TONE[d.level]}`}
                      style={{ textTransform: "capitalize" }}
                    >
                      {d.level}
                    </span>
                  </td>
                  <td>{d.chats}</td>
                  <td>{d.avgScore ?? "–"}</td>
                  <td>
                    {d.winRate === null ? (
                      "–"
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div
                          style={{
                            width: 90,
                            height: 6,
                            borderRadius: 99,
                            background: "var(--secondary)",
                          }}
                        >
                          <div
                            style={{
                              width: `${d.winRate}%`,
                              height: "100%",
                              borderRadius: 99,
                              background: "var(--brand)",
                            }}
                          />
                        </div>
                        {d.winRate}%
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <h2>Demo authors</h2>
            <p>Which authors trainees practise with, and how often they win them over.</p>
          </div>
        </div>
        <div
          style={{
            display: "grid",
            gap: 8,
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          }}
        >
          {data.authors.map((a) => (
            <div key={a.name} className="admin-drawer-card" style={{ padding: 14 }}>
              <strong>{a.name}</strong>
              <p>
                {a.chats} chats · {a.won} won
                {a.chats ? ` (${Math.round((a.won / a.chats) * 100)}%)` : ""}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

type ChatRow = {
  id: string;
  user: string;
  author: string;
  difficulty: string;
  mode: string;
  ended: boolean;
  stage: string;
  score: number | null;
  outcome: string | null;
  messages: number;
  created_at: string;
};
function Chats() {
  const { data, error, reload } = useLoad<{ chats: ChatRow[] }>(`${API}?view=chats`);
  const [q, setQ] = useState("");
  const [level, setLevel] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const rows = useMemo(
    () =>
      (data?.chats ?? []).filter(
        (c) =>
          (level === "all" || c.difficulty === level) &&
          `${c.user} ${c.author}`.toLowerCase().includes(q.toLowerCase()),
      ),
    [data, q, level],
  );
  async function remove(id: string) {
    if (!window.confirm("Delete this chat for good?")) return;
    try {
      await call("DELETE", `${API}?chat=${encodeURIComponent(id)}`);
      setOpenId(null);
      setNotice("Chat deleted.");
      reload();
    } catch (e) {
      setNotice((e as Error).message);
    }
  }
  return (
    <section className="admin-panel">
      <div className="admin-panel-heading">
        <div>
          <h2>
            Every practice chat <span className="admin-count">{data?.chats.length ?? 0}</span>
          </h2>
          <p>All trainees, all trainers. Open any chat to read it in full.</p>
        </div>
        <button className="admin-icon-button" aria-label="Refresh" onClick={reload}>
          <RefreshCw size={16} />
        </button>
      </div>
      {notice && <div className="admin-notice">{notice}</div>}
      <div className="admin-table-toolbar">
        <div className="admin-filters">
          {["all", "easy", "medium", "hard", "extreme"].map((l) => (
            <button
              key={l}
              className={level === l ? "active" : ""}
              onClick={() => setLevel(l)}
              style={{ textTransform: "capitalize" }}
            >
              {l}
            </button>
          ))}
        </div>
        <label className="admin-search">
          <Search size={16} />
          <input
            placeholder="Search trainee or author…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
      </div>
      {error ? (
        <div className="admin-alert">{error}</div>
      ) : !data ? (
        <div className="admin-empty">Loading chats…</div>
      ) : (
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Trainee</th>
                <th>Author</th>
                <th>Level</th>
                <th>Result</th>
                <th>Messages</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} style={{ cursor: "pointer" }} onClick={() => setOpenId(c.id)}>
                  <td>{c.user}</td>
                  <td>
                    {c.author}
                    <small>{c.mode === "no" ? "They said no" : "Cold outreach"}</small>
                  </td>
                  <td>
                    <span
                      className={`admin-status ${LEVEL_TONE[c.difficulty]}`}
                      style={{ textTransform: "capitalize" }}
                    >
                      {c.difficulty}
                    </span>
                  </td>
                  <td>
                    {c.ended ? (
                      <>
                        <span
                          className={`admin-status ${c.outcome === "won" ? "paid" : c.outcome === "lost" ? "overdue" : "draft"}`}
                        >
                          {c.outcome ?? "ended"}
                        </span>
                        {c.score !== null && <small>{c.score}/100</small>}
                      </>
                    ) : (
                      <span className="admin-status pending">In progress · {c.stage}</span>
                    )}
                  </td>
                  <td>{c.messages}</td>
                  <td>{when(c.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {openId && (
        <ChatDrawer
          id={openId}
          onClose={() => setOpenId(null)}
          onDelete={() => void remove(openId)}
        />
      )}
    </section>
  );
}

type FullChat = {
  id: string;
  mood: string;
  challenge: string;
  difficulty: string;
  trust_history: number[];
  messages: { role: string; text: string; reaction?: string }[];
  coaching: { overall: number; outcome: string; summary: string; fixes?: string[] } | null;
  persona: { name: string; book: string; secret: string } | null;
  user: { name: string } | null;
};
function ChatDrawer({
  id,
  onClose,
  onDelete,
}: {
  id: string;
  onClose: () => void;
  onDelete: () => void;
}) {
  const { data, error } = useLoad<{ chat: FullChat }>(
    `${API}?view=chat&id=${encodeURIComponent(id)}`,
  );
  const c = data?.chat;
  return (
    <div
      className="admin-drawer-backdrop"
      role="presentation"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <aside className="admin-drawer" role="dialog" aria-modal="true" aria-label="Practice chat">
        <div className="admin-drawer-head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2>{c ? `${c.user?.name ?? "Trainee"} → ${c.persona?.name ?? "Author"}` : "Chat"}</h2>
            {c && (
              <small>
                {c.difficulty} · {c.challenge} · mood: {c.mood}
              </small>
            )}
          </div>
          <button className="admin-icon-button" aria-label="Delete chat" onClick={onDelete}>
            <Trash2 size={16} />
          </button>
          <button className="admin-icon-button" aria-label="Close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        {error && <div className="admin-alert">{error}</div>}
        {!c ? (
          <div className="admin-empty">Loading…</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {c.persona?.secret && (
              <div className="admin-drawer-card">
                <strong>Hidden objection</strong>
                <p>{c.persona.secret}</p>
              </div>
            )}
            {c.messages.map((m, i) => (
              <div
                key={i}
                style={{
                  justifySelf: m.role === "scout" ? "end" : "start",
                  maxWidth: "85%",
                  padding: "10px 14px",
                  borderRadius: 14,
                  fontSize: 14,
                  lineHeight: 1.5,
                  whiteSpace: "pre-wrap",
                  background: m.role === "scout" ? "var(--brand)" : "var(--secondary)",
                  color: m.role === "scout" ? "#fff" : undefined,
                  opacity: m.role === "sys" ? 0.7 : 1,
                }}
              >
                {m.text}
                {m.reaction && m.role === "author" && (
                  <small style={{ display: "block", marginTop: 4, opacity: 0.6 }}>
                    engine: {m.reaction.replaceAll("_", " ")}
                  </small>
                )}
              </div>
            ))}
            {c.trust_history?.length > 1 && (
              <div className="admin-drawer-card">
                <strong>Trust over the chat</strong>
                <p>{c.trust_history.join(" → ")}</p>
              </div>
            )}
            {c.coaching && (
              <div className="admin-drawer-card">
                <strong>
                  Coaching · {c.coaching.overall}/100 · {c.coaching.outcome}
                </strong>
                <p>{c.coaching.summary}</p>
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}

type AiData = {
  totals: {
    calls: number;
    ai: number;
    fallback: number;
    off: number;
    limit: number;
    noKey: number;
    tokensIn: number;
    tokensOut: number;
    cost: number;
    avgLatency: number | null;
    byKind: { kind: string; ai: number; fallback: number }[];
  };
  days: { day: string; ai: number; fallback: number; other: number; cost: number }[];
  keys: {
    id: string;
    type: string;
    owner: string;
    updated_at: string;
    calls: number;
    cost: number;
  }[];
  topUsers: { name: string; calls: number; cost: number }[];
  recentErrors: { at: string; kind: string; error: string; user: string }[];
};
function AiUsage() {
  const { data, error, reload } = useLoad<AiData>(`${API}?view=ai`);
  const [notice, setNotice] = useState("");
  if (error) return <div className="admin-alert">{error}</div>;
  if (!data) return <div className="admin-empty">Loading AI usage…</div>;
  const t = data.totals;
  const max = Math.max(1, ...data.days.map((d) => d.ai + d.fallback + d.other));
  async function removeKey(k: AiData["keys"][number]) {
    if (
      !window.confirm(
        `Remove ${k.owner}'s Perplexity key? The Practice Room will fall back to other trainers' keys.`,
      )
    )
      return;
    try {
      await call("DELETE", `${API}?key=${k.id}&type=${k.type}`);
      setNotice("Key removed.");
      reload();
    } catch (e) {
      setNotice((e as Error).message);
    }
  }
  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div
        className="admin-stats"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}
      >
        <Stat label="AI calls (30 days)" value={t.ai} note={`${t.calls} attempts in total`} />
        <Stat
          label="Estimated cost"
          value={usd(t.cost)}
          note={`${(t.tokensIn + t.tokensOut).toLocaleString()} tokens`}
        />
        <Stat
          label="Fallbacks"
          value={t.fallback}
          note={`${t.calls ? Math.round((t.fallback / t.calls) * 100) : 0}% used stored lines`}
        />
        <Stat
          label="Blocked"
          value={t.off + t.limit + t.noKey}
          note={`${t.off} off · ${t.limit} limit · ${t.noKey} no key`}
        />
        <Stat
          label="Average speed"
          value={t.avgLatency ? `${(t.avgLatency / 1000).toFixed(1)}s` : "–"}
        />
      </div>
      {notice && <div className="admin-notice">{notice}</div>}
      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <h2>Last 14 days</h2>
            <p>
              <span style={{ color: "var(--brand)" }}>■</span> AI ·{" "}
              <span style={{ opacity: 0.5 }}>■</span> fallback or blocked
            </p>
          </div>
          <button className="admin-icon-button" aria-label="Refresh" onClick={reload}>
            <RefreshCw size={16} />
          </button>
        </div>
        <div
          style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 150, padding: "0 4px" }}
        >
          {data.days.map((d) => (
            <div
              key={d.day}
              title={`${d.day}: ${d.ai} AI, ${d.fallback + d.other} other, ${usd(d.cost)}`}
              style={{ flex: 1, display: "grid", alignItems: "end", height: "100%" }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "flex-end",
                  height: "100%",
                }}
              >
                <div
                  style={{
                    height: `${((d.fallback + d.other) / max) * 100}%`,
                    background: "var(--muted-foreground)",
                    opacity: 0.35,
                    borderRadius: "4px 4px 0 0",
                  }}
                />
                <div
                  style={{
                    height: `${(d.ai / max) * 100}%`,
                    background: "var(--brand)",
                    borderRadius: d.fallback + d.other ? 0 : "4px 4px 0 0",
                  }}
                />
              </div>
              <small style={{ fontSize: 10, textAlign: "center", opacity: 0.6, marginTop: 4 }}>
                {d.day.slice(8)}
              </small>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
          {t.byKind.map((k) => (
            <span
              key={k.kind}
              className="admin-status draft"
              style={{ textTransform: "capitalize" }}
            >
              {k.kind === "reply" ? "Author replies" : k.kind === "hint" ? "Hints" : "Coaching"}:{" "}
              {k.ai} AI · {k.fallback} other
            </span>
          ))}
        </div>
      </section>
      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <h2>
              <KeyRound size={16} style={{ display: "inline", marginRight: 6 }} />
              API keys in use
            </h2>
            <p>
              Trainer Perplexity keys that power the Practice Room. Keys are encrypted and never
              shown.
            </p>
          </div>
        </div>
        {data.keys.length === 0 ? (
          <div className="admin-empty">
            No trainer keys yet. Without a key, the Practice Room uses its stored reply lines.
          </div>
        ) : (
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Owner</th>
                  <th>Saved</th>
                  <th>Calls (30 days)</th>
                  <th>Est. cost</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.keys.map((k) => (
                  <tr key={`${k.type}-${k.id}`}>
                    <td>{k.owner}</td>
                    <td>{when(k.updated_at)}</td>
                    <td>{k.calls}</td>
                    <td>{usd(k.cost)}</td>
                    <td>
                      <button
                        className="admin-button text-destructive"
                        onClick={() => void removeKey(k)}
                      >
                        <Trash2 size={14} /> Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <div
        style={{
          display: "grid",
          gap: 18,
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        }}
      >
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <h2>
                <Activity size={16} style={{ display: "inline", marginRight: 6 }} />
                Heaviest users
              </h2>
              <p>AI calls in the last 30 days.</p>
            </div>
          </div>
          {data.topUsers.length === 0 ? (
            <div className="admin-empty">No AI use yet.</div>
          ) : (
            data.topUsers.map((u) => (
              <div
                key={u.name}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "8px 0",
                  borderBottom: "1px solid var(--border)",
                  fontSize: 14,
                }}
              >
                <span>{u.name}</span>
                <span>
                  {u.calls} calls · {usd(u.cost)}
                </span>
              </div>
            ))
          )}
        </section>
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <h2>Recent AI errors</h2>
              <p>When the AI failed, the room used a stored line instead.</p>
            </div>
          </div>
          {data.recentErrors.length === 0 ? (
            <div className="admin-empty">No errors. 🎉</div>
          ) : (
            data.recentErrors.map((e, i) => (
              <div
                key={i}
                style={{ padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}
              >
                <strong>{e.kind}</strong> · {e.user} · {when(e.at)}
                <div style={{ opacity: 0.7 }}>{e.error}</div>
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  );
}

type SettingsData = {
  ai_enabled: boolean;
  ai_reply: boolean;
  ai_hint: boolean;
  ai_coach: boolean;
  model: string;
  daily_ai_limit: number;
};
const MODELS = [
  ["openai/gpt-6-luna", "GPT-6 Luna (default, cheapest)"],
  ["google/gemini-3.1-flash-lite", "Gemini 3.1 Flash-Lite"],
  ["perplexity/sonar", "Perplexity Sonar"],
] as const;
function SettingsPanel() {
  const { data, error } = useLoad<{ settings: SettingsData | null }>(`${API}?view=settings`);
  const [s, setS] = useState<SettingsData | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (data)
      setS(
        data.settings ?? {
          ai_enabled: true,
          ai_reply: true,
          ai_hint: true,
          ai_coach: true,
          model: "openai/gpt-6-luna",
          daily_ai_limit: 200,
        },
      );
  }, [data]);
  if (error) return <div className="admin-alert">{error}</div>;
  if (!s) return <div className="admin-empty">Loading settings…</div>;
  const toggle = (key: keyof SettingsData, label: string, hint: string, disabled = false) => (
    <label
      className="admin-drawer-card"
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        cursor: "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <input
        type="checkbox"
        disabled={disabled}
        checked={Boolean(s[key])}
        onChange={(e) => setS({ ...s, [key]: e.target.checked })}
      />
      <span>
        <strong>{label}</strong>
        <small style={{ display: "block", opacity: 0.7 }}>{hint}</small>
      </span>
    </label>
  );
  async function save() {
    setBusy(true);
    setNotice("");
    try {
      await call("PUT", API, s);
      setNotice("Settings saved. They apply within 30 seconds.");
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="admin-panel">
      <div className="admin-panel-heading">
        <div>
          <h2>Academy AI settings</h2>
          <p>
            Control how the Practice Room uses AI. When AI is off or unavailable, authors reply with
            the stored lines, so practice never stops.
          </p>
        </div>
      </div>
      {notice && <div className="admin-notice">{notice}</div>}
      <div style={{ display: "grid", gap: 10 }}>
        {toggle("ai_enabled", "AI in the Practice Room", "Master switch for all AI writing.")}
        {toggle(
          "ai_reply",
          "AI author replies",
          "Demo authors write replies in their own voice.",
          !s.ai_enabled,
        )}
        {toggle("ai_hint", "AI hints", "Tailored hints from the trainee's trainer.", !s.ai_enabled)}
        {toggle(
          "ai_coach",
          "AI coaching",
          "End-of-chat feedback that quotes the trainee.",
          !s.ai_enabled,
        )}
      </div>
      <div className="admin-invoice-form" style={{ marginTop: 16 }}>
        <div className="admin-form-grid">
          <label>
            AI model
            <select value={s.model} onChange={(e) => setS({ ...s, model: e.target.value })}>
              {!MODELS.some(([m]) => m === s.model) && <option value={s.model}>{s.model}</option>}
              {MODELS.map(([m, l]) => (
                <option key={m} value={m}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label>
            Daily AI limit per person (0 = unlimited)
            <input
              type="number"
              min={0}
              max={100000}
              value={s.daily_ai_limit}
              onChange={(e) =>
                setS({ ...s, daily_ai_limit: Math.max(0, Number(e.target.value) || 0) })
              }
            />
          </label>
        </div>
      </div>
      <div className="admin-button-row" style={{ marginTop: 16 }}>
        <button
          className="admin-button admin-button-primary"
          disabled={busy}
          onClick={() => void save()}
        >
          {busy ? "Saving…" : "Save settings"}
        </button>
      </div>
    </section>
  );
}
