import { afterAll, beforeAll, expect, test } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import {
  arcListingUrl,
  arcSearchSchema,
  isoPublicationDate,
  labeledPublicationDate,
  matchesPublicationWindow,
  parseArcIndex,
  parseBooksirensPage,
} from "../src/lib/scout/arc-discovery.server";
import { isArcSource } from "../src/lib/scout/arc-sources";
const id = "00000000-0000-4000-8000-000000000001";
test("only real source keys and source listing URLs are accepted", () => {
  expect(isArcSource("__proto__")).toBe(false);
  expect(arcListingUrl("netgalley", "https://www.netgalley.com/catalog/book/123?tracking=x")).toBe(
    "https://www.netgalley.com/catalog/book/123",
  );
  for (const url of [
    "https://evil.com/catalog/book/123",
    "https://www.netgalley.com.evil.com/catalog/book/123",
    "http://www.netgalley.com/catalog/book/123",
    "https://user@www.netgalley.com/catalog/book/123",
    "https://www.netgalley.com/catalog/",
  ])
    expect(arcListingUrl("netgalley", url)).toBeNull();
  expect(arcListingUrl("booksirens", "https://booksirens.com/book-reviewer-directory")).toBeNull();
});
test("dates are explicit and calendar-valid, never review deadlines or Google timestamps", () => {
  expect(isoPublicationDate("2026-02-30")).toBeNull();
  expect(isoPublicationDate("Sep 14, 2026")).toBe("2026-09-14");
  expect(labeledPublicationDate("Review deadline October 20, 2026")).toBeNull();
  expect(labeledPublicationDate("Pub Date: October 20, 2026")).toBe("2026-10-20");
  expect(
    arcSearchSchema.safeParse({
      requestId: id,
      source: "booksirens",
      from: "2026-12-01",
      to: "2026-10-01",
    }).success,
  ).toBe(false);
});
const indexed = parseArcIndex("netgalley", {
  organic_results: [
    {
      title: "The Book | Test Author | NetGalley",
      link: "https://www.netgalley.com/catalog/book/123",
      snippet: "A fantasy book",
      date: "Oct 2, 2026",
    },
    { title: "Duplicate", link: "https://www.netgalley.com/catalog/book/123?tracking=x" },
    { title: "Category", link: "https://www.netgalley.com/catalog/category/36" },
  ],
});
test("indexed results retain uncertainty and deduplicate canonical URLs", () => {
  expect(indexed).toHaveLength(1);
  expect(indexed[0]).toMatchObject({
    title: "The Book",
    author_name: "Test Author",
    publication_date: null,
    genre: null,
    discovery_method: "search_index",
  });
  expect(matchesPublicationWindow(indexed[0]!, "2026-10-01", "", true)).toBe(true);
  expect(matchesPublicationWindow(indexed[0]!, "", "", false)).toBe(false);
  expect(
    matchesPublicationWindow(
      { ...indexed[0]!, publication_date: "2026-09-01" },
      "2026-10-01",
      "",
      true,
    ),
  ).toBe(false);
});
test("guest BookSirens pages provide labeled metadata; sign-in pages are skipped", () => {
  const item = parseBooksirensPage(
    "<html><title>The Book by Jane Smith - Review Copy | BookSirens</title><body>GenresFantasy and RomanceTrigger WarningsNonePublication DateSep 14, 2026</body></html>",
    "https://booksirens.com/book/ABC123",
  );
  expect(item).toMatchObject({
    title: "The Book",
    author_name: "Jane Smith",
    publication_date: "2026-09-14",
    genre: "Fantasy and Romance",
  });
  expect(
    parseBooksirensPage("<title>Become a reviewer</title>", "https://booksirens.com/book/ABC123"),
  ).toBeNull();
});
const db = new PGlite();
beforeAll(async () => {
  await db.exec(
    "CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE TABLE scout_sources(slug text primary key,name text,kind text,enabled boolean,access_method text,source_access_status text); CREATE TABLE scout_batches(id uuid primary key,label text,sources text[],genre text,item_count integer); CREATE TABLE scout_discovered_books(id uuid primary key);",
  );
  await db.exec(
    await readFile(
      new URL("../supabase/migrations/20261002120000_scout_arc.sql", import.meta.url),
      "utf8",
    ),
  );
});
afterAll(() => db.close());
test("discovery and batch persist atomically and idempotently, including missing authors", async () => {
  const save = (batchId: string, items: unknown[]) =>
    db.query("SELECT scout_save_arc_batch($1,'netgalley','Test','',$2::jsonb)", [
      batchId,
      JSON.stringify(items),
    ]);
  await save(id, indexed);
  await save(id, indexed);
  expect((await db.query("SELECT count(*)::int AS n FROM scout_arc_listings")).rows[0]).toEqual({
    n: 1,
  });
  const next = "00000000-0000-4000-8000-000000000002";
  await expect(save(next, [{ ...indexed[0], discovery_method: "invalid" }])).rejects.toThrow();
  expect((await db.query("SELECT count(*)::int AS n FROM scout_batches")).rows[0]).toEqual({
    n: 1,
  });
  await save(next, [{ ...indexed[0], author_name: null }]);
  expect(
    (await db.query("SELECT author_name FROM scout_arc_listings WHERE batch_id=$1", [next]))
      .rows[0],
  ).toEqual({ author_name: null });
  await db.exec("SET ROLE authenticated");
  await expect(db.query("SELECT * FROM scout_arc_listings")).rejects.toThrow();
  await expect(save(crypto.randomUUID(), indexed)).rejects.toThrow();
  await db.exec("RESET ROLE");
});
