import { test, expect } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
test("empty cleanup is owner-scoped and preserves books and discovery evidence", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create table scout_batches(id uuid primary key default gen_random_uuid(), owner text);
      create table scout_batch_books(batch_id uuid references scout_batches, book_id uuid);
      create table scout_arc_listings(batch_id uuid references scout_batches);
    `);
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/20261005140000_scout_discard_empty_batch.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const batch = (
      await db.query<{ id: string }>(
        "insert into scout_batches(owner) values ('expert-a') returning id",
      )
    ).rows[0]!.id;
    const discard = async (owner: string) =>
      (
        await db.query<{ removed: boolean }>("select scout_discard_empty_batch($1,$2) removed", [
          batch,
          owner,
        ])
      ).rows[0]!.removed;
    expect(await discard("expert-b")).toBe(false);
    await db.query("insert into scout_batch_books values($1,gen_random_uuid())", [batch]);
    expect(await discard("expert-a")).toBe(false);
    await db.exec("delete from scout_batch_books");
    await db.query("insert into scout_arc_listings values($1)", [batch]);
    expect(await discard("expert-a")).toBe(false);
    await db.exec("delete from scout_arc_listings");
    expect(await discard("expert-a")).toBe(true);
    expect((await db.query("select * from scout_batches")).rows).toHaveLength(0);
  } finally {
    await db.close();
  }
}, 30000);
