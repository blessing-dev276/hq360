// Isolated mocks: never writes real contacts or sends messages.
import { mock } from "bun:test";
import assert from "node:assert/strict";
let owner: string | null = "expert-a";
let allowed = true;
let visible = true;
let calls = 0;
const authorId = "00000000-0000-4000-8000-000000000001";
const bookId = "00000000-0000-4000-8000-000000000002";
const draftId = "00000000-0000-4000-8000-000000000003";
const tables: Record<string, Record<string, unknown>[]> = {
  scout_authors: [
    {
      id: authorId,
      name: "Jane Author",
      bio: null,
      contact_email: "jane@example.com",
      contact_emails: [],
    },
  ],
  scout_discovered_books: [
    { id: bookId, scout_author_id: authorId, title: "A Book", description: null },
  ],
  scout_outreach_settings: [],
  scout_author_message_drafts: [],
};
function from(table: string) {
  const filters: [string, unknown][] = [];
  let update: Record<string, unknown> | null = null;
  const q = {
    select: () => q,
    order: () => q,
    limit: () => q,
    eq: (key: string, value: unknown) => {
      filters.push([key, value]);
      return q;
    },
    insert: (row: Record<string, unknown>) => {
      tables[table]!.push({ id: draftId, ...row });
      return q;
    },
    update: (row: Record<string, unknown>) => {
      update = row;
      return q;
    },
    upsert: async (row: Record<string, unknown>) => {
      tables[table] = [...tables[table]!.filter((r) => r.owner !== row.owner), row];
      return { error: null };
    },
    maybeSingle: async () => {
      const row = tables[table]!.find((r) => filters.every(([k, v]) => r[k] === v));
      if (row && update) Object.assign(row, update);
      return { data: row ?? null, error: null };
    },
    single: async () => q.maybeSingle(),
  };
  return q;
}
mock.module("../src/integrations/supabase/client.server", () => ({ supabaseAdmin: { from } }));
mock.module("../src/lib/scout/owner.server", () => ({
  resolveScoutAccess: async () => (owner ? { role: "expert", expertId: owner, owner } : null),
  canFindContacts: async () => allowed,
  canSeeAuthor: async () => visible,
}));
mock.module("../src/lib/perplexity/credentials.server", () => ({
  keyForSearch: async () => "test-only",
}));
mock.module("../src/lib/perplexity/agent.server", () => ({
  PerplexityError: class extends Error {},
  runAgent: async () => {
    calls++;
    return { text: JSON.stringify({ subject: "A Book", body: "Hello Jane" }) };
  },
}));
const { outreachHandler } = await import("../src/routes/api/admin/scout-outreach");
const call = (body?: object, origin = "http://localhost") =>
  outreachHandler(
    new Request("http://localhost/api/admin/scout-outreach", {
      method: body ? "POST" : "GET",
      headers: { origin, "content-type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }),
  );
assert.equal((await call({ action: "save_prompt", prompt: "Our prompt" })).status, 200);
assert.equal((await (await call()).json()).prompt, "Our prompt");
owner = "expert-b";
assert.notEqual((await (await call()).json()).prompt, "Our prompt");
owner = "expert-a";
const input = { action: "draft", authorId, bookId, recipient: "jane@example.com" };
assert.equal((await call({ ...input, recipient: "other@example.com" })).status, 400);
assert.equal(calls, 0);
assert.equal((await call(input, "https://foreign.example")).status, 403);
visible = false;
assert.equal((await call(input)).status, 404);
visible = true;
const generated = await (await call(input)).json();
assert.equal(generated.draft.subject, "A Book");
assert.equal(calls, 1);
assert.equal((await (await call({ ...input, action: "load" })).json()).draft.id, draftId);
assert.equal(calls, 1);
owner = "expert-b";
assert.equal((await (await call({ ...input, action: "load" })).json()).draft, null);
assert.equal(
  (await call({ action: "save_draft", id: draftId, subject: "Hijacked", body: "Text" })).status,
  404,
);
owner = "expert-a";
assert.equal(
  (await call({ action: "save_draft", id: draftId, subject: "Edited", body: "New text" })).status,
  200,
);
assert.equal((await (await call({ ...input, action: "load" })).json()).draft.subject, "Edited");
assert.equal((await call({ ...input, owner: "expert-b" })).status, 400);
allowed = false;
assert.equal((await call()).status, 403);
owner = null;
assert.equal((await call()).status, 401);
console.log(
  "PASS: prompt/draft workspace isolation, recipient and author validation, saved edits, cached draft loading, origin and authorization checks.",
);
