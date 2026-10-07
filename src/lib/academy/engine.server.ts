// Rule based Author Engine. No AI and no API keys: every author reply, hint and
// coaching score is computed here from the message, the session state and the
// stored Response Bank. Import only from server code.
import type { Persona } from "./practice-data.server";

export type Signals = {
  words: number;
  usesName: boolean;
  mentionsBook: boolean;
  usesFacts: boolean;
  wrongFact: string | null;
  questions: number;
  asksAboutThem: boolean;
  priceTalk: boolean;
  guarantee: boolean;
  pressure: boolean;
  hype: boolean;
  template: boolean;
  aiTells: boolean;
  empathy: boolean;
  proof: boolean;
  value: boolean;
  objectionKey: boolean;
  repeatPitch: boolean;
  lowEffort: boolean;
  contractions: number;
  longDashes: number;
};

/** One entry per scout message, saved on the session for coaching. */
export type Turn = {
  signals: Signals;
  delta: number;
  trustAfter: number;
  reaction: Reaction;
  priceEarly: boolean;
  strike: boolean;
};

export const REACTIONS = [
  "no_reply",
  "who_are_you",
  "rude",
  "end_firm_no",
  "guarantee_trap",
  "wrong_fact",
  "price_too_early",
  "pressure_pushback",
  "template_callout",
  "stop_emailing",
  "objection_reveal",
  "question_barrage",
  "polite_decline",
  "soft_decline",
  "scam_suspicion",
  "cold_short",
  "proof_request",
  "objection_hint",
  "curious_question",
  "warming",
  "agree_small_step",
  "won_followup",
] as const;
export type Reaction = (typeof REACTIONS)[number];

export type Stage = "Cold" | "Wary" | "Engaged" | "Warm" | "Won";
export type EngineMsg = { role: "scout" | "author" | "sys"; text: string; reaction?: Reaction };

export const NO_REPLY = "[No reply]";

/* ------------------------------------------------------------- matching */

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function normalise(text: string) {
  return text.toLowerCase().replace(/[‘’]/g, "'");
}

/** Whole word or phrase, case insensitive, allowing a plural "s". */
function phraseRe(phrase: string) {
  const p = esc(phrase.toLowerCase());
  const startsWord = /^[a-z0-9]/i.test(phrase);
  const endsWord = /[a-z0-9]$/i.test(phrase);
  return new RegExp(`${startsWord ? "(?<![a-z0-9])" : ""}${p}${endsWord ? "(?:s|es)?(?![a-z0-9])" : ""}`, "g");
}

function hasAny(text: string, phrases: string[]) {
  return phrases.some((p) => phraseRe(p).test(text));
}

function firstMatch(text: string, phrases: string[]) {
  return phrases.find((p) => phraseRe(p).test(text)) ?? null;
}

const PRICE = ["$", "£", "€", "dollars", "price", "cost", "fee", "payment", "invoice", "package", "per month", "rate"];
const GUARANTEE = ["guarantee", "guaranteed", "promise", "number one", "#1", "bestseller", "best seller", "100%", "will definitely", "sure to"];
const PRESSURE = ["limited time", "act now", "today only", "urgent", "last chance", "only a few spots", "don't miss", "before it's too late"];
const HYPE = ["skyrocket", "explode", "go viral", "massive", "game changer", "huge opportunity", "life changing", "amazing results"];
const TEMPLATE_PHRASES = ["i hope this email finds you well", "dear author", "to whom it may concern", "i came across your profile"];
const AI_WORDS = /(?<![a-z])(delv|elevat|unlock|leverag|navigat|tapestr|resonat)[a-z]*/;
const EMPATHY = ["understand", "appreciate", "totally fair", "i hear you", "sorry", "respect", "makes sense"];
const PROOF = ["portfolio", "example", "screenshot", "past client", "testimonial", "review", "results", "case study", "you can check", "my website"];
const VALUE = ["i found", "i built", "i noticed", "i checked", "page", "list", "screenshot", "demo", "free", "here is", "attached"];
const ABOUT_THEM = ["you", "your", "how is", "what made", "why did", "how has"];
const CONTRACTIONS = /(?<![a-z])(i'd|i'm|don't|it's|can't|won't|you're|that's|isn't)(?![a-z])/g;

function wordsOf(text: string) {
  return normalise(text).match(/[a-z0-9']+/g) ?? [];
}

function titleWords(book: string) {
  return book
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .split(/[^a-z0-9']+/)
    .map((w) => w.replace(/'s$/, ""))
    .filter((w) => w.length > 3);
}

export function hasRealAuthorReply(messages: EngineMsg[]) {
  return messages.some((m) => m.role === "author" && m.text.trim() !== NO_REPLY);
}

/* ------------------------------------------------------------- analyser */

export function analyse(raw: string, persona: Persona, history: EngineMsg[]): Signals {
  const text = normalise(raw);
  const words = wordsOf(raw);
  const first = persona.name.split(" ")[0]!.toLowerCase();

  const usesName = phraseRe(first).test(text);
  const mentionsBook = titleWords(persona.book).some((w) => phraseRe(w).test(text));
  const usesFacts = hasAny(text, persona.facts);
  // A wrong keyword inside a fact phrase ("no website") is not an error.
  let withoutFacts = text;
  for (const f of persona.facts) withoutFacts = withoutFacts.replace(phraseRe(f), " ");
  const wrongFact = firstMatch(withoutFacts, persona.wrongFacts);

  const questions = (raw.match(/\?/g) ?? []).length;
  const questionSentences = raw.split(/(?<=[.!?])\s+/).filter((s) => s.includes("?"));
  const asksAboutThem = questionSentences.some((s) => hasAny(normalise(s), ABOUT_THEM));

  const template =
    /^\s*([-•*]|\d+\.)\s/m.test(raw) ||
    /(^|\n)\s*[A-Za-z][A-Za-z ]{1,30}:\s/.test(raw) ||
    /\b[A-Z][a-z]+ [a-z]+:\s/.test(raw) ||
    raw.includes("**") ||
    TEMPLATE_PHRASES.some((p) => text.includes(p));
  const longDashes = (raw.match(/[—–]/g) ?? []).length;
  const aiTells = longDashes > 0 || AI_WORDS.test(text) || text.includes("in today's world");

  const prevScout = [...history].reverse().find((m) => m.role === "scout");
  let repeatPitch = false;
  if (prevScout && words.length) {
    const prev = new Set(wordsOf(prevScout.text));
    repeatPitch = words.filter((w) => prev.has(w)).length / words.length > 0.5;
  }

  const lowEffort =
    !hasRealAuthorReply(history) && (words.length < 12 || (!usesName && !mentionsBook));

  return {
    words: words.length,
    usesName,
    mentionsBook,
    usesFacts,
    wrongFact,
    questions,
    asksAboutThem,
    priceTalk: hasAny(text, PRICE),
    guarantee: hasAny(text, GUARANTEE),
    pressure: hasAny(text, PRESSURE),
    hype: hasAny(text, HYPE),
    template,
    aiTells,
    empathy: hasAny(text, EMPATHY),
    proof: hasAny(text, PROOF),
    value: hasAny(text, VALUE),
    objectionKey: questions > 0 && hasAny(text, persona.unlocks),
    repeatPitch,
    lowEffort,
    contractions: (text.match(CONTRACTIONS) ?? []).length,
    longDashes,
  };
}

/* -------------------------------------------------------- trust, strikes */

const START_TRUST: Record<string, number> = {
  interrogator: 25,
  decliner: 15,
  errorhunter: 20,
  scam: 10,
  all: 5,
};

export const clampTrust = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function startingTrust(style: string, mode: "cold" | "no", mood: string) {
  let t = START_TRUST[style] ?? 15;
  if (mode === "no") t -= 10;
  if (mood === "in a good mood today") t += 5;
  if (mood === "tired and short on patience") t -= 5;
  return clampTrust(t);
}

export function stageOf(trust: number): Stage {
  if (trust >= 80) return "Won";
  if (trust >= 60) return "Warm";
  if (trust >= 40) return "Engaged";
  if (trust >= 20) return "Wary";
  return "Cold";
}

const is = (style: string, ...ids: string[]) => ids.includes(style) || style === "all";

export function scoreMessage(
  s: Signals,
  ctx: { style: string; trust: number; objectionRevealed: boolean; authorAskedLastTurn: boolean },
) {
  const { style } = ctx;
  const hunter = is(style, "errorhunter") ? 2 : 1;
  const scam = is(style, "scam") ? 2 : 1;
  let gain = 0;
  let loss = 0;

  if (s.usesName && s.mentionsBook) gain += 10;
  if (s.usesFacts) gain += 8;
  if (s.value) gain += 8;
  if (s.proof) gain += is(style, "scam") ? 12 : 8;
  if (s.empathy) gain += 6;
  if (s.asksAboutThem) gain += 6;
  if (s.objectionKey && !ctx.objectionRevealed) gain += 15;
  if (s.questions === 1) gain += 4;

  const priceEarly = s.priceTalk && ctx.trust < 70;
  if (s.lowEffort) loss += 25;
  if (s.wrongFact) loss += 15 * hunter;
  if (priceEarly) loss += 15;
  if (s.guarantee) loss += 20 * scam;
  if (s.pressure) loss += 15 * scam;
  if (s.hype) loss += 10 * scam;
  if (s.template) loss += 12 * hunter;
  if (s.aiTells) loss += 8 * hunter;
  if (s.repeatPitch) loss += 10;
  if (s.questions > 3) loss += 6;
  if (s.words > 220) loss += 8;
  if (is(style, "interrogator") && ctx.authorAskedLastTurn && !s.value && !s.proof && !s.usesFacts)
    loss += 10;

  const delta = gain - loss;
  let strikes = 0;
  if (is(style, "decliner") && loss > 0) strikes += 1;
  if (delta < -10) strikes += 1;
  return { delta, strikes, priceEarly };
}

/* ------------------------------------------------------------- decision */

const rnd = () => Math.random();
const pickOne = <T>(list: readonly T[]) => list[Math.floor(rnd() * list.length)]!;

export function decide(
  s: Signals,
  st: {
    style: string;
    mood: string;
    stage: Stage;
    trust: number;
    strikes: number;
    objectionRevealed: boolean;
    lost: boolean;
    won: boolean;
    lastReaction: Reaction | null;
    priceEarly: boolean;
  },
): Reaction {
  if (st.lost) return "no_reply";
  if (st.won) return "won_followup";

  if (s.lowEffort) {
    if (rnd() < 0.7) return "no_reply";
    return /irritated|tired/.test(st.mood) ? "rude" : "who_are_you";
  }
  if (st.strikes >= (st.style === "decliner" ? 2 : 3)) return "end_firm_no";
  if (s.guarantee) return "guarantee_trap";
  if (s.wrongFact) return "wrong_fact";
  if (st.priceEarly) return "price_too_early";
  if (s.pressure || s.hype) return "pressure_pushback";
  if ((s.template || s.aiTells) && (st.style === "errorhunter" || st.style === "all"))
    return "template_callout";
  if (st.lastReaction === "no_reply" && !s.value && !s.proof) return "stop_emailing";
  if (s.objectionKey && !st.objectionRevealed) return "objection_reveal";

  switch (st.stage) {
    case "Cold": {
      const byStyle: Record<string, Reaction> = {
        interrogator: "question_barrage",
        decliner: "polite_decline",
        scam: "scam_suspicion",
        errorhunter: "cold_short",
      };
      return byStyle[st.style] ?? pickOne(Object.values(byStyle));
    }
    case "Wary": {
      if (!st.objectionRevealed && rnd() < 0.5) return "objection_hint";
      if (st.style === "interrogator") return "question_barrage";
      if (st.style === "scam") return "proof_request";
      if (st.style === "all") return pickOne(["question_barrage", "proof_request", "soft_decline"] as const);
      return "soft_decline";
    }
    case "Engaged":
      return !st.objectionRevealed && rnd() < 0.4 ? "objection_hint" : "curious_question";
    case "Warm":
      return "warming";
    case "Won":
      return "agree_small_step";
  }
}

/* --------------------------------------------------------- line choice */

export type BankRow = { id: string; author: string; reaction: string; text: string };

export function fillLine(text: string, persona: Persona, wrong: string | null) {
  return text
    .replaceAll("{first}", persona.name.split(" ")[0]!)
    .replaceAll("{book}", persona.book)
    .replaceAll("{wrong}", wrong ?? "that detail")
    .replaceAll("{signoff}", persona.signoff)
    .replaceAll("{secret}", persona.secret)
    .replace(/\s+/g, " ")
    .trim();
}

/** Backup "ANY" lines are put into the author's voice: greeting and sign off. */
export function inVoice(text: string, persona: Persona) {
  let out = text;
  if (persona.name === "Harold Jensen" && !out.startsWith("Dear Sir"))
    out = `Dear Sir, ${out.charAt(0).toLowerCase()}${out.slice(1)}`;
  if (persona.signoff && !out.includes(persona.signoff)) out = `${out} ${persona.signoff}`;
  return out;
}

/**
 * Prefers unused lines for this author, then unused ANY lines in their voice.
 * `short` is true when we had to fall back (logged as a weak spot).
 */
export function chooseLine(rows: BankRow[], persona: Persona, used: Set<string>) {
  const own = rows.filter((r) => r.author === persona.name);
  const any = rows.filter((r) => r.author === "ANY");
  const freshOwn = own.filter((r) => !used.has(r.id));
  if (freshOwn.length) return { row: pickOne(freshOwn), voice: false, short: false };
  const freshAny = any.filter((r) => !used.has(r.id));
  if (freshAny.length) return { row: pickOne(freshAny), voice: true, short: true };
  const all = own.length ? own : any;
  if (all.length) return { row: pickOne(all), voice: !own.length, short: true };
  return { row: null, voice: false, short: true };
}

export function typingDelay() {
  return 1500 + Math.floor(rnd() * 2500);
}

/* ---------------------------------------------------------------- hints */

export function hintRule(messages: EngineMsg[], turns: Turn[], stage: Stage, revealed: boolean) {
  if (!messages.some((m) => m.role === "scout")) return "no_message";
  const lastAuthor = [...messages].reverse().find((m) => m.role === "author");
  const last = lastAuthor?.reaction ?? (lastAuthor?.text.trim() === NO_REPLY ? "no_reply" : null);
  if (last === "no_reply") return "after_no_reply";
  if (last === "wrong_fact") return "after_wrong_fact";
  if (last === "price_too_early") return "after_price_too_early";
  if (last === "guarantee_trap") return "after_guarantee_trap";
  if (last === "pressure_pushback") return "after_pressure_pushback";
  if (last === "template_callout") return "after_template_callout";
  if (last === "question_barrage" || last === "proof_request") return "after_questions";
  if ((stage === "Cold" || stage === "Wary") && !revealed) return "cold_unrevealed";
  if (revealed && (stage === "Cold" || stage === "Wary" || stage === "Engaged"))
    return "revealed_not_warm";
  if (stage === "Warm") return "warm";
  if (!turns.some((t) => t.signals.usesName && t.signals.mentionsBook)) return "weak_personal";
  if (!turns.some((t) => t.signals.value || t.signals.proof)) return "weak_value";
  if (!turns.some((t) => t.signals.questions > 0)) return "weak_question";
  if (turns.some((t) => t.signals.words > 220)) return "weak_length";
  return "default";
}

/* ------------------------------------------------------------- coaching */

const clamp10 = (n: number) => Math.max(0, Math.min(10, Math.round(n)));

export type CoachInput = {
  turns: Turn[];
  stage: Stage;
  strikes: number;
  lost: boolean;
  won: boolean;
  revealed: boolean;
};

export function coachScores(c: CoachInput) {
  const t = c.turns;
  const sig = (k: keyof Signals) => t.filter((x) => Boolean(x.signals[k])).length;

  let personalisation = 0;
  if (sig("usesName")) personalisation += 3;
  if (sig("mentionsBook")) personalisation += 3;
  const facts = sig("usesFacts");
  personalisation += facts >= 2 ? 4 : facts === 1 ? 2 : 0;
  personalisation -= 3 * sig("wrongFact");

  const value = 2 * sig("value") + 3 * sig("proof");

  let objection = 1;
  const revealAt = t.findIndex((x) => x.reaction === "objection_reveal");
  if (revealAt >= 0) {
    const next = t[revealAt + 1];
    objection = next && (next.signals.empathy || next.signals.value) ? 10 : 7;
  } else if (t.some((x) => x.reaction === "objection_hint")) objection = 4;
  objection -= 2 * c.strikes;

  let tone = 10;
  tone -= 2 * t.filter((x) => x.signals.template || x.signals.aiTells || x.signals.hype || x.signals.pressure).length;
  tone -= t.reduce((n, x) => n + x.signals.contractions + x.signals.longDashes, 0);
  tone -= t.filter((x) => x.signals.words > 220).length;

  const CLOSE: Record<Stage, number> = { Won: 10, Warm: 7, Engaged: 5, Wary: 3, Cold: 1 };
  let close = c.lost ? 0 : c.won ? 10 : CLOSE[c.stage];
  if (t.some((x) => x.priceEarly)) close -= 3;

  const scores = {
    personalisation: clamp10(personalisation),
    value: clamp10(value),
    objection: clamp10(objection),
    tone: clamp10(tone),
    close: clamp10(close),
  };
  const overall = Math.round(
    ((scores.personalisation + scores.value + scores.objection + scores.tone + scores.close) / 5) * 10,
  );
  const outcome: "won" | "warming" | "neutral" | "cooling" | "lost" = c.lost
    ? "lost"
    : c.won || c.stage === "Won"
      ? "won"
      : c.stage === "Warm"
        ? "warming"
        : c.stage === "Engaged"
          ? "neutral"
          : c.stage === "Wary"
            ? "cooling"
            : "lost";
  return { scores, overall, outcome };
}

/** Signals that earn a "What worked" line, most valuable first. */
export function workedSignals(c: CoachInput) {
  const t = c.turns;
  const out: string[] = [];
  if (t.some((x) => x.signals.objectionKey)) out.push("objectionKey");
  if (t.some((x) => x.signals.usesFacts)) out.push("usesFacts");
  if (t.some((x) => x.signals.proof)) out.push("proof");
  if (t.some((x) => x.signals.empathy)) out.push("empathy");
  if (t.some((x) => x.signals.value)) out.push("value");
  if (t.some((x) => x.signals.usesName && x.signals.mentionsBook)) out.push("personal");
  if (t.some((x) => x.signals.asksAboutThem)) out.push("asksAboutThem");
  if (t.some((x) => x.signals.questions === 1)) out.push("oneQuestion");
  return out;
}

/** Signals that earn a "What to change" line, most damaging first. */
export function changeSignals(c: CoachInput) {
  const t = c.turns;
  const any = (f: (x: Turn) => boolean) => t.some(f);
  const out: string[] = [];
  if (any((x) => x.signals.lowEffort)) out.push("lowEffort");
  if (any((x) => !!x.signals.wrongFact)) out.push("wrongFact");
  if (any((x) => x.signals.guarantee)) out.push("guarantee");
  if (any((x) => x.priceEarly)) out.push("priceTalk");
  if (any((x) => x.signals.template)) out.push("template");
  if (any((x) => x.signals.aiTells)) out.push("aiTells");
  if (any((x) => x.signals.pressure)) out.push("pressure");
  if (any((x) => x.signals.hype)) out.push("hype");
  if (any((x) => x.signals.repeatPitch)) out.push("repeatPitch");
  if (any((x) => x.signals.contractions > 0)) out.push("contractions");
  if (any((x) => x.signals.questions > 3)) out.push("tooManyQuestions");
  if (any((x) => x.signals.words > 220)) out.push("tooLong");
  if (!any((x) => x.signals.value || x.signals.proof)) out.push("noValue");
  if (!any((x) => x.signals.questions > 0)) out.push("noQuestion");
  if (!c.revealed) out.push("missedObjection");
  return out;
}

/** The reaction caused by the message with the biggest trust drop, if any. */
export function worstReaction(turns: Turn[]): Reaction | null {
  let worst: Turn | null = null;
  for (const t of turns) if (t.delta < 0 && (!worst || t.delta < worst.delta)) worst = t;
  return worst?.reaction ?? null;
}
