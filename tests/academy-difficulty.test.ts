import { expect, test } from "bun:test";
import { analyse, DIFFICULTIES, decide, scoreMessage, startingTrust } from "../src/lib/academy/engine.server";
import { findPersona } from "../src/lib/academy/practice-data.server";

const margaret = findPersona("margaret-doyle")!;
const good =
  "Hi Margaret, I read the opening of The Lighthouse Keeper's Daughter and noticed it has 12 ratings averaging 4.6 but no website. I found one free fix you can check yourself. Would a screenshot help?";

test("harder levels start colder and score the same message lower", () => {
  expect(startingTrust("skeptic", "cold", "curious but cautious", "easy")).toBeGreaterThan(
    startingTrust("skeptic", "cold", "curious but cautious", "extreme"),
  );
  const s = analyse(good, margaret, []);
  const ctx = { style: "skeptic", trust: 20, objectionRevealed: false, authorAskedLastTurn: false };
  expect(scoreMessage(s, { ...ctx, difficulty: "easy" }).delta).toBeGreaterThan(
    scoreMessage(s, { ...ctx, difficulty: "extreme" }).delta,
  );
});

test("a short follow-up naming the author is not low effort; a short first message is", () => {
  const first = analyse("Hi Margaret, quick question?", margaret, []);
  expect(first.lowEffort).toBe(true);
  const follow = analyse("Hi Margaret, just bringing this back up. Any thoughts?", margaret, [
    { role: "scout", text: good },
    { role: "author", text: "[No reply]" },
  ]);
  expect(follow.lowEffort).toBe(false);
});

test("new author types react in character", () => {
  const s = analyse(good, margaret, []);
  const base = { mood: "curious but cautious", stage: "Cold" as const, trust: 10, strikes: 0, objectionRevealed: false, lost: false, won: false, lastReaction: null, priceEarly: false };
  expect(decide({ ...s, objectionKey: false }, { ...base, style: "skeptic" })).toBe("trust_issue");
  expect(decide({ ...s, objectionKey: false }, { ...base, style: "broke" })).toBe("no_budget");
  expect(decide({ ...s, objectionKey: false }, { ...base, style: "broke", priceEarly: true })).toBe("no_budget");
  expect(DIFFICULTIES.extreme.silent[1]).toBe(3);
  expect(DIFFICULTIES.easy.silent[1]).toBe(0);
});
