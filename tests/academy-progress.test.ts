import { expect, test } from "bun:test";
import { computeProgress, type ChatFact } from "../src/lib/academy/progress";

const now = new Date("2026-10-09T15:00:00Z");
const chat = (
  difficulty: string,
  overall: number,
  day: string,
  extra: Partial<ChatFact> = {},
): ChatFact => ({
  difficulty,
  mode: "cold",
  ended: true,
  endedAt: `${day}T12:00:00Z`,
  overall,
  outcome: overall >= 80 ? "won" : "warming",
  ...extra,
});
const run = (chats: ChatFact[], trainer = false) =>
  computeProgress(chats, { userId: "u1", now, offsetMinutes: 0, trainer });

test("ladder: two 70+ chats on a level unlock the next, in order", () => {
  expect(run([]).levels.map((l) => l.unlocked)).toEqual([true, false, false, false]);
  const one = run([chat("easy", 75, "2026-10-09")]);
  expect(one.levels[1]).toMatchObject({ unlocked: false, need: 1 });
  const two = run([
    chat("easy", 75, "2026-10-09"),
    chat("easy", 90, "2026-10-08"),
    chat("easy", 40, "2026-10-08"),
  ]);
  expect(two.levels.map((l) => l.unlocked)).toEqual([true, true, false, false]);
  expect(two.highest).toBe("medium");
  // Hard chats can't unlock Extreme while Medium is still locked.
  expect(
    run([chat("hard", 90, "2026-10-09"), chat("hard", 90, "2026-10-09")]).levels[3]!.unlocked,
  ).toBe(false);
  expect(run([], true).levels.every((l) => l.unlocked)).toBe(true);
});

test("streak counts consecutive days ending today or yesterday", () => {
  const p = run([
    chat("easy", 50, "2026-10-08"),
    chat("easy", 50, "2026-10-07"),
    chat("easy", 50, "2026-10-05"),
  ]);
  expect(p.streak).toEqual({ current: 2, best: 2, practicedToday: false });
  expect(run([chat("easy", 50, "2026-10-09"), chat("easy", 50, "2026-10-08")]).streak.current).toBe(
    2,
  );
  expect(run([chat("easy", 50, "2026-10-06")]).streak.current).toBe(0);
});

test("missions: finish-a-chat first, three per day, stable for the day", () => {
  const p = run([chat("easy", 85, "2026-10-09")]);
  expect(p.missions).toHaveLength(3);
  expect(p.missions[0]).toMatchObject({ id: "one", done: true });
  expect(new Set(p.missions.map((m) => m.id)).size).toBe(3);
  expect(run([chat("easy", 85, "2026-10-09")]).missions.map((m) => m.id)).toEqual(
    p.missions.map((m) => m.id),
  );
});

test("rank grows with weighted scores; certificate needs Extreme 70+", () => {
  expect(run([]).rank.name).toBe("Rookie Scout");
  const p = run(Array.from({ length: 4 }, () => chat("extreme", 80, "2026-10-09")));
  expect(p.rank.points).toBe(96);
  expect(p.rank.name).toBe("Scout");
  expect(p.certificate?.earnedAt).toBe("2026-10-09T12:00:00Z");
  expect(run([chat("extreme", 60, "2026-10-09")]).certificate).toBeNull();
});
