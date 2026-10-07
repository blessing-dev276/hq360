import { expect, test } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import {
  readersFavoriteCatalog,
  parseReadersFavorite,
  RF_DEFAULT,
} from "../src/lib/scout/readers-favorite";
const fixture = `<h2 id="category-name">Fiction - Thriller - General</h2><aside><a href="/book-review/advert">Advertisement</a></aside><div class="book-short-dtl"><h4><a href="/book-review/test-book">Test &amp; Book</a></h4><div class="book-by">By Alex Example</div><div class="stars"><i class="icons star5"></i></div></div><div class="book-short-dtl"><h4><a href="/book-review/unknown">Unknown score</a></h4><div class="book-by">By Sam Writer</div></div><ul class="pagination"><li class="next"><a href="${RF_DEFAULT}?page=2">Next</a></li></ul><a href="${RF_DEFAULT}">Fiction - Thriller - General</a>`;
test("extracts only listing authors, preserving unknown ratings and pagination", () => {
  const result = parseReadersFavorite(fixture, readersFavoriteCatalog(RF_DEFAULT));
  expect(result.items).toHaveLength(2);
  expect(result.items[0]).toMatchObject({
    title: "Test & Book",
    authorName: "Alex Example",
    rating: 5,
  });
  expect(result.items[1]?.rating).toBeNull();
  expect(result.hasNext).toBe(true);
  expect(result.genres).toHaveLength(1);
});
test("rejects foreign, private and non-catalog URLs", () => {
  for (const url of [
    "http://readersfavorite.com" + RF_DEFAULT,
    "https://evil.example" + RF_DEFAULT,
    "http://127.0.0.1/",
    "https://readersfavorite.com@evil.example" + RF_DEFAULT,
    "/login",
    "/book-review/title",
  ])
    expect(() => readersFavoriteCatalog(url)).toThrow();
  expect(() => readersFavoriteCatalog(RF_DEFAULT, 101)).toThrow();
});
test("challenge pages are errors, not misleading empty search results", () => {
  expect(() =>
    parseReadersFavorite("<title>Verify you are human</title>", readersFavoriteCatalog(RF_DEFAULT)),
  ).toThrow();
  expect(
    parseReadersFavorite('<h2 id="category-name">Fiction</h2>', readersFavoriteCatalog(RF_DEFAULT))
      .items,
  ).toEqual([]);
});
test("ignores foreign listing URLs and unrelated next links", () => {
  const html = fixture
    .replace("/book-review/test-book", "https://evil.example/book-review/test-book")
    .replace(`${RF_DEFAULT}?page=2`, "https://evil.example/?page=2");
  const result = parseReadersFavorite(html, readersFavoriteCatalog(RF_DEFAULT));
  expect(result.items).toHaveLength(1);
  expect(result.hasNext).toBe(false);
});
test("source migration retains old platforms and stores RF stars separately from review counts", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create table scout_sources(slug text primary key,name text,kind text,enabled boolean,access_method text,source_access_status text,sync_schedule text,terms_notes text);create table scout_review_counts(platform text constraint scout_review_counts_platform_check check(platform in ('reedsy','other')),rating numeric(3,2),review_count integer);insert into scout_review_counts values('reedsy',null,5);`,
    );
    const sql = await readFile(
      new URL("../supabase/migrations/20260930130000_scout_readers_favorite.sql", import.meta.url),
      "utf8",
    );
    await db.exec(sql);
    await db.exec(sql);
    await db.exec("insert into scout_review_counts values('readers_favorite',5,null)");
    expect((await db.query("select * from scout_sources")).rows).toHaveLength(1);
    expect(
      (
        await db.query(
          "select rating::float,review_count from scout_review_counts where platform='readers_favorite'",
        )
      ).rows[0],
    ).toEqual({ rating: 5, review_count: null });
    expect(
      (await db.query("select * from scout_review_counts where platform='reedsy'")).rows,
    ).toHaveLength(1);
  } finally {
    await db.close();
  }
}, 30000);

test("category totals use the source's actual final page rather than the requested page", () => {
  const html = fixture.replace(
    /<ul class="pagination">.*?<\/ul>/,
    `<ul class="pagination"><li class="active"><a data-page="384">385</a></li><li class="next disabled"><span>Next</span></li></ul>`,
  );
  const result = parseReadersFavorite(
    html,
    `https://readersfavorite.com${RF_DEFAULT}?page=1000000&per-page=10`,
  );
  expect(result.bookCount).toBe(3842);
  expect(result.genres[0]?.bookCount).toBe(3842);
});

test("a sliding pagination window is only a lower bound and missing totals stay unknown", () => {
  const result = parseReadersFavorite(
    fixture + `<ul class="pagination"><li><a href="${RF_DEFAULT}?page=10">10</a></li></ul>`,
    readersFavoriteCatalog(RF_DEFAULT),
  );
  expect(result.bookCount).toBeNull();
  expect(result.minimumBookCount).toBe(91);
  const unknown = parseReadersFavorite(
    fixture.replace(/<ul class="pagination">.*?<\/ul>/, ""),
    readersFavoriteCatalog(RF_DEFAULT),
  );
  expect(unknown.bookCount).toBeNull();
});
