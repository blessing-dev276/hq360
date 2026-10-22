import { beforeEach, describe, expect, mock, test } from "bun:test";
import { fakeSupabase } from "./fixtures/fake-supabase";

// The tracker modules talk to Supabase through supabaseAdmin; point it at an
// in-memory fake so the security rules can be checked without a database.
let fake = fakeSupabase();
mock.module("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: new Proxy({}, { get: (_, prop) => Reflect.get(fake.client, prop) }),
}));

const keys = await import("../src/lib/trackers/ai-keys.server");
const ai = await import("../src/lib/trackers/ai.server");

const EXPERT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const EXPERT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const TRACKER_B = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const TRACKER_A = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const ITEM_A = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const A = { role: "expert" as const, expertId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" };
const B = { role: "expert" as const, expertId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" };
const ADMIN = { role: "admin" as const };
const KEY_A = "sk-ant-test-only-expert-a-0000000000001111";
const SNAPSHOT = { items: [], log: [{ date: "2026-10-14", text: "published before" }] };

const tracker = (id: string, expert: string) => ({
  id,
  expert_id: expert,
  client_name: "Hugh Murphy",
  client_email: "private-client@example.com",
  project_title: "Memories And Observations",
  package_name: "Premium package",
  slug: "hugh-murphy-7k2q",
  status: "live",
  portfolio_consent: false,
  consent_allows_naming: false,
  published_snapshot: SNAPSHOT,
});

beforeEach(() => {
  fake = fakeSupabase({
    client_trackers: [tracker(TRACKER_A, EXPERT_A), tracker(TRACKER_B, EXPERT_B)],
    tracker_items: [
      {
        id: ITEM_A,
        tracker_id: TRACKER_A,
        position: 2,
        title: "Page 1 ranking on 10 Goodreads lists",
        status: "progress",
        progress: 10,
        description: "Being added to ten lists.",
        portfolio_ready: false,
        portfolio_blurb: "",
      },
    ],
    tracker_log_entries: [],
  });
});

function provider(text: string, seen: { prompts: string[]; keys: string[] } = { prompts: [], keys: [] }) {
  return {
    seen,
    call: async (call: { apiKey: string; user: string; system: string }) => {
      seen.keys.push(call.apiKey);
      seen.prompts.push(`${call.system}\n${call.user}`);
      return { text, inputTokens: 120, outputTokens: 40 };
    },
  };
}

describe("key storage", () => {
  const secret = "test-only-master-key";
  test("keys are AES-256-GCM encrypted, randomised and bound to their expert", () => {
    const stored = keys.encryptAiKey(EXPERT_A, KEY_A, secret);
    expect(stored.startsWith("v1.")).toBe(true);
    expect(stored).not.toContain(KEY_A);
    expect(keys.encryptAiKey(EXPERT_A, KEY_A, secret)).not.toBe(stored);
    expect(keys.decryptAiKey(EXPERT_A, stored, secret)).toBe(KEY_A);
    expect(() => keys.decryptAiKey(EXPERT_B, stored, secret)).toThrow();
    expect(() => keys.decryptAiKey(EXPERT_A, stored, "wrong-master")).toThrow();
  });

  test("only the last four characters are ever shown again", async () => {
    expect(keys.lastFour(KEY_A)).toBe("1111");
    await keys.saveAiKey(A, "anthropic", KEY_A);
    const row = fake.tables.expert_ai_credentials![0]!;
    expect(row.encrypted_key).not.toContain(KEY_A);
    expect(row.last_four).toBe("1111");
    const status = await keys.aiKeyStatus(A);
    expect(JSON.stringify(status)).not.toContain(KEY_A);
    expect(status).toMatchObject({ configured: true, provider: "anthropic", lastFour: "1111" });
  });

  test("provider key formats are checked", () => {
    expect(keys.validProviderKey("anthropic", KEY_A)).toBe(true);
    expect(keys.validProviderKey("openai", "sk-proj-test-only-placeholder-0000")).toBe(true);
    expect(keys.validProviderKey("google", "AIza" + "x".repeat(35))).toBe(true);
    expect(keys.validProviderKey("google", KEY_A)).toBe(false);
  });
});

describe("provider requests run on the server with the key only in a header", () => {
  for (const name of ["anthropic", "openai", "google"] as const) {
    test(name, async () => {
      const fetcher = (async (url: string | URL, init?: RequestInit) => {
        expect(String(url)).not.toContain(KEY_A);
        expect(String(init?.body)).not.toContain(KEY_A);
        const headers = new Headers(init?.headers);
        expect([headers.get("x-api-key"), headers.get("authorization"), headers.get("x-goog-api-key")].join(" ")).toContain(KEY_A);
        const text = '{"text":"ok"}';
        return Response.json(
          name === "anthropic"
            ? { content: [{ type: "text", text }], usage: { input_tokens: 5, output_tokens: 2 } }
            : name === "openai"
              ? { choices: [{ message: { content: text } }], usage: { prompt_tokens: 5, completion_tokens: 2 } }
              : { candidates: [{ content: { parts: [{ text }] } }], usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 2 } },
        );
      }) as typeof fetch;
      const result = await ai.callProvider(
        { provider: name, apiKey: KEY_A, model: ai.DEFAULT_MODELS[name], system: "s", user: "u" },
        fetcher,
      );
      expect(result).toEqual({ text: '{"text":"ok"}', inputTokens: 5, outputTokens: 2 });
    });
  }

  test("a rejected key asks the expert to replace it", async () => {
    const fetcher = (async () => new Response("no", { status: 401 })) as unknown as typeof fetch;
    await expect(
      ai.callProvider({ provider: "openai", apiKey: KEY_A, model: "m", system: "s", user: "u" }, fetcher),
    ).rejects.toThrow("Replace it in Settings, AI");
  });
});

describe("no invented results", () => {
  test("figures and quotes the expert did not give are caught", () => {
    const notes = "Expert's notes: added to NI list, now #1";
    expect(ai.unsupportedClaims("The book is now number 1 on the Northern Ireland list.", notes)).toEqual({ figures: [], quotes: [] });
    expect(ai.unsupportedClaims("It reached #1 and 250 new readers.", notes).figures).toEqual(["250"]);
    expect(ai.unsupportedClaims('One reader said "this is the best memoir of the year".', notes).quotes).toHaveLength(1);
  });

  test("the prompt forbids inventing results, numbers, rankings and quotes", () => {
    expect(ai.SYSTEM_RULES).toMatch(/Never invent results, numbers, rankings, dates, prices or quotes/);
    expect(ai.SYSTEM_RULES).toMatch(/If a figure is not in the input, leave it out/);
  });
});

describe("AI assisted updates", () => {
  const draftJson = '{"log_entry":"Memories And Observations is now number 1 on the Northern Ireland list.","description":"The book is on the first of your ten lists."}';
  const notes = { notes: "added to NI list, now #1", itemId: ITEM_A };

  test("each expert's key is used only for that expert's trackers", async () => {
    const loaded: string[] = [];
    const p = provider(draftJson);
    const deps = {
      loadKey: async (actor: { role: string; expertId?: string }) => {
        const id = actor.expertId ?? actor.role;
        loaded.push(id);
        return id === EXPERT_A ? { provider: "anthropic" as const, key: KEY_A } : null;
      },
      call: p.call,
    };
    // Expert A trying to run AI on expert B's tracker: refused before any key is loaded.
    await expect(ai.runAiAction(A, TRACKER_B, "draft_update", notes, deps)).rejects.toThrow("Tracker not found");
    expect(loaded).toEqual([]);
    // Expert B has no key of their own and never borrows one.
    await expect(ai.runAiAction(B, TRACKER_B, "progress_summary", {}, deps)).rejects.toThrow("Add your own API key");
    expect(p.seen.keys).toEqual([]);
    await ai.runAiAction(A, TRACKER_A, "draft_update", notes, deps);
    expect(loaded).toEqual([EXPERT_B, EXPERT_A]);
    expect(p.seen.keys).toEqual([KEY_A]);
  });

  test("AI output is saved only as a draft; the tracker and the client page do not change", async () => {
    const p = provider(draftJson);
    const draft = await ai.runAiAction(A, TRACKER_A, "draft_update", notes, {
      loadKey: async () => ({ provider: "anthropic", key: KEY_A }),
      call: p.call,
    });
    expect(draft).toMatchObject({ action: "draft_update", status: "pending" });
    expect(fake.tables.tracker_ai_drafts).toHaveLength(1);
    expect(fake.tables.tracker_log_entries).toHaveLength(0);
    expect(fake.tables.tracker_items![0]!.description).toBe("Being added to ten lists.");
    expect(fake.tables.client_trackers![0]!.published_snapshot).toEqual(SNAPSHOT);
    const writes = fake.calls.filter((c) => c.op !== "select").map((c) => c.table);
    expect(new Set(writes)).toEqual(new Set(["tracker_ai_drafts", "expert_ai_usage"]));
    // Usage is logged with date, tracker, action and token count.
    expect(fake.tables.expert_ai_usage![0]).toMatchObject({
      expert_id: EXPERT_A,
      tracker_id: TRACKER_A,
      action: "draft_update",
      input_tokens: 120,
      output_tokens: 40,
      ok: true,
    });
    // Private client details are never sent to the provider.
    expect(p.seen.prompts.join("\n")).not.toContain("private-client@example.com");
  });

  test("a draft with an invented figure is not saved", async () => {
    const p = provider('{"log_entry":"Now number 1 with 300 votes.","description":"On page one."}');
    await expect(
      ai.runAiAction(A, TRACKER_A, "draft_update", notes, {
        loadKey: async () => ({ provider: "anthropic", key: KEY_A }),
        call: p.call,
      }),
    ).rejects.toThrow("figure or quote you did not give");
    expect(fake.tables.tracker_ai_drafts ?? []).toHaveLength(0);
    expect(fake.tables.expert_ai_usage![0]).toMatchObject({ ok: false });
  });

  test("approving a draft updates the working copy only; publishing is still a separate step", async () => {
    const draft = await ai.runAiAction(A, TRACKER_A, "draft_update", notes, {
      loadKey: async () => ({ provider: "anthropic", key: KEY_A }),
      call: provider(draftJson).call,
    });
    // Another expert cannot approve it.
    await expect(ai.approveDraft(B, TRACKER_A, draft!.id as string)).rejects.toThrow("Tracker not found");
    await ai.approveDraft(A, TRACKER_A, draft!.id as string);
    expect(fake.tables.tracker_ai_drafts![0]).toMatchObject({ status: "approved", approved_by: EXPERT_A });
    expect(fake.tables.tracker_log_entries![0]).toMatchObject({ source: "ai" });
    expect(fake.tables.tracker_items![0]!.description).toBe("The book is on the first of your ten lists.");
    expect(fake.tables.client_trackers![0]!.published_snapshot).toEqual(SNAPSHOT);
    await expect(ai.approveDraft(A, TRACKER_A, draft!.id as string)).rejects.toThrow("already handled");
  });
});

describe("admin", () => {
  const ADMIN_KEY = "sk-ant-test-only-admin-key-000000000000aaaa";
  const draftJson = '{"log_entry":"Memories And Observations is now number 1 on the Northern Ireland list.","description":"On the first of ten lists."}';

  test("admin has its own key, stored apart from every expert's", async () => {
    await keys.saveAiKey(ADMIN, "anthropic", ADMIN_KEY);
    expect(fake.tables.admin_ai_credentials![0]).toMatchObject({ id: "admin", last_four: "aaaa" });
    expect(fake.tables.expert_ai_credentials ?? []).toHaveLength(0);
    expect(fake.tables.admin_ai_credentials![0]!.encrypted_key).not.toContain(ADMIN_KEY);
    expect(await keys.aiKeyStatus(A)).toEqual({ configured: false });
  });

  test("admin can draft on any expert's tracker, with admin's key only", async () => {
    const used: unknown[] = [];
    const p = provider('{"text":"The website is in progress."}');
    for (const trackerId of [TRACKER_A, TRACKER_B]) {
      await ai.runAiAction(ADMIN, trackerId, "progress_summary", {}, {
        loadKey: async (actor) => {
          used.push(actor);
          return actor.role === "admin" ? { provider: "anthropic", key: ADMIN_KEY } : null;
        },
        call: p.call,
      });
    }
    expect(used).toEqual([ADMIN, ADMIN]);
    expect(p.seen.keys).toEqual([ADMIN_KEY, ADMIN_KEY]);
    expect(fake.tables.expert_ai_usage!.every((u) => u.actor === "admin" && u.expert_id === null)).toBe(true);
  });

  test("admin approval is recorded as admin and still does not publish", async () => {
    const draft = await ai.runAiAction(ADMIN, TRACKER_A, "draft_update", { notes: "added to NI list, now #1", itemId: ITEM_A }, {
      loadKey: async () => ({ provider: "anthropic", key: ADMIN_KEY }),
      call: provider(draftJson).call,
    });
    await ai.approveDraft(ADMIN, TRACKER_A, draft!.id as string);
    expect(fake.tables.tracker_ai_drafts![0]).toMatchObject({ status: "approved", approved_by: null, approved_by_admin: true });
    expect(fake.tables.tracker_log_entries![0]).toMatchObject({ source: "ai", author_id: null });
    expect(fake.tables.client_trackers![0]!.published_snapshot).toEqual(SNAPSHOT);
  });
});