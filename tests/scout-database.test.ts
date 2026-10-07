import { beforeAll, afterAll, test, expect } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { normalizeBook } from "../src/lib/scout/normalize";
const db = new PGlite();
beforeAll(async () => {
  await db.exec(
    "CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE TABLE public.authors(id uuid PRIMARY KEY); CREATE TABLE public.author_audits(id uuid PRIMARY KEY);",
  );
  for (const file of [
    "20260920135251_scout_prospecting.sql",
    "20260920142333_scout_publication_year.sql",
    "20260920151918_scout_batches.sql",
    "20260920153627_scout_manual_ingest.sql",
    "20260921090000_scout_crawling.sql",
  ])
    await db.exec(
      await readFile(new URL("../supabase/migrations/" + file, import.meta.url), "utf8"),
    );
}, 30000);
afterAll(async () => {
  await db.close();
});
test("migration restricts sources, lease serializes workers and scheduled Open Library is refused", async () => {
  expect(
    (
      await db.query<{ source_access_status: string }>(
        "select source_access_status from scout_sources where slug='reedsy_discovery'",
      )
    ).rows[0]?.source_access_status,
  ).toBe("manual_only");
  expect(
    (
      await db.query<{ token: string | null }>(
        "select scout_claim_source('open_library',true) token",
      )
    ).rows[0]?.token,
  ).toBeNull();
  const token = (
    await db.query<{ token: string }>("select scout_claim_source('google_books') token")
  ).rows[0]!.token;
  expect(token).toBeTruthy();
  expect(
    (await db.query<{ token: string | null }>("select scout_claim_source('open_library') token"))
      .rows[0]?.token,
  ).toBeNull();
  await db.exec("update scout_sources set crawl_token=null,crawl_lease_until=null");
});
test("atomic save is idempotent, homonyms stay separate, manual review gates outreach", async () => {
  const token = (
    await db.query<{ token: string }>("select scout_claim_source('google_books') token")
  ).rows[0]!.token;
  const batch = (
    await db.query<{ id: string }>("insert into scout_batches(label) values('test') returning id")
  ).rows[0]!.id;
  const book = normalizeBook("google_books", {
    title: "Book one",
    authorName: "Same Name",
    sourceUrl: "https://books.google.com/books?id=1",
    rawData: {},
  });
  async function save(b: unknown) {
    return (
      await db.query<{
        saved: {
          author: { id: string };
          book: { id: string };
          bookAdded: boolean;
          authorAdded: boolean;
        };
      }>("select scout_save_book($1::jsonb,$2::uuid,$3::uuid) saved", [
        JSON.stringify(b),
        batch,
        token,
      ])
    ).rows[0]!.saved;
  }
  const first = await save(book),
    repeat = await save(book);
  expect(repeat.book.id).toBe(first.book.id);
  expect(repeat.bookAdded).toBe(false);
  const second = await save({
    ...book,
    source_url: "https://books.google.com/books?id=2",
    book_title: "Book two",
    normalized_title: "book two",
  });
  expect(second.author.id).not.toBe(first.author.id);
  await expect(
    db.query(
      "insert into scout_prospects(scout_author_id,book_id,status) values($1,$2,'qualified')",
      [first.author.id, first.book.id],
    ),
  ).rejects.toThrow("Manual identity");
  await db.query(
    "select scout_review_author($1,'verify','Compared official website and publisher catalog')",
    [first.author.id],
  );
  await db.query(
    "insert into scout_prospects(scout_author_id,book_id,status) values($1,$2,'qualified')",
    [first.author.id, first.book.id],
  );
  await db.exec("update scout_sources set crawl_token=null,crawl_lease_until=null");
  await db.query("select scout_merge_authors($1,$2,$3)", [
    second.author.id,
    first.author.id,
    "Matched both books on the official author website",
  ]);
  expect(
    (
      await db.query<{ identity_status: string }>(
        "select identity_status from scout_authors where id=$1",
        [first.author.id],
      )
    ).rows[0]?.identity_status,
  ).toBe("needs_review");
  await expect(
    db.query("update scout_prospects set status='contacted' where scout_author_id=$1", [
      first.author.id,
    ]),
  ).rejects.toThrow("Manual identity");
});
test("anonymous roles cannot call privileged functions", async () => {
  await db.exec("SET ROLE anon");
  await expect(db.query("select scout_claim_source('google_books')")).rejects.toThrow(
    "permission denied",
  );
  await db.exec("RESET ROLE");
});

test("daily limits persist at save time and expired runs are recovered", async () => {
  const token = (
    await db.query<{ token: string }>("select scout_claim_source('google_books') token")
  ).rows[0]!.token;
  expect(token).toBeTruthy();
  const batch = (
    await db.query<{ id: string }>("insert into scout_batches(label) values('quota') returning id")
  ).rows[0]!.id;
  await db.exec(
    "update scout_sources set collection_limit_per_day=daily_records where slug='google_books'",
  );
  const book = normalizeBook("google_books", {
    title: "Quota book",
    authorName: "A",
    sourceUrl: "https://books.google.com/books?id=quota",
    rawData: {},
  });
  await expect(
    db.query("select scout_save_book($1::jsonb,$2,$3)", [JSON.stringify(book), batch, token]),
  ).rejects.toThrow("Daily record limit");
  await db.exec(
    "update scout_sources set crawl_lease_until=now()-interval '1 minute'; insert into scout_crawl_runs(source_slug,started_at) values('google_books',now()-interval '10 minutes')",
  );
  await db.query("select scout_claim_source('google_books')");
  expect(
    (
      await db.query<{ status: string }>(
        "select status from scout_crawl_runs order by started_at limit 1",
      )
    ).rows[0]?.status,
  ).toBe("failed");
  await db.exec("update scout_sources set crawl_token=null,crawl_lease_until=null");
});
