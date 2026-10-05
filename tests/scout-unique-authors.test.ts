import { afterAll, beforeAll, expect, test } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";

const db = new PGlite();
beforeAll(async () => {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create table scout_authors(id uuid primary key default gen_random_uuid(), normalized_name text);
    create table scout_batches(id uuid primary key default gen_random_uuid(), owner text, requested_max int, created_at timestamptz default now());
    create table scout_discovered_books(id uuid primary key default gen_random_uuid(), scout_author_id uuid references scout_authors);
    create table scout_batch_books(batch_id uuid references scout_batches, book_id uuid references scout_discovered_books, primary key(batch_id,book_id));
    create table scout_prospects(id uuid primary key default gen_random_uuid(), owner text, scout_author_id uuid references scout_authors, created_at timestamptz default now());
  `);
  // Backfill must exclude historical authors even when no prospect was saved.
  await db.exec(`
    insert into scout_authors(normalized_name) values ('historical author');
    insert into scout_batches(owner,requested_max) values ('expert-a',20);
    insert into scout_discovered_books(scout_author_id) select id from scout_authors;
    insert into scout_batch_books select b.id,k.id from scout_batches b cross join scout_discovered_books k;
  `);
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/20261005120000_scout_unique_workspace_authors.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
}, 30000);
afterAll(() => db.close());

async function batch(owner: string, max = 100) {
  return (
    await db.query<{ id: string }>(
      "insert into scout_batches(owner,requested_max) values($1,$2) returning id",
      [owner, max],
    )
  ).rows[0]!.id;
}
async function book(name: string) {
  const author = (
    await db.query<{ id: string }>(
      "insert into scout_authors(normalized_name) values($1) returning id",
      [name],
    )
  ).rows[0]!.id;
  const id = (
    await db.query<{ id: string }>(
      "insert into scout_discovered_books(scout_author_id) values($1) returning id",
      [author],
    )
  ).rows[0]!.id;
  return { id, author };
}
async function link(batchId: string, bookId: string) {
  return (
    await db.query(
      "insert into scout_batch_books values($1,$2) on conflict do nothing returning *",
      [batchId, bookId],
    )
  ).rows;
}

test("history excludes the same author under another source identity, but allows another expert", async () => {
  const candidate = await book("historical author");
  expect(await link(await batch("expert-a"), candidate.id)).toHaveLength(0);
  expect(await link(await batch("expert-b"), candidate.id)).toHaveLength(1);
});

test("parallel batches claim an author once and retrying membership is idempotent", async () => {
  const first = await book("new writer"),
    second = await book("new writer");
  const a = await batch("expert-a"),
    b = await batch("expert-a");
  const results = await Promise.all([link(a, first.id), link(b, second.id)]);
  expect(results.flat()).toHaveLength(1);
  expect(await link(a, first.id)).toHaveLength(0);
});

test("batch capacity is enforced without consuming skipped authors", async () => {
  const a = await batch("limited-expert", 1);
  const first = await book("first writer"),
    second = await book("second writer");
  expect(await link(a, first.id)).toHaveLength(1);
  expect(await link(a, second.id)).toHaveLength(0);
  expect(await link(await batch("limited-expert"), second.id)).toHaveLength(1);
});

test("generated authors can be scouted once, including across distinct author IDs", async () => {
  const a = await batch("scouting-expert");
  const first = await book("scouted writer"),
    second = await book("scouted writer");
  await link(a, first.id);
  const save = (owner: string, author: string) =>
    db.query("insert into scout_prospects(owner,scout_author_id) values($1,$2) returning id", [
      owner,
      author,
    ]);
  expect((await save("scouting-expert", first.author)).rows).toHaveLength(1);
  expect((await save("scouting-expert", second.author)).rows).toHaveLength(0);
  expect((await save("another-expert", second.author)).rows).toHaveLength(1);
  expect(await link(await batch("another-expert"), first.id)).toHaveLength(0);
});
