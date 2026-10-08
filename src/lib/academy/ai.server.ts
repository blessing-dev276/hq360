// AI writer for the Practice Room. The rule based Author Engine stays the
// referee: it scores every message, moves trust and decides how the author
// reacts. The cheapest Perplexity model only *writes* that decision in the
// persona's voice, tailors hints and explains coaching. Every call has a short
// timeout and falls back to the stored Response Bank line, so the room keeps
// working with no key, a slow API or a bad answer. No web search is used.
import { runAgent } from "@/lib/perplexity/agent.server";
import { decryptExpertKey } from "@/lib/perplexity/credentials.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Persona } from "./practice-data.server";
import type { EngineMsg, Reaction, Stage } from "./engine.server";

export const PRACTICE_MODEL = "openai/gpt-6-luna";
const TIMEOUT_MS = 12_000;

/** What each engine decision means, in words the writer can act on. */
const INTENT: Record<Reaction, string> = {
  no_reply: "Do not reply.",
  who_are_you: "You don't know this person. Ask who they are and how they found you.",
  rude: "You are annoyed by how they wrote to you. Reply curtly and coldly.",
  end_firm_no: "You are done. Give a firm, final no and ask them not to contact you again.",
  guarantee_trap:
    "They promised results nobody can guarantee. Call that out; it makes you suspicious.",
  wrong_fact:
    "They got a fact about you or your book wrong (see WRONG FACT). Correct them, a little put out that they didn't check.",
  price_too_early:
    "They brought up money before you even know them. Push back: why talk price already?",
  pressure_pushback: "They are rushing you. Say you don't respond well to pressure.",
  template_callout: "Their message reads like a copy-paste template. Say so.",
  stop_emailing: "They keep messaging without listening. Ask them to stop.",
  objection_reveal:
    "Trust has been earned. Open up and share your real hidden worry (SECRET) in your own words.",
  question_barrage: "They asked too many questions at once. Say it is a lot, answer at most one.",
  polite_decline: "Politely decline for now, without hostility.",
  soft_decline: "Hesitate: not now, maybe later, you'd need to think about it.",
  scam_suspicion:
    "This feels like it could be a scam. Say so and ask for something you can verify.",
  cold_short: "Reply very briefly and noncommittally. You are not engaged yet.",
  proof_request:
    "You're interested but want proof: real examples, results or a way to check them yourself.",
  objection_hint:
    "Hint that something holds you back (related to SECRET) without saying what it is.",
  curious_question: "You are a little curious. Ask one genuine question about what they offer.",
  warming: "You are warming up. Be friendlier and engage with a specific point they made.",
  agree_small_step: "Agree to a small, low-risk next step they suggested.",
  won_followup: "You're on board. Reply positively and ask what happens next.",
  trust_issue: "You have trust issues from past experiences. Say you're wary of people like them.",
  no_budget: "You simply don't have money for this right now. Say so honestly.",
};

/**
 * A trainer's Perplexity key: the user's own first (their Academy key, or
 * their expert key if they are an expert assigned as trainer), otherwise the
 * most recently saved trainer key. No key means the room uses its stored
 * banks; the admin key is never used here.
 */
async function trainerKey(userId: string): Promise<string | null> {
  const db = supabaseAdmin as unknown as SupabaseClient;
  const [{ data: academy }, { data: experts }] = await Promise.all([
    db
      .from("academy_trainer_credentials")
      .select("trainer_id, encrypted_key, updated_at")
      .order("updated_at", { ascending: false })
      .limit(50),
    db
      .from("expert_perplexity_credentials")
      .select("expert_id, encrypted_key, updated_at, expert_profiles!inner(academy_trainer)")
      .eq("expert_profiles.academy_trainer", true)
      .order("updated_at", { ascending: false })
      .limit(50),
  ]);
  type Candidate = { owner: string; aad: string; key: string; at: string };
  const candidates: Candidate[] = [
    ...((academy ?? []) as { trainer_id: string; encrypted_key: string; updated_at: string }[]).map(
      (r) => ({
        owner: r.trainer_id,
        aad: `academy:${r.trainer_id}`,
        key: r.encrypted_key,
        at: r.updated_at,
      }),
    ),
    ...((experts ?? []) as { expert_id: string; encrypted_key: string; updated_at: string }[]).map(
      (r) => ({ owner: r.expert_id, aad: r.expert_id, key: r.encrypted_key, at: r.updated_at }),
    ),
  ].sort((x, y) => y.at.localeCompare(x.at));
  // The user's own key (trainers), then their assigned trainer's, then any.
  const { data: me } = await db
    .from("profiles")
    .select("trainer_id")
    .eq("id", userId)
    .maybeSingle();
  const assigned = (me as { trainer_id: string | null } | null)?.trainer_id ?? null;
  for (const c of [
    ...candidates.filter((c) => c.owner === userId),
    ...candidates.filter((c) => c.owner === assigned),
    ...candidates,
  ]) {
    try {
      return decryptExpertKey(c.aad, c.key);
    } catch {
      /* unreadable key; try the next one */
    }
  }
  return null;
}

async function write(
  userId: string,
  instructions: string,
  input: string,
  json?: Record<string, unknown>,
) {
  const apiKey = await trainerKey(userId);
  if (!apiKey) throw new Error("No trainer Perplexity key saved");
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  const result = await runAgent(
    {
      model: PRACTICE_MODEL,
      tools: [],
      max_steps: 1,
      instructions,
      input,
      ...(json
        ? { response_format: { type: "json_schema", json_schema: { name: "out", schema: json } } }
        : {}),
    },
    (url, init) => fetch(url, { ...init, signal }),
    { apiKey },
  );
  return result.text.trim();
}

const transcript = (messages: EngineMsg[], persona: Persona) =>
  messages
    .filter((m) => m.role !== "sys")
    .map((m) => `${m.role === "scout" ? "SCOUT" : persona.name.toUpperCase()}: ${m.text}`)
    .join("\n\n");

/** Text the model wrote that we refuse to show as a human author's reply. */
function unusable(text: string) {
  return (
    !text ||
    text.length > 900 ||
    /\b(as an ai|language model|i am an ai|i'm an ai|roleplay|role-play|scout academy)\b/i.test(
      text,
    )
  );
}

export async function aiAuthorReply(args: {
  userId: string;
  persona: Persona;
  mood: string;
  stage: Stage;
  reaction: Reaction;
  history: EngineMsg[];
  scoutText: string;
  bankLine: string;
  wrongFact: string | null;
  objectionRevealed: boolean;
  lateReply: boolean;
}): Promise<string | null> {
  const p = args.persona;
  const canRevealSecret = args.reaction === "objection_reveal" || args.objectionRevealed;
  const instructions = [
    `You are ${p.name}, a real self-published author, replying by email to a book marketing scout who contacted you. Stay fully in character. Never mention AI, games, scores or training.`,
    `ABOUT YOU: ${p.public} Your book: "${p.book}" (${p.genre}).`,
    `PERSONALITY: ${p.personality}`,
    `VOICE: ${p.voice}.${p.signoff ? ` Sign off with "${p.signoff}" when it fits.` : " No sign-off."}`,
    `MOOD TODAY: ${args.mood}. RELATIONSHIP: ${args.stage}.`,
    `BUDGET (only if money comes up): ${p.budget}`,
    canRevealSecret
      ? `SECRET (you may now share it in your own words): ${p.secret}`
      : `You have a private worry you must NOT reveal or hint at in detail yet. Never mention past bad experiences, losses or amounts of money you lost.`,
    args.wrongFact ? `WRONG FACT they stated about you: "${args.wrongFact}".` : "",
    `WHAT YOU DO IN THIS REPLY (decided already, follow it exactly): ${INTENT[args.reaction]}`,
    `A reply with the right intent looks like: "${args.bankLine}". Do not copy it; write your own reply to what they actually said.`,
    args.lateReply ? "You are replying late; briefly apologise for the slow reply first." : "",
    `RULES: React to the specifics of their last message. Match your voice and keep it short (1 to 4 sentences, blunt personas 1 to 2). Plain text email body only: no subject line, no markdown, no em dashes, no lists. Never agree to more than the intent allows, never invent facts about yourself beyond ABOUT YOU, never ask for or give contact details.`,
  ]
    .filter(Boolean)
    .join("\n");
  const input = `CONVERSATION SO FAR:\n${transcript(args.history, p) || "(none)"}\n\nTHEIR NEW MESSAGE:\n${args.scoutText}\n\nWrite ${p.name}'s reply.`;
  try {
    const text = (await write(args.userId, instructions, input)).replace(/\s*—\s*/g, ", ");
    return unusable(text) ? null : text;
  } catch (err) {
    console.error("[academy/ai] reply", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function aiHint(args: {
  userId: string;
  persona: Persona;
  stage: Stage;
  messages: EngineMsg[];
  ruleHint: string;
}): Promise<string | null> {
  const p = args.persona;
  const instructions = `You are Emmanuel, a senior book-marketing scout coaching a trainee who is messaging an author by email. Give ONE practical hint for their next message (2 to 3 sentences): what to do and why, tied to what the author last said. You may suggest a short example opening phrase in quotes. Never write the whole message for them. Plain text, no em dashes. Coaching focus from the playbook: ${args.ruleHint}`;
  const input = `AUTHOR (public profile only): ${p.name}, "${p.book}" (${p.genre}). ${p.public}\nRelationship: ${args.stage}\n\nCHAT:\n${transcript(args.messages, p) || "(trainee hasn't written yet)"}`;
  try {
    const text = await write(args.userId, instructions, input);
    return unusable(text) ? null : text.replace(/\s*—\s*/g, ", ");
  } catch (err) {
    console.error("[academy/ai] hint", err instanceof Error ? err.message : err);
    return null;
  }
}

export type AiCoaching = {
  summary: string;
  strengths: string[];
  fixes: string[];
  better_line: string;
  moments: { quote: string; effect: "helped" | "hurt"; note: string }[];
};
const coachingSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "strengths", "fixes", "better_line", "moments"],
  properties: {
    summary: { type: "string" },
    strengths: { type: "array", items: { type: "string" } },
    fixes: { type: "array", items: { type: "string" } },
    better_line: { type: "string" },
    moments: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["quote", "effect", "note"],
        properties: {
          quote: { type: "string" },
          effect: { type: "string", enum: ["helped", "hurt"] },
          note: { type: "string" },
        },
      },
    },
  },
};

/** Scores stay rule based; the model explains them using the actual chat. */
export async function aiCoaching(args: {
  userId: string;
  persona: Persona;
  mood: string;
  challenge: string;
  messages: EngineMsg[];
  trustHistory: number[];
  scores: Record<string, number>;
  overall: number;
  outcome: string;
}): Promise<AiCoaching | null> {
  const p = args.persona;
  const scoutLines = args.messages.filter((m) => m.role === "scout").map((m) => m.text);
  const instructions = `You are Emmanuel, a senior book-marketing scout reviewing a trainee's practice chat with a demo author. The scores are final; explain them, do not change them. Be specific: quote the trainee's own words. Write: summary (2 to 3 sentences on what happened and why it ended "${args.outcome}"); strengths (2 to 3 items); fixes (2 to 4 concrete changes); better_line (one message the trainee could have sent at their weakest moment, in their own style, under 70 words); moments (up to 4 key trainee lines: quote copied exactly from the trainee's messages, whether it helped or hurt trust, and a one-sentence why). Kind, direct, practical. Plain text in every field, no em dashes.`;
  const input = `AUTHOR: ${p.name}, "${p.book}" (${p.genre}). ${p.public}\nHIDDEN (now revealed to trainee): personality: ${p.personality} Secret worry: ${p.secret} Budget: ${p.budget} What wins them: ${p.wins} Mood: ${args.mood}. Test style: ${args.challenge}.\nTRUST after each message (0-100): ${args.trustHistory.join(" -> ")}\nSCORES (0-10): ${JSON.stringify(args.scores)}; overall ${args.overall}/100\n\nCHAT:\n${transcript(args.messages, p)}`;
  try {
    const raw = await write(args.userId, instructions, input, coachingSchema);
    const out = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)) as AiCoaching;
    const clean = (s: unknown, max: number) =>
      typeof s === "string"
        ? s
            .replace(/\s*—\s*/g, ", ")
            .trim()
            .slice(0, max)
        : "";
    const list = (v: unknown, n: number) =>
      (Array.isArray(v) ? v : [])
        .map((s) => clean(s, 400))
        .filter(Boolean)
        .slice(0, n);
    const result: AiCoaching = {
      summary: clean(out.summary, 800),
      strengths: list(out.strengths, 3),
      fixes: list(out.fixes, 4),
      better_line: clean(out.better_line, 600),
      // Only quotes that really come from the trainee are kept.
      moments: (Array.isArray(out.moments) ? out.moments : [])
        .filter(
          (m) =>
            m &&
            typeof m.quote === "string" &&
            m.quote.trim().length > 3 &&
            scoutLines.some((line) => line.includes(m.quote.trim())) &&
            (m.effect === "helped" || m.effect === "hurt"),
        )
        .map((m) => ({ quote: m.quote.trim(), effect: m.effect, note: clean(m.note, 300) }))
        .slice(0, 4),
    };
    if (!result.summary || !result.strengths.length || !result.fixes.length) return null;
    return result;
  } catch (err) {
    console.error("[academy/ai] coaching", err instanceof Error ? err.message : err);
    return null;
  }
}
