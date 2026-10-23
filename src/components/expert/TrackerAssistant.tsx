import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  ArrowUp,
  Bot,
  CircleAlert,
  CircleCheck,
  Copy,
  ImagePlus,
  RotateCcw,
  X,
} from "lucide-react";
import { OutreachCampaign, type CampaignSpec } from "@/components/admin/OutreachCampaign";
import { AGENT_MODELS, DEFAULT_AGENT_MODEL } from "@/lib/trackers/agent-models";
import { actorHeaders, setTrackerAdminMode } from "./tracker-actor";

type Result = {
  ok: boolean;
  text: string;
  link?: string;
  passcode?: string;
  open?: string;
  campaign?: CampaignSpec;
};
type Message = {
  role: "user" | "assistant";
  content: string;
  results?: Result[];
  error?: boolean;
  /** Screenshot previews; kept in memory only, not in browser storage. */
  images?: string[];
  imageCount?: number;
};

const MAX_IMAGES = 4;
/** Shrinks a screenshot so it uploads fast and stays well under 5 MB. */
async function toDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

const STORE = (admin: boolean) => `hq360-tracker-assistant-${admin ? "admin" : "expert"}`;
const MODEL_STORE = "hq360-tracker-assistant-model";
const WORKSPACE_SUGGESTIONS = [
  "What needs my attention today?",
  "Which leads have follow-ups due, and what should I say to each?",
  "Add a lead: Jane Doe, jane@example.com, wants a book launch, follow up Friday",
  "Draft a proposal for Jane Doe's book launch",
];
const ADMIN_WORKSPACE_SUGGESTIONS = [
  "Scout 20 new Thriller authors, find their emails and draft my outreach to each",
  ...WORKSPACE_SUGGESTIONS.slice(0, 3),
];
const SUGGESTIONS = [
  "Create a tracker for Jane Doe, book launch project, with items: cover design, Amazon listing, 10 reader reviews",
  "Show me the link and passcode for my latest tracker",
  "Mark the cover design as done and post an update to the client",
  "Here's a screenshot of the latest ranking — update the tracker with it",
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

/** AI Assistant: chat (with screenshots) to create and edit client trackers. */
export function TrackerAssistant({
  admin = false,
  onChanged,
  onOpen,
  workspace = false,
  prompt,
}: {
  admin?: boolean;
  onChanged?: () => void;
  /** Opens a workspace page when the assistant asks to (open_page). */
  onOpen?: (page: string) => void;
  /** Workspace-wide drawer: broader suggestions, compact layout. */
  workspace?: boolean;
  /** Sent once as soon as the chat is ready (e.g. from a dashboard button). */
  prompt?: { text: string; at: number } | undefined;
}) {
  setTrackerAdminMode(admin);
  const [messages, setMessages] = useState<Message[]>([]);
  const [model, setModel] = useState<string>(DEFAULT_AGENT_MODEL);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [attachError, setAttachError] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const picker = useRef<HTMLInputElement>(null);

  async function attach(files: File[]) {
    setAttachError("");
    const pictures = files.filter((f) => /^image\/(png|jpeg|webp|gif)$/.test(f.type));
    if (files.length && !pictures.length) return setAttachError("Only images can be attached.");
    const room = MAX_IMAGES - images.length;
    if (pictures.length > room) setAttachError(`Up to ${MAX_IMAGES} screenshots per message.`);
    try {
      const added = await Promise.all(pictures.slice(0, Math.max(room, 0)).map(toDataUrl));
      setImages((current) => [...current, ...added].slice(0, MAX_IMAGES));
    } catch {
      setAttachError("Could not read that image.");
    }
  }

  // Mirrors messages so a send fired straight after mount sees the loaded history.
  const latest = useRef<Message[]>([]);
  useEffect(() => {
    latest.current = load<Message[]>(STORE(admin), []);
    setMessages(latest.current);
    setModel(load<string>(MODEL_STORE, DEFAULT_AGENT_MODEL));
  }, [admin]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages, busy]);
  const asked = useRef(0);
  useEffect(() => {
    if (!prompt || asked.current === prompt.at) return;
    asked.current = prompt.at;
    // Wait a tick so the saved history has loaded before the prompt is appended.
    const timer = window.setTimeout(() => void send(prompt.text), 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt]);

  function update(next: Message[]) {
    latest.current = next;
    setMessages(next);
    save(
      STORE(admin),
      next
        .slice(-60)
        .map(({ images: shots, ...m }) => (shots?.length ? { ...m, imageCount: shots.length } : m)),
    );
  }

  async function send(text: string) {
    const shots = images;
    const content = text.trim() || (shots.length ? "Here is a screenshot." : "");
    if (!content || busy) return;
    const history: Message[] = [
      ...latest.current,
      { role: "user", content, ...(shots.length ? { images: shots } : {}) },
    ];
    update(history);
    setInput("");
    setImages([]);
    setBusy(true);
    try {
      const response = await fetch("/api/expert/tracker-agent", {
        method: "POST",
        headers: actorHeaders({ "content-type": "application/json" }),
        body: JSON.stringify({
          model,
          ...(shots.length ? { images: shots } : {}),
          // Results are folded into the text so the assistant remembers links and ids.
          messages: history.map((m) => ({
            role: m.role,
            content:
              (m.images?.length || m.imageCount
                ? `[${m.images?.length ?? m.imageCount} screenshot(s) attached] `
                : "") +
              (m.results?.length
                ? `${m.content}\n[Results: ${m.results.map((r) => `${r.ok ? "OK" : "FAILED"} ${r.text}${r.link ? ` link ${r.link}` : ""}`).join("; ")}]`
                : m.content),
          })),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "The assistant is unavailable.");
      update([...history, { role: "assistant", content: data.reply, results: data.results }]);
      const results = (data.results as Result[] | undefined) ?? [];
      if (results.some((r) => r.ok)) onChanged?.();
      const page = [...results].reverse().find((r) => r.ok && r.open)?.open;
      if (page) onOpen?.(page);
    } catch (e) {
      update([
        ...history,
        {
          role: "assistant",
          content: e instanceof Error ? e.message : "Something went wrong.",
          error: true,
        },
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
    <section className={workspace ? "ta ta-workspace" : "admin-content-panel ta"}>
      <div className="ta-head">
        <div>
          <h2>
            {workspace ? (
              <span className={`siri-orb${busy ? " siri-orb-busy" : ""}`} aria-hidden="true" />
            ) : (
              <Bot size={16} aria-hidden="true" />
            )}{" "}
            AI Assistant
          </h2>
          <p className="settings-muted">
            {workspace
              ? "Ask about anything in your workspace, or tell it what to do: leads and follow-ups, draft proposals, client trackers, and it can take you to any page. Paste screenshots too. Uses your Perplexity key from Settings."
              : "Tell it what you need, or paste a screenshot: it reads rankings, dashboards, reviews and client messages, then creates trackers, updates items, posts updates, publishes and gives you links and passcodes. It uses your Perplexity key from Settings."}
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
            <button
              type="button"
              className="admin-button"
              onClick={() => update([])}
              disabled={busy}
            >
              <RotateCcw size={13} aria-hidden="true" /> New chat
            </button>
          )}
        </div>
      </div>

      <div className="ta-thread" aria-live="polite">
        {messages.length === 0 && (
          <div className="ta-empty">
            <p>Try one of these:</p>
            {(workspace
              ? admin
                ? ADMIN_WORKSPACE_SUGGESTIONS
                : WORKSPACE_SUGGESTIONS
              : SUGGESTIONS
            ).map((s) => (
              <button key={s} type="button" className="ta-suggestion" onClick={() => void send(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`ta-msg ta-${m.role}${m.error ? " ta-error" : ""}`}>
            {m.images?.length ? (
              <div className="ta-shots">
                {m.images.map((src, k) => (
                  <img key={k} src={src} alt={`Screenshot ${k + 1}`} />
                ))}
              </div>
            ) : m.imageCount ? (
              <small className="settings-muted">{m.imageCount} screenshot(s) attached</small>
            ) : null}
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
                  {r.campaign && admin && <OutreachCampaign spec={r.campaign} />}
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

      {attachError && (
        <p className="settings-muted" role="alert">
          {attachError}
        </p>
      )}
      <form
        className={`ta-composer${dragging ? " ta-dragging" : ""}`}
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          void send(input);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void attach([...e.dataTransfer.files]);
        }}
      >
        {images.length > 0 && (
          <div className="ta-pending">
            {images.map((src, k) => (
              <span key={k} className="ta-thumb">
                <img src={src} alt={`Screenshot ${k + 1} to send`} />
                <button
                  type="button"
                  aria-label={`Remove screenshot ${k + 1}`}
                  onClick={() => setImages((current) => current.filter((_, i) => i !== k))}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="ta-row">
          <input
            ref={picker}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            multiple
            hidden
            onChange={(e) => {
              void attach([...(e.target.files ?? [])]);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            className="ta-attach"
            aria-label="Attach screenshot"
            title="Attach screenshot (or paste / drag it here)"
            onClick={() => picker.current?.click()}
            disabled={busy || images.length >= MAX_IMAGES}
          >
            <ImagePlus size={18} />
          </button>
          <textarea
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            onPaste={(e) => {
              const files = [...e.clipboardData.files];
              if (files.length) {
                e.preventDefault();
                void attach(files);
              }
            }}
            placeholder="Message the AI Assistant, or paste a screenshot… (Enter to send)"
            aria-label="Message"
            maxLength={8000}
          />
          <button
            className="ta-send"
            disabled={busy || (!input.trim() && !images.length)}
            aria-label="Send"
          >
            <ArrowUp size={18} />
          </button>
        </div>
      </form>
    </section>
  );
}

/** Client tracking: AI Assistant (chat) or Manual (the full editor). */
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
        <button
          type="button"
          role="tab"
          aria-selected={mode === "auto"}
          className={mode === "auto" ? "active" : ""}
          onClick={() => choose("auto")}
        >
          AI Assistant
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "manual"}
          className={mode === "manual" ? "active" : ""}
          onClick={() => choose("manual")}
        >
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

const OPEN_EVENT = "hq360:assistant";
/** Opens the workspace AI Assistant from anywhere, optionally asking it something. */
export function openAssistant(text?: string) {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: text ?? "" }));
}

/** The AI Assistant as a slide-over available on every page of a workspace. */
export function AssistantDrawer({
  admin = false,
  onOpen,
}: {
  admin?: boolean;
  onOpen: (page: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState<{ text: string; at: number }>();
  useEffect(() => {
    const onOpenEvent = (e: Event) => {
      setOpen(true);
      const text = (e as CustomEvent<string>).detail;
      if (text) setPrompt({ text, at: Date.now() });
    };
    window.addEventListener(OPEN_EVENT, onOpenEvent);
    return () => window.removeEventListener(OPEN_EVENT, onOpenEvent);
  }, []);
  useEffect(() => {
    if (!open) return;
    const close = (e: globalThis.KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);
  // The top bar uses backdrop-filter, which traps position: fixed children,
  // so the panel renders at the workspace root (keeping its theme and styles).
  // Resolved after mount so server and first client render match.
  const [root, setRoot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setRoot(document.querySelector<HTMLElement>(".admin-workspace") ?? document.body);
  }, []);
  return (
    <>
      <button
        type="button"
        className="ta-launch"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title="AI Assistant"
      >
        <span className="siri-orb siri-orb-sm" aria-hidden="true" />
        <span>AI Assistant</span>
      </button>
      {root &&
        !open &&
        createPortal(
          <button
            type="button"
            className="ta-fab"
            aria-label="Open AI Assistant"
            onClick={() => setOpen(true)}
          >
            <span className="siri-orb" aria-hidden="true" />
          </button>,
          root,
        )}
      {open &&
        root &&
        createPortal(
          <div className="siri-layer">
            <button
              type="button"
              className="siri-scrim"
              aria-label="Close assistant"
              tabIndex={-1}
              onClick={() => setOpen(false)}
            />
            <div className="siri-glow" aria-hidden="true" />
            <div className="ta-drawer" role="dialog" aria-modal="true" aria-label="AI Assistant">
              <button
                type="button"
                className="ta-drawer-close"
                aria-label="Close assistant"
                onClick={() => setOpen(false)}
              >
                <X size={16} />
              </button>
              <TrackerAssistant admin={admin} workspace onOpen={onOpen} prompt={prompt} />
            </div>
          </div>,
          root,
        )}
    </>
  );
}
