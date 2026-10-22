import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { ArrowUp, Bot, CircleAlert, CircleCheck, Copy, RotateCcw } from "lucide-react";
import { AGENT_MODELS, DEFAULT_AGENT_MODEL } from "@/lib/trackers/agent-models";
import { actorHeaders, setTrackerAdminMode } from "./tracker-actor";

type Result = { ok: boolean; text: string; link?: string; passcode?: string };
type Message = { role: "user" | "assistant"; content: string; results?: Result[]; error?: boolean };

const STORE = (admin: boolean) => `hq360-tracker-assistant-${admin ? "admin" : "expert"}`;
const MODEL_STORE = "hq360-tracker-assistant-model";
const SUGGESTIONS = [
  "Create a tracker for Jane Doe, book launch project, with items: cover design, Amazon listing, 10 reader reviews",
  "Show me the link and passcode for my latest tracker",
  "Mark the cover design as done and post an update to the client",
];

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage blocked: the chat still works for this visit.
  }
}

function CopyChip({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="ta-chip"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        window.setTimeout(() => setDone(false), 1400);
      }}
    >
      <Copy size={12} aria-hidden="true" /> {done ? "Copied" : label}
    </button>
  );
}

/** Auto mode: chat with the assistant to create and edit client trackers. */
export function TrackerAssistant({
  admin = false,
  onChanged,
}: {
  admin?: boolean;
  onChanged?: () => void;
}) {
  setTrackerAdminMode(admin);
  const [messages, setMessages] = useState<Message[]>([]);
  const [model, setModel] = useState<string>(DEFAULT_AGENT_MODEL);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages(load<Message[]>(STORE(admin), []));
    setModel(load<string>(MODEL_STORE, DEFAULT_AGENT_MODEL));
  }, [admin]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages, busy]);

  function update(next: Message[]) {
    setMessages(next);
    save(STORE(admin), next.slice(-60));
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    const history = [...messages, { role: "user" as const, content }];
    update(history);
    setInput("");
    setBusy(true);
    try {
      const response = await fetch("/api/expert/tracker-agent", {
        method: "POST",
        headers: actorHeaders({ "content-type": "application/json" }),
        body: JSON.stringify({
          model,
          // Results are folded into the text so the assistant remembers links and ids.
          messages: history.map((m) => ({
            role: m.role,
            content: m.results?.length
              ? `${m.content}\n[Results: ${m.results.map((r) => `${r.ok ? "OK" : "FAILED"} ${r.text}${r.link ? ` link ${r.link}` : ""}`).join("; ")}]`
              : m.content,
          })),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "The assistant is unavailable.");
      update([...history, { role: "assistant", content: data.reply, results: data.results }]);
      if ((data.results as Result[] | undefined)?.some((r) => r.ok)) onChanged?.();
    } catch (e) {
      update([
        ...history,
        { role: "assistant", content: e instanceof Error ? e.message : "Something went wrong.", error: true },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function onKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send(input);
    }
  }

  return (
    <section className="admin-content-panel ta">
      <div className="ta-head">
        <div>
          <h2>
            <Bot size={16} aria-hidden="true" /> Tracker assistant
          </h2>
          <p className="settings-muted">
            Tell it what you need: create trackers, add items, post updates, publish, get links and
            passcodes. It uses your Perplexity key from Settings.
          </p>
        </div>
        <div className="ta-controls">
          <label className="ta-model">
            <span className="sr-only">Model</span>
            <select
              value={model}
              onChange={(e) => {
                setModel(e.target.value);
                save(MODEL_STORE, e.target.value);
              }}
            >
              {AGENT_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} · {m.price}
                </option>
              ))}
            </select>
          </label>
          {messages.length > 0 && (
            <button type="button" className="admin-button" onClick={() => update([])} disabled={busy}>
              <RotateCcw size={13} aria-hidden="true" /> New chat
            </button>
          )}
        </div>
      </div>

      <div className="ta-thread" aria-live="polite">
        {messages.length === 0 && (
          <div className="ta-empty">
            <p>Try one of these:</p>
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" className="ta-suggestion" onClick={() => void send(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`ta-msg ta-${m.role}${m.error ? " ta-error" : ""}`}>
            <div className="ta-bubble">{m.content}</div>
            {m.results?.map((r, j) => (
              <div key={j} className={`ta-result ${r.ok ? "" : "ta-result-fail"}`}>
                {r.ok ? <CircleCheck size={14} /> : <CircleAlert size={14} />}
                <div>
                  <p>{r.text}</p>
                  {r.link && (
                    <p className="ta-line">
                      <a href={r.link} target="_blank" rel="noreferrer">
                        {r.link}
                      </a>
                      <CopyChip text={r.link} label="Copy link" />
                    </p>
                  )}
                  {r.passcode && (
                    <p className="ta-line">
                      Passcode <code>{r.passcode}</code>
                      <CopyChip text={r.passcode} label="Copy passcode" />
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}
        {busy && (
          <div className="ta-msg ta-assistant">
            <div className="ta-bubble ta-typing">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}
        <div ref={end} />
      </div>

      <form
        className="ta-composer"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <textarea
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          placeholder="Message the tracker assistant… (Enter to send, Shift+Enter for a new line)"
          aria-label="Message"
          maxLength={8000}
        />
        <button className="ta-send" disabled={busy || !input.trim()} aria-label="Send">
          <ArrowUp size={18} />
        </button>
      </form>
    </section>
  );
}

/** Client tracking: Auto (assistant chat) or Manual (the full editor). */
export function ClientTrackingModes({
  admin = false,
  manual,
}: {
  admin?: boolean;
  manual: (refreshKey: number) => ReactNode;
}) {
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => setMode(load<"auto" | "manual">("hq360-tracker-mode", "auto")), []);
  function choose(next: "auto" | "manual") {
    setMode(next);
    save("hq360-tracker-mode", next);
  }
  return (
    <div className="ta-modes">
      <div className="admin-segmented" role="tablist" aria-label="Client tracking mode">
        <button type="button" role="tab" aria-selected={mode === "auto"} className={mode === "auto" ? "active" : ""} onClick={() => choose("auto")}>
          Auto · Assistant
        </button>
        <button type="button" role="tab" aria-selected={mode === "manual"} className={mode === "manual" ? "active" : ""} onClick={() => choose("manual")}>
          Manual
        </button>
      </div>
      {mode === "auto" ? (
        <TrackerAssistant admin={admin} onChanged={() => setRefreshKey((k) => k + 1)} />
      ) : (
        <div key={refreshKey}>{manual(refreshKey)}</div>
      )}
    </div>
  );
}
