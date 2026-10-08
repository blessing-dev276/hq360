import { useCallback, useEffect, useRef, useState } from "react";
import {
  api,
  AuthorCard,
  CoachingPanel,
  DIFFICULTY_INFO,
  Transcript,
  type Difficulty,
  type Session,
} from "./shared";

const LEVELS = Object.keys(DIFFICULTY_INFO) as Difficulty[];
function savedLevel(): Difficulty {
  try {
    const v = localStorage.getItem("asa-difficulty");
    return LEVELS.includes(v as Difficulty) ? (v as Difficulty) : "easy";
  } catch {
    return "easy";
  }
}

const MAX_CHARS = 1500;

export function PracticeRoom({
  initial,
  onChanged,
}: {
  initial: Session | null;
  onChanged: () => void;
}) {
  const [mode, setMode] = useState<"cold" | "no">(initial?.mode ?? "cold");
  const [session, setSession] = useState<Session | null>(initial);
  const [level, setLevel] = useState<Difficulty>(() => initial?.difficulty ?? savedLevel());
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<"" | "new" | "send" | "hint" | "coach">("");
  const [typing, setTyping] = useState(false);
  const [notice, setNotice] = useState("");
  const [hint, setHint] = useState("");
  const chatRef = useRef<HTMLDivElement>(null);

  const startNew = useCallback(
    async (m: "cold" | "no", lvl: Difficulty = level) => {
      setBusy("new");
      setNotice("");
      setHint("");
      setText("");
      const { status, body } = await api<{ session: Session }>("/api/academy/session", {
        method: "POST",
        body: { mode: m, difficulty: lvl },
      });
      setBusy("");
      if (status === 200 && body.session) {
        setSession(body.session);
        onChanged();
      } else setNotice("Could not start a new chat. Try again.");
    },
    [onChanged, level],
  );
  function pickLevel(lvl: Difficulty) {
    if (busy || lvl === level) return;
    setLevel(lvl);
    try {
      localStorage.setItem("asa-difficulty", lvl);
    } catch {
      /* storage unavailable */
    }
    void startNew(mode, lvl);
  }

  useEffect(() => {
    if (initial) {
      setSession(initial);
      setMode(initial.mode);
    } else if (!session) void startNew(mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight });
  }, [session?.messages.length, typing]);

  async function send() {
    const msg = text.trim();
    if (!session || !msg || busy || session.ended) return;
    if (msg.length > MAX_CHARS) return setNotice(`Keep it under ${MAX_CHARS} characters.`);
    setBusy("send");
    setNotice("");
    setHint("");
    // Show the scout message right away.
    setSession({ ...session, messages: [...session.messages, { role: "scout", text: msg }] });
    let res: Awaited<ReturnType<typeof api<{ session?: Session; delayMs?: number }>>> | null = null;
    try {
      res = await api<{ session?: Session; delayMs?: number }>("/api/academy/reply", {
        method: "POST",
        body: { sessionId: session.id, text: msg },
      });
    } catch {
      res = null;
    }
    const body = res?.body;
    if (!res || res.status !== 200 || !body?.session) {
      // Keep the draft so Send retries the same message.
      setSession(session);
      setNotice(body?.message ?? "Could not send. Press Send again to retry.");
      setBusy("");
      return;
    }
    setText("");
    const fresh = body.session;
    const reply = fresh.messages[fresh.messages.length - 1];
    // "Typing..." only when the author actually writes back.
    const delay = body.delayMs ?? 2000;
    if (reply?.text.trim() === "[No reply]") setTyping(false);
    else setTyping(true);
    await new Promise((r) => setTimeout(r, delay));
    setTyping(false);
    setSession(fresh);
    setBusy("");
    onChanged();
  }

  async function getHint() {
    if (!session || busy) return;
    setBusy("hint");
    setNotice("");
    const { body } = await api<{ hint: string }>("/api/academy/hint", {
      method: "POST",
      body: { sessionId: session.id },
    });
    setBusy("");
    if (body.hint) setHint(body.hint);
    else setNotice(body.message ?? "Could not get a hint.");
  }

  async function endChat() {
    if (!session || busy) return;
    setBusy("coach");
    setNotice("");
    const { body } = await api<{ session: Session }>("/api/academy/coach", {
      method: "POST",
      body: { sessionId: session.id },
    });
    setBusy("");
    if (body.session) {
      setSession(body.session);
      onChanged();
    } else setNotice(body.message ?? "Coaching failed. Please try again.");
  }

  const firstMessage = !session?.messages.some((m) => m.role === "scout");
  const authorMsgs = session?.messages.filter((m) => m.role === "author") ?? [];
  const awaitingReply =
    !session?.ended &&
    authorMsgs.length > 0 &&
    authorMsgs.every((m) => m.text.trim() === "[No reply]");

  return (
    <div className="asa-wrap">
      <div className="asa-practice">
        <div style={{ display: "grid", gap: 16 }}>
          <div>
            <h2 style={{ fontSize: 30, margin: "0 0 8px" }}>Talk to a demo author</h2>
            <p className="asa-muted" style={{ margin: 0, fontSize: 14 }}>
              Demo authors behave like real ones: some are scam aware, some have trust issues, want
              proof, have no money or simply aren't interested, and some won't reply until you
              follow up. Start on Easy and work your way up. Chats save to My chats.
            </p>
          </div>
          <div className="asa-levels" role="radiogroup" aria-label="Difficulty">
            {LEVELS.map((lvl, i) => (
              <button
                key={lvl}
                type="button"
                role="radio"
                aria-checked={level === lvl}
                disabled={!!busy}
                className={`asa-level ${lvl}${level === lvl ? " active" : ""}`}
                onClick={() => pickLevel(lvl)}
              >
                <span className="asa-level-bars" aria-hidden="true">
                  {LEVELS.map((_, j) => (
                    <i key={j} className={j <= i ? "on" : ""} />
                  ))}
                </span>
                <b>{DIFFICULTY_INFO[lvl].label}</b>
                <small>{DIFFICULTY_INFO[lvl].who}</small>
              </button>
            ))}
          </div>
          <p className="asa-muted" style={{ margin: "-6px 0 0", fontSize: 13 }}>
            {DIFFICULTY_INFO[level].blurb}
          </p>
          <div className="asa-toggle" role="group" aria-label="Scenario">
            {(
              [
                ["cold", "Cold outreach"],
                ["no", "They said no"],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                disabled={!!busy}
                onClick={() => {
                  if (mode === m) return;
                  setMode(m);
                  void startNew(m);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <AuthorCard session={session} />
          <button
            type="button"
            className="asa-btn asa-btn-ghost"
            disabled={!!busy}
            onClick={() => void startNew(mode)}
          >
            {busy === "new"
              ? "Finding an author..."
              : `New ${DIFFICULTY_INFO[level].label.toLowerCase()} author`}
          </button>
        </div>

        <div>
          {session ? (
            <>
              <Transcript session={session} typing={typing} innerRef={chatRef} />
              {awaitingReply && !typing ? (
                <p className="asa-waiting">
                  <b>No reply yet.</b> Real authors often ignore the first message. Follow up with
                  something new: a fact, a screenshot or an easy question.
                </p>
              ) : null}
              {!session.ended ? (
                <div style={{ marginTop: 14 }}>
                  <label htmlFor="asa-compose" style={{ fontWeight: 600, fontSize: 14 }}>
                    {firstMessage
                      ? "Write your first message to the author"
                      : awaitingReply
                        ? "Write your follow-up"
                        : "Write your reply"}
                  </label>
                  <textarea
                    id="asa-compose"
                    className="asa-input"
                    rows={6}
                    maxLength={MAX_CHARS}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        void send();
                      }
                    }}
                    style={{ marginTop: 6, resize: "vertical" }}
                  />
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                      alignItems: "center",
                      marginTop: 10,
                    }}
                  >
                    <span className="asa-muted" style={{ fontSize: 12, marginRight: "auto" }}>
                      {text.length}/{MAX_CHARS} · Ctrl or Cmd + Enter sends
                    </span>
                    <button
                      type="button"
                      className="asa-btn asa-btn-ghost asa-btn-sm"
                      disabled={!!busy}
                      onClick={() => void getHint()}
                    >
                      {busy === "hint" ? "Thinking..." : "Get a hint"}
                    </button>
                    <button
                      type="button"
                      className="asa-btn asa-btn-dark asa-btn-sm"
                      disabled={!!busy || firstMessage}
                      onClick={() => void endChat()}
                    >
                      {busy === "coach" ? "Scoring..." : "End and get coaching"}
                    </button>
                    <button
                      type="button"
                      className="asa-btn asa-btn-sm"
                      disabled={!!busy || !text.trim()}
                      onClick={() => void send()}
                    >
                      Send
                    </button>
                  </div>
                  {hint ? (
                    <div className="asa-callout">
                      <strong>Hint from Emmanuel</strong>
                      {hint}
                    </div>
                  ) : null}
                  {notice ? (
                    <p style={{ color: "var(--asa-bad)", fontSize: 14 }}>{notice}</p>
                  ) : null}
                </div>
              ) : (
                <>
                  {session.coaching ? <CoachingPanel coaching={session.coaching} /> : null}
                  <button
                    type="button"
                    className="asa-btn"
                    style={{ marginTop: 16 }}
                    disabled={!!busy}
                    onClick={() => void startNew(mode)}
                  >
                    Practise with a new author
                  </button>
                </>
              )}
            </>
          ) : (
            <p className="asa-muted">{notice || "Preparing your author..."}</p>
          )}
        </div>
      </div>
    </div>
  );
}
