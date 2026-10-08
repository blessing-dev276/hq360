import { supabase } from "@/integrations/supabase/client";

/* ------------------------------------------------------------------ types */

export type Msg = { role: "scout" | "author" | "sys"; text: string };
export type Coaching = {
  overall: number;
  scores: {
    personalisation: number;
    value: number;
    objection: number;
    tone: number;
    close: number;
  };
  outcome: "won" | "warming" | "neutral" | "cooling" | "lost";
  summary: string;
  strengths: string[];
  fixes: string[];
  better_line: string;
  moments?: { quote: string; effect: "helped" | "hurt"; note: string }[];
};
export type PersonaView = {
  id: string;
  name: string;
  colour: string;
  book: string;
  genre: string;
  public: string;
  secret?: string;
  personality?: string;
};
export type Session = {
  id: string;
  user_id: string;
  mode: "cold" | "no";
  messages: Msg[];
  ended: boolean;
  coaching: Coaching | null;
  created_at: string;
  updated_at: string;
  persona: PersonaView;
  reveal: { mood: string; challenge: string } | null;
  difficulty?: Difficulty;
};
export type Difficulty = "easy" | "medium" | "hard" | "extreme";
export const DIFFICULTY_INFO: Record<Difficulty, { label: string; who: string; blurb: string }> = {
  easy: {
    label: "Easy",
    who: "Beginners",
    blurb: "Friendly authors who reply to your first message and forgive small mistakes.",
  },
  medium: {
    label: "Medium",
    who: "Learning",
    blurb: "Real objections: questions, proof, budget. Some need a follow-up before replying.",
  },
  hard: {
    label: "Hard",
    who: "Confident scouts",
    blurb: "Scam-aware, burned before or not interested. Often silent until you follow up.",
  },
  extreme: {
    label: "Extreme",
    who: "Experts only",
    blurb: "Every hard trait at once. Can ignore up to 3 follow-ups. One slip can end it.",
  },
};
export type Viewer = {
  id: string;
  email: string | null;
  name: string | null;
  role: "trainer" | "trainee";
};

/* -------------------------------------------------------------------- api */

export async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { authorization: `Bearer ${token}` } : {};
}

export async function api<T = Record<string, unknown>>(
  url: string,
  init?: { method?: string; body?: unknown },
): Promise<{ status: number; body: T & { ok?: boolean; message?: string; error?: string } }> {
  const res = await fetch(url, {
    method: init?.method ?? "GET",
    headers: { "content-type": "application/json", ...(await authHeaders()) },
    ...(init?.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
  const body = (await res.json().catch(() => ({}))) as T & { ok?: boolean; message?: string };
  return { status: res.status, body };
}

/* --------------------------------------------------------------- helpers */

export function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function firstName(name: string) {
  return name.split(" ")[0] ?? name;
}

export function scoreClass(score: number) {
  if (score >= 70) return "asa-pill asa-pill-good";
  if (score >= 45) return "asa-pill asa-pill-warn";
  return "asa-pill asa-pill-bad";
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/* ------------------------------------------------------------- components */

export function Avatar({ persona, size = 44 }: { persona: PersonaView; size?: number }) {
  return (
    <span
      className="asa-avatar"
      style={{ width: size, height: size, background: persona.colour, fontSize: size * 0.36 }}
      aria-hidden="true"
    >
      {initials(persona.name)}
    </span>
  );
}

export function AuthorCard({ session }: { session: Session | null }) {
  if (!session) return null;
  const p = session.persona;
  return (
    <div className="asa-card">
      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        <Avatar persona={p} size={52} />
        <div>
          <h3 style={{ margin: 0, fontSize: 20 }}>{p.name}</h3>
          <div className="asa-muted" style={{ fontSize: 14 }}>
            <em>{p.book}</em> · {p.genre}
          </div>
        </div>
      </div>
      <p style={{ margin: "16px 0 4px", fontWeight: 600, fontSize: 13 }}>
        What you found in research
      </p>
      <p style={{ margin: 0, fontSize: 14 }}>{p.public}</p>
      <div style={{ marginTop: 14, display: "grid", gap: 8, fontSize: 14 }}>
        <div>
          <b>Difficulty:</b>{" "}
          <span className={`asa-diff-badge ${session.difficulty ?? "medium"}`}>
            {DIFFICULTY_INFO[session.difficulty ?? "medium"].label}
          </span>
          {session.reveal ? <> · Author type: {session.reveal.challenge}</> : null}
        </div>
        {session.reveal ? (
          <>
            <div>
              <b>Mood:</b> {session.reveal.mood}
            </div>
            <div>
              <b>Hidden objection:</b> {p.secret}
            </div>
            {p.personality ? (
              <div>
                <b>Personality:</b> {p.personality}
              </div>
            ) : null}
          </>
        ) : (
          <div className="asa-muted">
            <b style={{ color: "var(--asa-ink)" }}>Hidden objection:</b> Revealed when you end the
            chat. Ask good questions to uncover it.
          </div>
        )}
      </div>
    </div>
  );
}

export function Transcript({
  session,
  streaming,
  typing,
  innerRef,
}: {
  session: Session;
  streaming?: string;
  typing?: boolean;
  innerRef?: React.Ref<HTMLDivElement>;
}) {
  const name = firstName(session.persona.name);
  return (
    <div className="asa-chat" ref={innerRef} aria-live="polite">
      {session.messages.length === 0 && !streaming ? (
        <p className="asa-sys" style={{ margin: "auto" }}>
          Write your first email to {name}. Make the first line about them.
        </p>
      ) : null}
      {session.messages.map((m, i) => {
        if (m.role === "sys")
          return (
            <p key={i} className="asa-sys" style={{ margin: 0 }}>
              {m.text}
            </p>
          );
        if (m.role === "author" && m.text.trim() === "[No reply]")
          return (
            <p key={i} className="asa-sys" style={{ margin: 0 }}>
              No reply. {name} saw it but has not answered yet. Keep following up, each time with
              something new.
            </p>
          );
        return (
          <div key={i} className={`asa-msg ${m.role}`}>
            {m.text}
          </div>
        );
      })}
      {streaming ? <div className="asa-msg author">{streaming}</div> : null}
      {typing && !streaming ? (
        <p className="asa-sys" style={{ margin: 0 }}>
          {name} is typing...
        </p>
      ) : null}
    </div>
  );
}

const SUB_LABELS: [keyof Coaching["scores"], string][] = [
  ["personalisation", "Personalisation"],
  ["value", "Value given"],
  ["objection", "Objection handling"],
  ["tone", "Tone and style"],
  ["close", "Close"],
];

const OUTCOME_CLASS: Record<Coaching["outcome"], string> = {
  won: "asa-pill asa-pill-good",
  warming: "asa-pill asa-pill-good",
  neutral: "asa-pill",
  cooling: "asa-pill asa-pill-warn",
  lost: "asa-pill asa-pill-bad",
};

export const SUB_NAMES = Object.fromEntries(SUB_LABELS) as Record<string, string>;

export function CoachingPanel({ coaching }: { coaching: Coaching }) {
  return (
    <div className="asa-card" style={{ marginTop: 16 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "center" }}>
        <div>
          <div className="asa-label">Coaching score</div>
          <div className="asa-serif" style={{ fontSize: 56, lineHeight: 1 }}>
            {coaching.overall}
            <span className="asa-muted" style={{ fontSize: 22 }}>
              {" "}
              / 100
            </span>
          </div>
        </div>
        <span className={OUTCOME_CLASS[coaching.outcome]} style={{ textTransform: "capitalize" }}>
          {coaching.outcome}
        </span>
      </div>
      <div className="asa-bars" style={{ marginTop: 16 }}>
        {SUB_LABELS.map(([k, label]) => (
          <div key={k}>
            <span>{label}</span>
            <div className="asa-bar-track">
              <div className="asa-bar-fill" style={{ width: `${coaching.scores[k] * 10}%` }} />
            </div>
            <span className="asa-muted">{coaching.scores[k]}/10</span>
          </div>
        ))}
      </div>
      <p style={{ marginTop: 16 }}>{coaching.summary}</p>
      <div className="asa-grid-2">
        <div>
          <h3 style={{ fontSize: 17, margin: "8px 0" }}>What worked</h3>
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            {coaching.strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3 style={{ fontSize: 17, margin: "8px 0" }}>What to change</h3>
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            {coaching.fixes.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      </div>
      {coaching.moments?.length ? (
        <>
          <h3 style={{ fontSize: 17, margin: "18px 0 6px" }}>Key moments in your chat</h3>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
            {coaching.moments.map((m, i) => (
              <li
                key={i}
                style={{
                  borderLeft: `3px solid var(${m.effect === "helped" ? "--asa-good" : "--asa-bad"})`,
                  paddingLeft: 12,
                }}
              >
                <q style={{ fontStyle: "italic" }}>{m.quote}</q>
                <div className="asa-muted" style={{ fontSize: 14, marginTop: 4 }}>
                  <b
                    style={{ color: `var(${m.effect === "helped" ? "--asa-good" : "--asa-bad"})` }}
                  >
                    {m.effect === "helped" ? "Built trust" : "Cost trust"}
                  </b>{" "}
                  · {m.note}
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <h3 style={{ fontSize: 17, margin: "18px 0 6px" }}>A stronger line you could have sent</h3>
      <p className="asa-better">{coaching.better_line}</p>
    </div>
  );
}

export function SessionCard({
  session,
  selected,
  onClick,
}: {
  session: Session;
  selected?: boolean;
  onClick: () => void;
}) {
  const count = session.messages.filter((m) => m.role !== "sys").length;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`asa-card asa-session-card${selected ? " selected" : ""}`}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <Avatar persona={session.persona} size={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600 }}>{session.persona.name}</div>
          <div className="asa-muted" style={{ fontSize: 13 }}>
            {session.mode === "no" ? "They said no" : "Cold outreach"}
          </div>
        </div>
        {session.coaching ? (
          <span className={scoreClass(session.coaching.overall)}>{session.coaching.overall}</span>
        ) : (
          <span className="asa-pill">In progress</span>
        )}
      </div>
      <div className="asa-muted" style={{ fontSize: 13, marginTop: 12 }}>
        {count} messages · {formatDate(session.created_at)}
      </div>
    </button>
  );
}
