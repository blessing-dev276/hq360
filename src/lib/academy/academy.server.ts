// Author Scout Academy server helpers: auth, session storage and the glue
// between the API routes and the rule based Author Engine. The engine decides
// every outcome; ai.server only writes replies, hints and coaching in words,
// falling back to the stored banks whenever AI is unavailable.
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isAdminRequest } from "@/lib/admin-auth.server";
import {
  findPersona,
  findStyle,
  publicPersona,
  revealedPersona,
  type Persona,
} from "./practice-data.server";
import {
  analyse,
  changeSignals,
  chooseLine,
  clampTrust,
  coachScores,
  difficultyOf,
  hasRealAuthorReply,
  decide,
  fillLine,
  hintRule,
  inVoice,
  NO_REPLY,
  scoreMessage,
  stageOf,
  typingDelay,
  workedSignals,
  worstReaction,
  type BankRow,
  type EngineMsg,
  type Reaction,
  type Stage,
  type Turn,
} from "./engine.server";
import { aiAuthorReply, aiCoaching, aiHint, type AiCoaching } from "./ai.server";

// The generated Database types do not include the academy tables yet.
export const db = supabaseAdmin as unknown as SupabaseClient;

export type Role = "trainer" | "trainee";
export type Msg = EngineMsg;
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
  /** Key trainee lines and what they did to trust (AI coaching only). */
  moments?: AiCoaching["moments"];
};
export type SessionRow = {
  id: string;
  user_id: string;
  persona: string;
  mood: string;
  challenge: string;
  mode: "cold" | "no";
  messages: Msg[];
  coaching: Coaching | null;
  ended: boolean;
  created_at: string;
  updated_at: string;
  trust: number;
  strikes: number;
  stage: Stage;
  objection_revealed: boolean;
  used_line_ids: string[];
  signals: Turn[];
  trust_history: number[];
  difficulty: string;
  silent_left: number;
};
export type Viewer = { id: string; email: string | null; name: string | null; role: Role };

export { NO_REPLY };
export const MAX_MESSAGE_CHARS = 1500;

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/* ------------------------------------------------------------------- auth */

export async function getViewer(request: Request): Promise<Viewer | null> {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return null;
  const token = header.slice(7);
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  const user = data.user;

  let { data: profile } = await db
    .from("profiles")
    .select("id, full_name, email, role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) {
    // Safety net if the sign up trigger did not run.
    const meta = user.user_metadata ?? {};
    const inserted = await db
      .from("profiles")
      .upsert({
        id: user.id,
        email: user.email,
        full_name: (meta.full_name as string) ?? (meta.name as string) ?? null,
      })
      .select("id, full_name, email, role")
      .single();
    profile = inserted.data;
  }
  return {
    id: user.id,
    email: user.email ?? null,
    name: (profile?.full_name as string | null) ?? null,
    role: profile?.role === "trainer" ? "trainer" : "trainee",
  };
}

/** Trainer via Supabase login, or anyone holding the /admin passphrase cookie. */
export async function isTrainerRequest(request: Request): Promise<boolean> {
  if (await isAdminRequest(request)) return true;
  const viewer = await getViewer(request);
  return viewer?.role === "trainer";
}

/* --------------------------------------------------------------- engine */

const lastReactionOf = (messages: Msg[]): Reaction | null => {
  const a = [...messages].reverse().find((m) => m.role === "author");
  if (!a) return null;
  return a.reaction ?? (a.text.trim() === NO_REPLY ? "no_reply" : null);
};
const isLost = (m: Msg[]) => m.some((x) => x.reaction === "end_firm_no");
const isWon = (m: Msg[]) => m.some((x) => x.reaction === "agree_small_step");

async function bankFor(persona: Persona, reaction: Reaction): Promise<BankRow[]> {
  const { data } = await db
    .from("response_bank")
    .select("id, author, reaction, text")
    .eq("reaction", reaction)
    .eq("active", true)
    .in("author", [persona.name, "ANY"]);
  return (data ?? []) as BankRow[];
}

/**
 * Runs one scout message through the engine (sections A to E) and saves the
 * new state. Returns the updated row and how long to show "Typing...".
 */
export async function handleScoutMessage(row: SessionRow, text: string) {
  const started = Date.now();
  const persona = findPersona(row.persona)!;
  const history = row.messages;
  const signals = analyse(text, persona, history);

  const lastAuthor = [...history].reverse().find((m) => m.role === "author");
  const authorAskedLastTurn = !!lastAuthor && lastAuthor.text.includes("?");
  const difficulty = difficultyOf(row.difficulty);
  const { delta, strikes, priceEarly } = scoreMessage(signals, {
    style: row.challenge,
    trust: row.trust,
    objectionRevealed: row.objection_revealed,
    authorAskedLastTurn,
    difficulty,
  });
  let trust = clampTrust(row.trust + delta);
  const totalStrikes = row.strikes + strikes;

  // Like real authors, some ignore the first message (and a follow-up or
  // more) before replying. The scout's messages still count while they wait.
  const silentLeft = row.silent_left ?? 0;
  const stillSilent = silentLeft > 0 && !hasRealAuthorReply(history) && !isLost(history);
  const decided = decide(signals, {
    style: row.challenge,
    mood: row.mood,
    stage: stageOf(trust),
    trust,
    strikes: totalStrikes,
    objectionRevealed: row.objection_revealed,
    lost: isLost(history),
    won: isWon(history),
    lastReaction: lastReactionOf(history),
    priceEarly,
    difficulty,
  });
  const reaction: Reaction = stillSilent ? "no_reply" : decided;
  const lateReply =
    !stillSilent &&
    reaction !== "no_reply" &&
    !hasRealAuthorReply(history) &&
    history.some((m) => m.role === "author" && m.text.trim() === NO_REPLY);
  if (reaction === "guarantee_trap" && (row.challenge === "scam" || row.challenge === "all"))
    trust = clampTrust(trust - 10);

  const used = new Set(row.used_line_ids);
  let replyText = NO_REPLY;
  if (reaction !== "no_reply") {
    const choice = chooseLine(await bankFor(persona, reaction), persona, used);
    if (choice.short) {
      await db.from("weak_spots").insert({
        session_id: row.id,
        scout_text: text,
        reaction_used: reaction,
      });
    }
    let bankLine = inVoice("I have nothing more to add right now.", persona);
    if (choice.row) {
      used.add(choice.row.id);
      const filled = fillLine(choice.row.text, persona, signals.wrongFact);
      bankLine = choice.voice ? inVoice(filled, persona) : filled;
    }
    // The model writes the engine's decision in the author's voice, reacting
    // to what the scout actually said; the bank line is the fallback.
    const written = await aiAuthorReply({
      userId: row.user_id,
      persona,
      mood: row.mood,
      stage: stageOf(trust),
      reaction,
      history,
      scoutText: text,
      bankLine,
      wrongFact: signals.wrongFact,
      objectionRevealed: row.objection_revealed,
      lateReply,
    });
    replyText =
      written ??
      (lateReply
        ? `${LATE_OPENERS[Math.floor(Math.random() * LATE_OPENERS.length)]} ${bankLine}`
        : bankLine);
  }

  const turn: Turn = {
    signals,
    delta: trust - row.trust,
    trustAfter: trust,
    reaction,
    priceEarly,
    strike: strikes > 0,
  };
  const messages: Msg[] = [
    ...history,
    { role: "scout", text },
    { role: "author", text: replyText, reaction },
  ];
  const next: SessionRow = {
    ...row,
    messages,
    trust,
    strikes: totalStrikes,
    stage: stageOf(trust),
    objection_revealed: row.objection_revealed || reaction === "objection_reveal",
    used_line_ids: [...used],
    signals: [...row.signals, turn],
    trust_history: [...row.trust_history, trust],
    silent_left: stillSilent ? silentLeft - 1 : silentLeft,
  };
  await db
    .from("sessions")
    .update({
      messages: next.messages,
      trust: next.trust,
      strikes: next.strikes,
      stage: next.stage,
      objection_revealed: next.objection_revealed,
      used_line_ids: next.used_line_ids,
      signals: next.signals,
      trust_history: next.trust_history,
      silent_left: next.silent_left,
    })
    .eq("id", row.id);
  // Time spent writing the reply already counts toward the "Typing..." pause.
  const delayMs =
    reaction === "no_reply" ? 800 : Math.max(600, typingDelay() - (Date.now() - started));
  return { row: next, delayMs };
}

const LATE_OPENERS = [
  "Sorry for the slow reply.",
  "Apologies, I only just saw your messages.",
  "Sorry, it has been a busy few days.",
  "I saw your follow-ups, sorry for not answering sooner.",
];

export async function getHint(row: SessionRow) {
  const rule = hintRule(row.messages, row.signals, row.stage, row.objection_revealed);
  const { data } = await db.from("hints").select("rule, text").in("rule", [rule, "default"]);
  const rows = (data ?? []) as { rule: string; text: string }[];
  const ruleHint =
    rows.find((r) => r.rule === rule)?.text ??
    rows.find((r) => r.rule === "default")?.text ??
    "Keep it personal, give one useful thing, and end with one easy question.";
  const tailored = await aiHint({
    userId: row.user_id,
    persona: findPersona(row.persona)!,
    stage: row.stage,
    messages: row.messages,
    ruleHint,
  });
  return tailored ?? ruleHint;
}

async function feedbackLines(
  signals: string[],
  kind: "worked" | "change",
  min: number,
  max: number,
) {
  const { data } = await db.from("feedback").select("signal, text").eq("kind", kind);
  const rows = (data ?? []) as { signal: string; text: string }[];
  const out: string[] = [];
  for (const s of signals) {
    const line = rows.find((r) => r.signal === s);
    if (line && !out.includes(line.text)) out.push(line.text);
    if (out.length >= max) break;
  }
  const fallback = rows.find((r) => r.signal === "default")?.text;
  if (out.length < min && fallback && !out.includes(fallback)) out.push(fallback);
  return out;
}

/** Section H: scores the chat from the saved signals, trust, stage and strikes. */
export async function getCoaching(row: SessionRow): Promise<Coaching> {
  const persona = findPersona(row.persona)!;
  const input = {
    turns: row.signals,
    stage: row.stage,
    strikes: row.strikes,
    lost: isLost(row.messages),
    won: isWon(row.messages),
    revealed: row.objection_revealed,
  };
  const { scores, overall, outcome } = coachScores(input);

  const { data: summaryRow } = await db
    .from("feedback")
    .select("text")
    .eq("kind", "summary")
    .eq("signal", `summary_${outcome}`)
    .limit(1);
  const summary = (summaryRow?.[0] as { text: string } | undefined)?.text ?? "";

  const reaction = worstReaction(row.signals) ?? "objection_reveal";
  const { data: model } = await db
    .from("model_lines")
    .select("text")
    .eq("author", persona.name)
    .eq("reaction", reaction)
    .limit(2);
  const lines = (model ?? []) as { text: string }[];
  const better =
    lines[Math.floor(Math.random() * lines.length)]?.text ??
    "Ask one caring question about their experience, then offer one small step they can check.";

  const ai = await aiCoaching({
    userId: row.user_id,
    persona,
    mood: row.mood,
    challenge: findStyle(row.challenge)?.label ?? row.challenge,
    messages: row.messages,
    trustHistory: row.trust_history,
    scores,
    overall,
    outcome,
  });
  if (ai) return { overall, scores, outcome, ...ai };
  return {
    overall,
    scores,
    outcome,
    summary,
    strengths: await feedbackLines(workedSignals(input), "worked", 2, 3),
    fixes: await feedbackLines(changeSignals(input), "change", 2, 4),
    better_line: better,
  };
}

/* ------------------------------------------------------------- shaping */

/** What the browser may see. Hidden fields appear only once the chat has ended. */
export function clientSession(row: SessionRow) {
  const persona = findPersona(row.persona)!;
  const style = findStyle(row.challenge);
  return {
    id: row.id,
    user_id: row.user_id,
    mode: row.mode,
    // Reaction tags stay on the server until the chat is scored.
    messages: row.ended ? row.messages : row.messages.map(({ role, text }) => ({ role, text })),
    ended: row.ended,
    coaching: row.ended ? row.coaching : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    persona: row.ended ? revealedPersona(persona) : publicPersona(persona),
    difficulty: difficultyOf(row.difficulty),
    reveal: row.ended ? { mood: row.mood, challenge: style?.label ?? row.challenge } : null,
  };
}

export async function loadOwnSession(id: string, viewer: Viewer) {
  const { data } = await db.from("sessions").select("*").eq("id", id).maybeSingle();
  const row = data as SessionRow | null;
  if (!row) return null;
  if (row.user_id !== viewer.id && viewer.role !== "trainer") return null;
  return row;
}
