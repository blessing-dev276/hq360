import { beforeAll, afterAll, expect, test } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import {
  audienceSearchSchema,
  parseAudienceResults,
  indexedEmail,
  serpSearch,
  emailSearchScope,
} from "../src/lib/scout/audience-search.server";
const id = "00000000-0000-4000-8000-000000000001";
const input = {
  requestId: id,
  audience: "plumbers",
  source: "maps",
  niche: "emergency",
  location: "Lagos",
  page: 1,
  limit: 10,
};
test("validates audiences, bounded search size and Maps location", () => {
  expect(audienceSearchSchema.safeParse(input).success).toBe(true);
  expect(audienceSearchSchema.safeParse({ ...input, location: "" }).success).toBe(false);
  expect(audienceSearchSchema.safeParse({ ...input, source: "web", location: "" }).success).toBe(
    true,
  );
  expect(audienceSearchSchema.safeParse({ ...input, audience: "unknown" }).success).toBe(false);
  expect(audienceSearchSchema.safeParse({ ...input, limit: 100 }).success).toBe(false);
});
const maps = {
  local_results: [
    {
      title: "Test Plumbing",
      place_id: "test-place",
      website: "https://example.com/?utm_source=maps",
      address: "Lagos",
      phone: "+234 123",
      rating: 4.7,
      reviews: 22,
    },
    { title: "Duplicate", place_id: "test-place" },
    { title: "No website", place_id: "no-site" },
  ],
};
test("Maps retains identity, rating and review count without fabricating a website", () => {
  const results = parseAudienceResults(maps, "maps");
  expect(results).toHaveLength(2);
  expect(results[0]).toMatchObject({
    rating: 4.7,
    review_count: 22,
    website_url: "https://example.com/",
    address: "Lagos",
  });
  expect(results[1]).toMatchObject({ website_url: null, rating: null, review_count: null });
});
test("web deduplicates tracking URLs and rejects nonpublic destinations", () => {
  const results = parseAudienceResults(
    {
      organic_results: [
        { title: "Page", link: "https://example.com/?utm_source=x", snippet: "Description" },
        { title: "Page", link: "https://example.com/" },
        { title: "Unsafe", link: "javascript:alert(1)" },
        { title: "Local", link: "http://127.0.0.1/test" },
      ],
    },
    "web",
  );
  expect(results).toHaveLength(1);
  expect(results[0]).toMatchObject({
    description: "Description",
    rating: null,
    review_count: null,
  });
});
test("email evidence must belong to the website or exact shared-platform profile", () => {
  expect(
    indexedEmail(
      {
        organic_results: [
          null,
          { link: "https://other.com", snippet: "wrong@other.com" },
          { link: "https://example.com/contact", snippet: "Write hello@example.com" },
        ],
      },
      "https://example.com",
    ),
  ).toEqual({ email: "hello@example.com", sourceUrl: "https://example.com/contact" });
  expect(emailSearchScope("https://instagram.com/")).toBeNull();
  expect(
    indexedEmail(
      {
        organic_results: [
          { link: "https://instagram.com/someoneelse", snippet: "wrong@example.com" },
        ],
      },
      "https://instagram.com/testcreator",
    ),
  ).toBeNull();
  expect(
    indexedEmail(
      {
        organic_results: [
          { link: "https://instagram.com/testcreator", snippet: "hello@example.com" },
        ],
      },
      "https://instagram.com/testcreator",
    ),
  ).not.toBeNull();
});
test("provider errors never become empty success or expose provider error text", async () => {
  const previous = process.env.SERPAPI_API_KEY;
  process.env.SERPAPI_API_KEY = "fixture-secret";
  try {
    const fake = (async () => Response.json({ error: "fixture-secret invalid" })) as typeof fetch;
    await expect(
      serpSearch({ engine: "google", q: "test" }, AbortSignal.timeout(1000), fake),
    ).rejects.toThrow("The search provider could not complete");
    const empty = (async () =>
      Response.json({
        error: "No results",
        search_information: { organic_results_state: "Fully empty" },
      })) as typeof fetch;
    expect(
      await serpSearch({ engine: "google", q: "test" }, AbortSignal.timeout(1000), empty),
    ).toHaveProperty("search_information");
  } finally {
    if (previous === undefined) delete process.env.SERPAPI_API_KEY;
    else process.env.SERPAPI_API_KEY = previous;
  }
});
const db = new PGlite();
beforeAll(async () => {
  await db.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;");
  await db.exec(
    await readFile(
      new URL("../supabase/migrations/20261002090000_scout_audiences.sql", import.meta.url),
      "utf8",
    ),
  );
});
afterAll(() => db.close());
async function save(batchId: string, items: unknown[]) {
  return db.query(
    "SELECT scout_save_audience_batch($1,'plumbers','maps','Test','emergency plumbers Lagos','Lagos',1,10,$2::jsonb)",
    [batchId, JSON.stringify(items)],
  );
}
test("batch save is atomic and idempotent; repeat searches preserve verified contacts", async () => {
  const items = parseAudienceResults(maps, "maps");
  await save(id, items);
  await save(id, items);
  expect(
    (await db.query<{ count: number }>("SELECT count(*)::int count FROM scout_audience_batches"))
      .rows[0]!.count,
  ).toBe(1);
  await db.exec(
    "UPDATE scout_audience_leads SET contact_email='verified@example.com', contact_status='verified', shortlisted=true WHERE source_key='test-place'",
  );
  const next = "00000000-0000-4000-8000-000000000002";
  await save(next, items);
  expect(
    (await db.query<{ count: number }>("SELECT count(*)::int count FROM scout_audience_leads"))
      .rows[0]!.count,
  ).toBe(2);
  expect(
    (
      await db.query(
        "SELECT contact_email, contact_status, shortlisted FROM scout_audience_leads WHERE source_key='test-place'",
      )
    ).rows[0],
  ).toMatchObject({
    contact_email: "verified@example.com",
    contact_status: "verified",
    shortlisted: true,
  });
  expect(
    (
      await db.query<{ item_count: number }>(
        "SELECT item_count FROM scout_audience_batches WHERE id=$1",
        [next],
      )
    ).rows[0]!.item_count,
  ).toBe(2);
  const failed = "00000000-0000-4000-8000-000000000003";
  await expect(save(failed, [{ ...items[0], rating: 10 }])).rejects.toThrow();
  expect(
    (await db.query("SELECT id FROM scout_audience_batches WHERE id=$1", [failed])).rows,
  ).toHaveLength(0);
  await save(failed, []);
  expect(
    (
      await db.query<{ item_count: number }>(
        "SELECT item_count FROM scout_audience_batches WHERE id=$1",
        [failed],
      )
    ).rows[0]!.item_count,
  ).toBe(0);
});
test("anonymous clients cannot read leads or invoke batch persistence", async () => {
  await db.exec("SET ROLE anon");
  try {
    await expect(db.query("SELECT * FROM scout_audience_leads")).rejects.toThrow();
    await expect(save("00000000-0000-4000-8000-000000000004", [])).rejects.toThrow();
  } finally {
    await db.exec("RESET ROLE");
  }
});
