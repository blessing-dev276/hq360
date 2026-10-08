// Practice progress, computed from a person's chats (nothing is stored):
// level ladder, rank, streak, daily missions and the certificate.

export const LEVELS = ["easy", "medium", "hard", "extreme"] as const;
export type Level = (typeof LEVELS)[number];
/** Finished chats scoring at least this, on the level below, unlock a level. */
export const UNLOCK_SCORE = 70;
export const UNLOCK_COUNT = 2;
const WEIGHT: Record<Level, number> = { easy: 1, medium: 1.5, hard: 2, extreme: 3 };
export const RANKS = [
  { name: "Rookie Scout", points: 0 },
  { name: "Scout", points: 50 },
  { name: "Senior Scout", points: 150 },
  { name: "Lead Scout", points: 350 },
  { name: "Elite Scout", points: 700 },
] as const;

export type ChatFact = {
  difficulty: string;
  mode: "cold" | "no";
  ended: boolean;
  /** ISO time the chat was scored. */
  endedAt: string | null;
  overall: number | null;
  outcome: string | null;
};

export type Mission = { id: string; label: string; done: boolean; progress: string };

const levelOf = (d: string): Level =>
  (LEVELS as readonly string[]).includes(d) ? (d as Level) : "medium";
/** Day key in the viewer's local time (offset in minutes, like getTimezoneOffset). */
export const dayKey = (iso: string, offsetMinutes: number) =>
  new Date(new Date(iso).getTime() - offsetMinutes * 60_000).toISOString().slice(0, 10);
const prevDay = (key: string) =>
  new Date(Date.parse(`${key}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);

function hash(text: string) {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

export function computeProgress(
  chats: ChatFact[],
  opts: { userId: string; now: Date; offsetMinutes: number; trainer?: boolean },
) {
  const finished = chats.filter((c) => c.ended && c.overall != null && c.endedAt);
  const today = dayKey(opts.now.toISOString(), opts.offsetMinutes);

  // Ladder.
  const levels = LEVELS.map((level, i) => {
    const mine = finished.filter((c) => levelOf(c.difficulty) === level);
    const below = i === 0 ? [] : finished.filter((c) => levelOf(c.difficulty) === LEVELS[i - 1]);
    const strong = below.filter((c) => (c.overall ?? 0) >= UNLOCK_SCORE).length;
    return {
      level,
      unlocked: !!opts.trainer || i === 0 || strong >= UNLOCK_COUNT,
      need: i === 0 ? 0 : Math.max(0, UNLOCK_COUNT - strong),
      finished: mine.length,
      best: mine.length ? Math.max(...mine.map((c) => c.overall ?? 0)) : null,
      average: mine.length
        ? Math.round(mine.reduce((n, c) => n + (c.overall ?? 0), 0) / mine.length)
        : null,
      wins: mine.filter((c) => c.outcome === "won").length,
    };
  });
  // A level only counts as unlocked if every level below it is too.
  for (let i = 1; i < levels.length; i++)
    if (!levels[i - 1]!.unlocked) levels[i]!.unlocked = !!opts.trainer;
  const highest = [...levels].reverse().find((l) => l.unlocked)!.level;

  // Rank.
  const points = Math.round(
    finished.reduce((n, c) => n + ((c.overall ?? 0) * WEIGHT[levelOf(c.difficulty)]) / 10, 0),
  );
  const rankIndex = RANKS.reduce((idx, r, i) => (points >= r.points ? i : idx), 0);
  const next = RANKS[rankIndex + 1] ?? null;

  // Streak: consecutive days with a finished chat, ending today or yesterday.
  const days = new Set(finished.map((c) => dayKey(c.endedAt!, opts.offsetMinutes)));
  let current = 0;
  for (let d = days.has(today) ? today : prevDay(today); days.has(d); d = prevDay(d)) current++;
  let best = 0;
  for (const d of days) {
    if (days.has(prevDay(d))) continue;
    let run = 0;
    for (
      let x = d;
      days.has(x);
      x = new Date(Date.parse(`${x}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)
    )
      run++;
    best = Math.max(best, run);
  }

  // Daily missions: "finish a chat" plus two picked per person per day.
  const todays = finished.filter((c) => dayKey(c.endedAt!, opts.offsetMinutes) === today);
  const pool: Mission[] = [
    {
      id: "three",
      label: "Finish 3 chats",
      done: todays.length >= 3,
      progress: `${Math.min(todays.length, 3)}/3`,
    },
    {
      id: "score70",
      label: "Score 70+ in a chat",
      done: todays.some((c) => (c.overall ?? 0) >= 70),
      progress: `best ${todays.length ? Math.max(...todays.map((c) => c.overall ?? 0)) : 0}`,
    },
    {
      id: "win",
      label: "Win an author over",
      done: todays.some((c) => c.outcome === "won"),
      progress: todays.some((c) => c.outcome === "won") ? "won" : "not yet",
    },
    {
      id: "recover",
      label: "Turn a “They said no” into warming or won",
      done: todays.some((c) => c.mode === "no" && (c.outcome === "won" || c.outcome === "warming")),
      progress: "",
    },
    {
      id: "top",
      label: `Finish a chat on ${highest[0]!.toUpperCase()}${highest.slice(1)}`,
      done: todays.some((c) => levelOf(c.difficulty) === highest),
      progress: "",
    },
  ];
  const seed = hash(`${opts.userId}:${today}`);
  const first = pool[seed % pool.length]!;
  const rest = pool.filter((m) => m !== first);
  const missions: Mission[] = [
    {
      id: "one",
      label: "Finish a chat today",
      done: todays.length >= 1,
      progress: `${Math.min(todays.length, 1)}/1`,
    },
    first,
    rest[(seed >> 8) % rest.length]!,
  ];

  // Certificate: a strong result against an Extreme author.
  const extreme = finished
    .filter((c) => levelOf(c.difficulty) === "extreme" && (c.overall ?? 0) >= UNLOCK_SCORE)
    .sort((a, b) => a.endedAt!.localeCompare(b.endedAt!));

  return {
    levels,
    highest,
    rank: {
      name: RANKS[rankIndex]!.name,
      points,
      next: next ? { name: next.name, points: next.points } : null,
      floor: RANKS[rankIndex]!.points,
    },
    streak: { current, best: Math.max(best, current), practicedToday: days.has(today) },
    missions,
    totals: {
      chats: chats.length,
      finished: finished.length,
      average: finished.length
        ? Math.round(finished.reduce((n, c) => n + (c.overall ?? 0), 0) / finished.length)
        : null,
      wins: finished.filter((c) => c.outcome === "won").length,
    },
    certificate: extreme.length ? { earnedAt: extreme[0]!.endedAt! } : null,
  };
}
export type Progress = ReturnType<typeof computeProgress>;
