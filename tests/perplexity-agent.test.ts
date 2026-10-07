import { afterEach, expect, test } from "bun:test";
import { parseAgentResponse, runAgent } from "../src/lib/perplexity/agent.server";
import { findAuthorContacts } from "../src/lib/scout/perplexity-contact.server";
const previousKey = process.env.PERPLEXITY_API_KEY;
afterEach(() => {
  if (previousKey === undefined) delete process.env.PERPLEXITY_API_KEY;
  else process.env.PERPLEXITY_API_KEY = previousKey;
});
const response = {
  id: "test",
  status: "completed",
  output: [
    {
      type: "search_results",
      results: [
        {
          url: "https://example.com/contact",
          title: "Author contact",
          snippet: "Author's public email: writer@gmail.com",
        },
      ],
    },
    {
      type: "fetch_url_results",
      contents: [{ url: "https://example.com/about", snippet: "Author of Test Book" }],
    },
    {
      type: "message",
      content: [
        {
          type: "output_text",
          text: "Answer",
          annotations: [{ type: "url_citation", url: "https://example.com/contact" }],
        },
      ],
    },
  ],
};
test("reads raw HTTP output messages, search/fetch evidence and URL annotations", () => {
  const result = parseAgentResponse(response);
  expect(result.text).toBe("Answer");
  expect(result.sources).toHaveLength(2);
  expect(result.citations).toHaveLength(1);
  expect(() => parseAgentResponse({ ...response, status: "incomplete" })).toThrow();
});
test("requires a server key and uses the documented endpoint and tools", async () => {
  delete process.env.PERPLEXITY_API_KEY;
  await expect(runAgent({ input: "test", instructions: "test" })).rejects.toThrow(
    "Set PERPLEXITY_API_KEY",
  );
  process.env.PERPLEXITY_API_KEY = "unit-test-only";
  let captured: Record<string, unknown> = {};
  const fetcher = (async (url, init) => {
    expect(url).toBe("https://api.perplexity.ai/v1/agent");
    captured = JSON.parse(String(init?.body));
    return Response.json(response);
  }) as typeof fetch;
  expect((await runAgent({ input: "test", instructions: "test" }, fetcher)).httpStatus).toBe(200);
  expect(captured.tools).toEqual([{ type: "web_search" }, { type: "fetch_url" }]);
});
test("sanitizes authentication errors and honors long Retry-After without early retry", async () => {
  process.env.PERPLEXITY_API_KEY = "unit-test-only";
  await expect(
    runAgent(
      { input: "test", instructions: "test" },
      (async () => new Response("secret provider body", { status: 401 })) as typeof fetch,
    ),
  ).rejects.toThrow("authentication failed");
  let calls = 0;
  try {
    await runAgent({ input: "test", instructions: "test" }, (async () => {
      calls++;
      return new Response("", { status: 429, headers: { "Retry-After": "30" } });
    }) as typeof fetch);
  } catch (e) {
    expect((e as { retryAfter: string }).retryAfter).toBe("30");
  }
  expect(calls).toBe(1);
});
test("accepts public Gmail with retrieved evidence and rejects guessed, uncited or mismatched contacts", async () => {
  const base = parseAgentResponse(response);
  const contact = {
    email: "writer@gmail.com",
    role: "author",
    source_url: "https://example.com/contact",
    evidence: "Published contact writer@gmail.com",
  };
  const agent = async () => ({
    ...base,
    httpStatus: 200,
    text: JSON.stringify({
      identity_match: true,
      summary: "Public contact",
      contacts: [
        contact,
        { ...contact, email: "guessed@gmail.com" },
        { ...contact, source_url: "https://other.example.com" },
      ],
    }),
  });
  const result = await findAuthorContacts(
    { author: "Test Author", book: "Test Book" },
    agent,
    (async () => new Response("", { status: 404 })) as typeof fetch,
    { allowSharedSearch: false },
  );
  expect(result.contacts).toEqual([{ ...contact, verified: true }]);
  const mismatch = await findAuthorContacts(
    { author: "Test Author", book: "Test Book" },
    async () => ({
      ...(await agent()),
      text: JSON.stringify({
        identity_match: false,
        summary: "Different author",
        contacts: [contact],
      }),
    }),
    (async () => new Response("", { status: 404 })) as typeof fetch,
    { allowSharedSearch: false },
  );
  expect(mismatch.contacts).toHaveLength(0);
});
