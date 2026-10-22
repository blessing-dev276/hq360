import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import {
  buildSnapshot,
  fileKind,
  normaliseProgress,
  overallProgress,
  snapshotFileIds,
  type TrackerItemRow,
} from "../src/lib/trackers/core";
import {
  dailyVisitorHash,
  generatePasscode,
  hashPasscode,
  isUnlocked,
  lockoutKey,
  normalisePasscode,
  trackerSlug,
  unlockCookieName,
  unlockCookieValue,
  userAgentFamily,
  validPasscode,
  verifyPasscode,
  visitorCountry,
} from "../src/lib/trackers/security.server";
import { completionLogText, summariseViews } from "../src/lib/trackers/service.server";
import { GOODREADS_LISTS, HUGH_FILE_NAMES, HUGH_ITEMS, HUGH_LOG } from "../src/lib/trackers/hugh-seed";

const secret = "test-only-tracker-secret";
const FAST = 4; // bcrypt cost for tests only; production uses BCRYPT_COST (12)

describe("passcodes", () => {
  test("are stored only as bcrypt hashes and verify regardless of case, spaces and hyphens", async () => {
    const stored = await hashPasscode("HARBOR-5521", FAST);
    expect(stored).toMatch(/^\$2[aby]\$\d{2}\$.{53}$/);
    expect(stored).not.toContain("HARBOR");
    expect(stored).not.toContain("5521");
    expect(await verifyPasscode("HARBOR5521", stored)).toBe(true);
    expect(await verifyPasscode("harbor-5521", stored)).toBe(true);
    expect(await verifyPasscode(" HARBOR 5521 ", stored)).toBe(true);
    expect(await verifyPasscode("HARBOR5522", stored)).toBe(false);
    expect(await verifyPasscode("", stored)).toBe(false);
    expect(await verifyPasscode("HARBOR5521", null)).toBe(false);
  });

  test("hashes are salted, so the same passcode never gives the same stored value", async () => {
    expect(await hashPasscode("RIVER-1234", FAST)).not.toBe(await hashPasscode("RIVER-1234", FAST));
  });

  test("generated passcodes use the WORD-1234 format", () => {
    for (let i = 0; i < 50; i += 1) {
      const code = generatePasscode();
      expect(code).toMatch(/^[A-Z]+-\d{4}$/);
      expect(validPasscode(code)).toBe(true);
    }
  });

  test("rejects passcodes that are too short or use symbols", async () => {
    expect(validPasscode("abc")).toBe(false);
    expect(validPasscode("pass word!")).toBe(false);
    expect(normalisePasscode("ab-cd ef")).toBe("ABCDEF");
    await expect(hashPasscode("abc", FAST)).rejects.toThrow();
  });
});

describe("links", () => {
  test("follow {client-slug}-{4 random characters}", () => {
    expect(trackerSlug("Hugh Murphy", "7k2q")).toBe("hugh-murphy-7k2q");
    expect(trackerSlug("Siobhán O'Neill-Brady")).toMatch(/^siobhan-o-neill-brady-[a-z0-9]{4}$/);
    expect(trackerSlug("!!!")).toMatch(/^client-[a-z0-9]{4}$/);
    const many = new Set(Array.from({ length: 200 }, () => trackerSlug("Same Name")));
    expect(many.size).toBeGreaterThan(190); // the random part varies
  });
});

describe("unlock cookie", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  const now = Date.UTC(2026, 9, 20, 12);
  const cookie = (value: string) => `other=1; ${unlockCookieName(id)}=${value}`;

  test("keeps the client signed in on that device for 30 days", () => {
    const value = unlockCookieValue(id, 1, now, secret);
    expect(isUnlocked(cookie(value), id, 1, now, secret)).toBe(true);
    expect(isUnlocked(cookie(value), id, 1, now + 29 * 86400_000, secret)).toBe(true);
    expect(isUnlocked(cookie(value), id, 1, now + 30 * 86400_000 + 1000, secret)).toBe(false);
  });

  test("stops working after a passcode reset, for another tracker, or when tampered with", () => {
    const value = unlockCookieValue(id, 1, now, secret);
    expect(isUnlocked(cookie(value), id, 2, now, secret)).toBe(false);
    expect(isUnlocked(cookie(value), "22222222-2222-4222-8222-222222222222", 1, now, secret)).toBe(false);
    const [v, exp, sig] = value.split(".");
    expect(isUnlocked(cookie(`${v}.${Number(exp) + 9999999}.${sig}`), id, 1, now, secret)).toBe(false);
    expect(isUnlocked(cookie(value), id, 1, now, "another-secret")).toBe(false);
    expect(isUnlocked("", id, 1, now, secret)).toBe(false);
  });
});

describe("view tracking privacy", () => {
  const request = (ip: string, agent = "Mozilla/5.0 Chrome/130.0 Safari/537.36") =>
    new Request("https://hq360.space/api/track/x", {
      headers: { "cf-connecting-ip": ip, "user-agent": agent, "cf-ipcountry": "gb" },
    });

  test("unique visitors use a daily rotating hash that never contains the IP address", () => {
    const day1 = new Date("2026-10-20T10:00:00Z");
    const later = new Date("2026-10-20T23:00:00Z");
    const day2 = new Date("2026-10-21T10:00:00Z");
    const a = dailyVisitorHash(request("203.0.113.9"), "t1", day1, secret);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
    expect(a).not.toContain("203.0.113.9");
    expect(dailyVisitorHash(request("203.0.113.9"), "t1", later, secret)).toBe(a);
    expect(dailyVisitorHash(request("203.0.113.9"), "t1", day2, secret)).not.toBe(a);
    expect(dailyVisitorHash(request("198.51.100.4"), "t1", day1, secret)).not.toBe(a);
  });

  test("lockout key is stable for a visitor but is not the address", () => {
    const key = lockoutKey(request("203.0.113.9"), "t1", secret);
    expect(key).toBe(lockoutKey(request("203.0.113.9"), "t1", secret));
    expect(key).not.toContain("203");
    expect(key).not.toBe(lockoutKey(request("203.0.113.9"), "t2", secret));
  });

  test("records only a browser family and a country code", () => {
    expect(userAgentFamily("Mozilla/5.0 (iPhone) Version/18 Mobile Safari/604.1")).toBe("Safari Mobile");
    expect(userAgentFamily("Mozilla/5.0 Chrome/130.0 Edg/130.0")).toBe("Edge");
    expect(userAgentFamily(null)).toBe("Unknown");
    expect(visitorCountry(request("1.1.1.1"))).toBe("GB");
  });
});

const item = (patch: Partial<TrackerItemRow>): TrackerItemRow => ({
  id: crypto.randomUUID(),
  position: 0,
  title: "Item",
  status: "next",
  progress: 0,
  description: "",
  is_free_bonus: false,
  blocks: {},
  ...patch,
});

describe("progress", () => {
  test("the ring averages paid items only; free bonus items are excluded", () => {
    expect(overallProgress([item({ progress: 50 }), item({ progress: 100, is_free_bonus: true })])).toBe(50);
    expect(overallProgress([item({ progress: 100, is_free_bonus: true })])).toBe(0);
    expect(normaliseProgress("done", 40)).toBe(100);
    expect(normaliseProgress("progress", 140)).toBe(100);
  });

  test("Hugh's tracker gives 25% today, as the spec says", () => {
    expect(overallProgress(HUGH_ITEMS.map((seed) => item(seed)))).toBe(25);
    expect(HUGH_ITEMS.filter((i) => i.is_free_bonus).map((i) => i.title)).toEqual([
      "Press kit",
      "Suspense teaser: The File",
      "Book trailer",
    ]);
  });
});

describe("client snapshot", () => {
  test("contains only what the client may see, with the log newest first", () => {
    const a = item({ title: "Website", progress: 65, status: "progress", position: 1, portfolio_ready: true });
    const b = item({ title: "Press kit", status: "done", progress: 100, position: 0, is_free_bonus: true });
    const snapshot = buildSnapshot({
      tracker: { client_name: "Hugh Murphy", project_title: "Memories", package_name: "Premium" },
      expert: { name: "Emmanuel Sunday", email: "expert@example.com" },
      items: [a, b],
      files: [{ id: "f1", item_id: b.id, kind: "pdf", filename: "kit.pdf", size: 10, position: 0 }],
      log: [
        { id: "1", entry_date: "2026-10-14", text: "old", created_at: "2026-10-14T01:00:00Z" },
        { id: "2", entry_date: "2026-10-20", text: "new", created_at: "2026-10-20T01:00:00Z" },
      ],
    });
    expect(snapshot.items.map((i) => i.title)).toEqual(["Press kit", "Website"]);
    expect(snapshot.log.map((l) => l.text)).toEqual(["new", "old"]);
    expect(snapshot.overall).toBe(65);
    const text = JSON.stringify(snapshot);
    for (const forbidden of ["passcode", "portfolio", "client_email", "blurb"]) expect(text).not.toContain(forbidden);
    expect(snapshotFileIds(snapshot).has("f1")).toBe(true);
    expect(snapshotFileIds(snapshot).has("unpublished")).toBe(false);
  });
});

describe("manual updates", () => {
  test("completing an item writes the log line automatically", () => {
    expect(completionLogText("Press kit")).toBe("Press kit completed.");
    expect(completionLogText("book trailer.")).toBe("Book trailer completed.");
  });

  test("file kinds come from the type", () => {
    expect(fileKind("image/png", "a.png")).toBe("image");
    expect(fileKind("video/mp4", "a.mp4")).toBe("video");
    expect(fileKind("application/octet-stream", "kit.PDF")).toBe("pdf");
  });
});

describe("view stats", () => {
  test("counts opens, unique visitors, unlocks, fails, last viewed and engagement per item", () => {
    const now = new Date("2026-10-20T15:00:00Z");
    const stats = summariseViews(
      [
        { event: "open", item_id: null, visitor_hash: "a", created_at: "2026-10-20T14:52:00Z" },
        { event: "unlock", item_id: null, visitor_hash: "a", created_at: "2026-10-20T14:52:00Z" },
        { event: "open", item_id: null, visitor_hash: "a", created_at: "2026-10-19T10:00:00Z" },
        { event: "open", item_id: null, visitor_hash: "b", created_at: "2026-10-18T10:00:00Z" },
        { event: "fail", item_id: null, visitor_hash: "c", created_at: "2026-10-18T09:00:00Z" },
        { event: "play", item_id: "trailer", visitor_hash: "a", created_at: "2026-10-20T14:53:00Z" },
        { event: "download", item_id: "kit", visitor_hash: "a", created_at: "2026-10-20T14:54:00Z" },
        { event: "open", item_id: null, visitor_hash: "z", created_at: "2026-10-01T10:00:00Z" },
      ],
      now,
    );
    expect(stats.opensThisWeek).toBe(3);
    expect(stats.uniqueVisitorsThisWeek).toBe(2);
    expect(stats.unlocksThisWeek).toBe(1);
    expect(stats.failedThisWeek).toBe(1);
    expect(stats.lastViewedAt).toBe("2026-10-20T14:52:00Z");
    expect(stats.engagement).toEqual({ trailer: { plays: 1, downloads: 0 }, kit: { plays: 0, downloads: 1 } });
    expect(stats.byDay).toHaveLength(14);
    expect(stats.byDay.at(-1)).toEqual({ day: "2026-10-20", opens: 1 });
  });
});

describe("Hugh Murphy migration data", () => {
  test("matches section 7 of the spec", () => {
    expect(HUGH_ITEMS).toHaveLength(8);
    expect(GOODREADS_LISTS).toHaveLength(10);
    expect(GOODREADS_LISTS[0]).toEqual(["Northern Ireland", "#1 on page one"]);
    expect(HUGH_LOG).toHaveLength(8);
    expect(HUGH_LOG[0]!.text).toBe("Four social media graphics designed and ready for your approval.");
    expect([...HUGH_FILE_NAMES].sort()).toEqual(
      [
        "trailer-m7q2x9.mp4",
        "teaser-r3v8n1.mp4",
        "press-kit-k4p8.pdf",
        "goodreads-ni-r1.jpg",
        "gfx-1-q7.png",
        "gfx-2-q7.png",
        "gfx-3-q7.png",
        "gfx-4-q7.png",
      ].sort(),
    );
    const goodreads = HUGH_ITEMS.find((i) => i.key === "goodreads")!;
    expect(goodreads.blocks.highlight?.text).toBe("First result: number 1 on the Northern Ireland list");
  });

  test("the repository never holds the client's passcode in plain text", async () => {
    for (const file of ["../src/lib/trackers/hugh-seed.ts", "../scripts/seed-hugh-tracker.ts"]) {
      const text = await readFile(new URL(file, import.meta.url), "utf8");
      // No WORD-1234 or WORD1234 shaped literal: the passcode comes from HUGH_PASSCODE only.
      expect(text).not.toMatch(/\b[A-Z]{4,}-?\d{4}\b/);
      if (process.env.HUGH_PASSCODE) expect(text).not.toContain(process.env.HUGH_PASSCODE);
    }
  });
});
