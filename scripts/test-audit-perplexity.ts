// Isolated provider regression: no paid requests or real credentials.
import { mock } from "bun:test";
import assert from "node:assert/strict";
import { DEFAULT_PROMPT, type WorkflowState } from "../src/lib/author-audit/workflow";
let called = false;
mock.module("../src/lib/perplexity/credentials.server", () => ({
  adminKeyForResearch: async () => "pplx-test-admin",
}));
const previousFetch = globalThis.fetch;
const previousSearch = process.env.SERPAPI_API_KEY;
process.env.SERPAPI_API_KEY = "test";
globalThis.fetch = (async (url, init) => {
  called = true;
  assert.equal(url, "https://api.perplexity.ai/v1/agent");
  assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer pplx-test-admin");
  const body = JSON.parse(String(init?.body));
  assert.equal(body.model, "openai/gpt-6-luna");
  assert.deepEqual(body.tools, []);
  assert.equal(body.max_output_tokens, 32000);
  assert.ok(body.input.includes("https://example.com/book"));
  assert.ok(!body.input.includes("pplx-test-admin"));
  return Response.json({
    id: "test",
    status: "completed",
    output: [{ type: "message", content: [{ type: "output_text", text: "{}" }] }],
  });
}) as typeof fetch;
try {
  const { generateWebResearch } = await import("../src/lib/author-audit/workflow-ai-search.server");
  const result = await generateWebResearch(
    {
      template: DEFAULT_PROMPT,
      audit: {
        id: "00000000-0000-4000-8000-000000000001",
        authors: { name: "Author" },
        books: { title: "Book" },
        input_snapshot: {},
      },
      findings: [],
    } as unknown as WorkflowState,
    "",
    {
      collect: async () => ({
        sources: [
          {
            query: "Book",
            title: "Book",
            url: "https://example.com/book",
            excerpt: "Book by Author",
            retrievedAt: new Date().toISOString(),
            provider: "web_search",
          },
        ],
        failures: [],
      }),
    },
  );
  assert.equal(called, true);
  assert.equal(result.validated.valid, false);
  console.log(
    "PASS: Audit uses Perplexity Luna, admin credentials, collected sources and output validation.",
  );
} finally {
  globalThis.fetch = previousFetch;
  if (previousSearch === undefined) delete process.env.SERPAPI_API_KEY;
  else process.env.SERPAPI_API_KEY = previousSearch;
}
