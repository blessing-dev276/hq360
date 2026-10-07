import { test, expect } from "bun:test";
import { personalizeAuthorMessage, OUTREACH_MODEL } from "../src/lib/scout/outreach.server";
import { findAuthorContacts } from "../src/lib/scout/perplexity-contact.server";
import type { AgentRequest } from "../src/lib/perplexity/agent.server";
const response = (contacts: unknown[] = [], identity_match = true) => ({
  id: "test",
  httpStatus: 200,
  text: JSON.stringify({ identity_match, summary: "test", contacts }),
  sources: [],
  citations: [],
});
const noFetch = (async () => new Response("", { status: 404 })) as typeof fetch;
test("draft uses requested Luna model, user's key and prompt without paid web tools", async () => {
  const draft = await personalizeAuthorMessage(
    { author: "Jane Author", title: "Book", description: null, bio: null },
    "Keep it brief",
    "test-key",
    async (request, _fetcher, credentials) => {
      expect(request.model).toBe(OUTREACH_MODEL);
      expect(request.tools).toEqual([]);
      expect(request.max_steps).toBe(1);
      expect(request.input).toContain("Keep it brief");
      expect(request.input).not.toContain("test-key");
      expect(credentials?.apiKey).toBe("test-key");
      return { ...response(), text: JSON.stringify({ subject: "Your book", body: "Hello Jane" }) };
    },
  );
  expect(draft.subject).toBe("Your book");
});
test("invalid personalized output cannot be used as a draft", async () => {
  await expect(
    personalizeAuthorMessage(
      { author: "A", title: "B", description: null, bio: null },
      "prompt",
      "test",
      async () => ({ ...response(), text: '{"subject":"Injected\\nHeader","body":"hello"}' }),
    ),
  ).rejects.toThrow("valid message");
});
test("unresolved search covers three different bounded stages", async () => {
  const requests: AgentRequest[] = [];
  const result = await findAuthorContacts(
    { author: "Jane Author", book: "Book" },
    async (r) => {
      requests.push(r);
      return response();
    },
    noFetch,
    { allowSharedSearch: false },
  );
  expect(requests).toHaveLength(3);
  expect(new Set(requests.map((r) => r.instructions)).size).toBe(3);
  expect(requests.every((r) => r.max_steps === 4 && r.model === OUTREACH_MODEL)).toBe(true);
  expect(result.contacts).toHaveLength(0);
});
test("verified direct email stops further paid stages", async () => {
  let calls = 0;
  const contact = {
    email: "jane@author.test",
    role: "author",
    source_url: "https://author.test/contact",
    evidence: "Jane Author, Book. jane@author.test",
  };
  const result = await findAuthorContacts(
    { author: "Jane Author", book: "Book" },
    async () => {
      calls++;
      return {
        ...response([contact]),
        sources: [{ url: contact.source_url, snippet: contact.evidence }],
      };
    },
    noFetch,
    { allowSharedSearch: false },
  );
  expect(calls).toBe(1);
  expect(result.contacts[0]?.verified).toBe(true);
});
test("namesake results are rejected even when email is present", async () => {
  const contact = {
    email: "jane@author.test",
    role: "author",
    source_url: "https://author.test/contact",
    evidence: "Jane Author, Book. jane@author.test",
  };
  const result = await findAuthorContacts(
    { author: "Jane Author", book: "Book" },
    async () => ({
      ...response([contact], false),
      sources: [{ url: contact.source_url, snippet: contact.evidence }],
    }),
    noFetch,
    { allowSharedSearch: false },
  );
  expect(result.contacts).toHaveLength(0);
});

test("email app handoff preserves message text without allowing header injection", async () => {
  const { authorMailto } = await import("../src/lib/scout/outreach");
  const url = new URL(
    authorMailto(
      "jane+books@example.com",
      "Book & visibility\nBcc: hidden",
      "Hello Jane\nA&B? #Hello",
    ),
  );
  expect(decodeURIComponent(url.pathname)).toBe("jane+books@example.com");
  expect(url.searchParams.get("subject")).toBe("Book & visibility Bcc: hidden");
  expect(url.searchParams.get("body")).toBe("Hello Jane\nA&B? #Hello");
  expect(url.searchParams.has("bcc")).toBe(false);
});
