import { describe, expect, test } from "bun:test";
import {
  collectWebResearch,
  generateWebResearch,
  researchQueries,
} from "../src/lib/author-audit/workflow-ai-search.server";
import { DEFAULT_PROMPT, SECTION_KEYS, type WorkflowState } from "../src/lib/author-audit/workflow";

const auditId = "00000000-0000-4000-8000-000000000001";
const source = {
  provider: "web_search" as const,
  query: '"Test Author" "Test Book"',
  title: "Test Book listing",
  url: "https://example.com/books/test-book",
  excerpt: "Test Book by Test Author is listed here.",
  retrievedAt: "2026-10-03T12:00:00.000Z",
};
const state = {
  template: DEFAULT_PROMPT,
  audit: {
    id: auditId,
    authors: { name: "Test Author" },
    books: { title: "Test Book" },
    input_snapshot: { notes: "Check visibility" },
  },
  findings: [],
} as unknown as WorkflowState;
function validDraft(url = source.url) {
  return JSON.stringify({
    audit_meta: {
      audit_id: auditId,
      author_name: "Test Author",
      book_title: "Test Book",
      research_date: "2026-10-03",
    },
    audit_findings: [
      {
        title: "Book catalogue listing",
        category: "book_identity",
        classification: "direct_observation",
        what_we_found: "A book catalogue search result lists the book.",
        evidence: "The search result says Test Book by Test Author.",
        source_urls: [url],
      },
    ],
    ...Object.fromEntries(SECTION_KEYS.map((key) => [key, null])),
    goodreads_listopia_audit: [],
    screenshot_queue: [],
    manual_review_queue: [],
    priority_action_plan: [],
  });
}

describe("AI web research", () => {
  test("searches multiple author and book angles and deduplicates public sources", async () => {
    const queries: string[] = [];
    const result = await collectWebResearch(
      { author: "Test Author", book: "Test Book", focus: "reviews" },
      async (params) => {
        queries.push(params.q);
        return {
          organic_results: [
            { title: "Result", link: source.url, snippet: source.excerpt },
            { title: "Private", link: "http://127.0.0.1/internal", snippet: "ignore" },
          ],
        };
      },
      {
        google: async () => ({
          provider: "google_books",
          sourceType: "book_metadata",
          status: "unavailable",
          retrievedAt: source.retrievedAt,
          data: {},
        }),
        openLibrary: async () => ({
          provider: "open_library",
          sourceType: "book_metadata",
          status: "unavailable",
          retrievedAt: source.retrievedAt,
          data: {},
        }),
      },
    );
    expect(queries).toHaveLength(researchQueries("Test Author", "Test Book", "reviews").length);
    expect(queries.some((query) => query.includes("reviews"))).toBe(true);
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0]?.url).toBe(source.url);
  });

  test("validates a generated draft and excludes findings without collected citations", async () => {
    const previousSearch = process.env.SERPAPI_API_KEY;
    const previousAi = process.env.ANTHROPIC_API_KEY;
    process.env.SERPAPI_API_KEY = "test";
    process.env.ANTHROPIC_API_KEY = "test";
    try {
      let prompt = "";
      const collect = async () => ({ sources: [source], failures: [] });
      const valid = await generateWebResearch(state, "reviews", {
        collect,
        generate: async (value) => {
          prompt = value;
          return validDraft();
        },
      });
      expect(valid.validated.valid).toBe(true);
      expect(valid.droppedFindings).toBe(0);
      expect(prompt).toContain(source.url);
      expect(prompt).toContain("reviews");
      expect(prompt).toContain("awards separately");
      expect(prompt).toContain("availability unverified");
      expect(
        researchQueries("Test Author", "Test Book").some((q) => q.includes("site:kobo.com")),
      ).toBe(true);
      const normalizedCitation = await generateWebResearch(state, "", {
        collect,
        generate: async () => validDraft(`${source.url}/`),
      });
      if (normalizedCitation.validated.valid)
        expect(normalizedCitation.validated.data.findings[0]?.source_urls).toEqual([source.url]);
      expect(
        generateWebResearch(state, "", {
          collect,
          generate: async () => validDraft("https://invented.example/claim"),
        }),
      ).rejects.toThrow("no new findings backed by collected sources");
      const mixed = await generateWebResearch(state, "", {
        collect,
        generate: async () => {
          const data = JSON.parse(validDraft()) as Record<string, unknown>;
          const findings = data.audit_findings as Record<string, unknown>[];
          findings.push({
            ...findings[0],
            title: "Unsupported claim",
            source_urls: ["https://invented.example/claim"],
          });
          return JSON.stringify(data);
        },
      });
      expect(mixed.validated.valid).toBe(true);
      expect(mixed.droppedFindings).toBe(1);
      if (mixed.validated.valid) expect(mixed.validated.data.findings).toHaveLength(1);
      const withExisting = {
        ...state,
        findings: [{ category: "book_identity", title: "Book catalogue listing" }],
      } as WorkflowState;
      expect(
        generateWebResearch(withExisting, "", { collect, generate: async () => validDraft() }),
      ).rejects.toThrow("no new findings");
    } finally {
      if (previousSearch === undefined) delete process.env.SERPAPI_API_KEY;
      else process.env.SERPAPI_API_KEY = previousSearch;
      if (previousAi === undefined) delete process.env.ANTHROPIC_API_KEY;
      else process.env.ANTHROPIC_API_KEY = previousAi;
    }
  });
});

test("retailer, biography and awards coverage survives a full source bundle", async () => {
  const queries = researchQueries("Test Author", "Test Book");
  for (const domain of [
    "barnesandnoble.com",
    "kobo.com",
    "books.apple.com",
    "audible.com",
    "worldcat.org",
    "overdrive.com",
  ])
    expect(queries.some((q) => q.includes(`site:${domain}`))).toBe(true);
  expect(queries.some((q) => q.includes("biography"))).toBe(true);
  expect(queries.filter((q) => q.includes("winner finalist shortlist"))).toHaveLength(2);
  const unavailable = async () => ({
    provider: "google_books" as const,
    sourceType: "book_metadata",
    status: "unavailable" as const,
    retrievedAt: source.retrievedAt,
    data: {},
  });
  const result = await collectWebResearch(
    { author: "Test Author", book: "Test Book" },
    async ({ q }) => ({
      organic_results: Array.from({ length: 5 }, (_, i) => ({
        title: q,
        link: `https://example.com/${queries.indexOf(q)}/${i}`,
        snippet: `Evidence for ${q}`,
      })),
    }),
    { google: unavailable, openLibrary: unavailable },
  );
  expect(result.sources.length).toBeLessThanOrEqual(80);
  for (const query of queries) expect(result.sources.some((s) => s.query === query)).toBe(true);
});
