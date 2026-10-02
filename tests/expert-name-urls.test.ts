import { beforeAll, afterAll, test, expect } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
const db = new PGlite();
const first = "00000000-0000-4000-8000-000000000001";
beforeAll(async () => {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE TABLE expert_profiles(id uuid primary key,full_name text,slug text not null unique,created_at timestamptz default now());
 CREATE FUNCTION expert_slug(text,uuid) RETURNS text LANGUAGE sql IMMUTABLE AS 'SELECT $1';
 INSERT INTO expert_profiles(id,full_name,slug) VALUES('${first}','Barakat Ayomide','barakat-ayomide-705fc3');`);
  await db.exec(
    await readFile(
      new URL("../supabase/migrations/20261002140100_expert_name_urls.sql", import.meta.url),
      "utf8",
    ),
  );
});
afterAll(() => db.close());
test("existing profiles get name URLs and preserve their old links", async () => {
  expect((await db.query("SELECT slug FROM expert_profiles WHERE id=$1", [first])).rows[0]).toEqual(
    { slug: "barakat-ayomide" },
  );
  expect(
    (
      await db.query(
        "SELECT expert_id FROM expert_slug_aliases WHERE slug='barakat-ayomide-705fc3'",
      )
    ).rows[0],
  ).toEqual({ expert_id: first });
});
test("signup overrides ID suffixes, duplicates are unique without numbers", async () => {
  const ids = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
  for (const id of ids)
    await db.query(
      "INSERT INTO expert_profiles(id,full_name,slug) VALUES($1,'Jane Smith','jane-smith-123456')",
      [id],
    );
  expect(
    (await db.query("SELECT slug FROM expert_profiles WHERE full_name='Jane Smith' ORDER BY slug"))
      .rows,
  ).toEqual([
    { slug: "jane-smith" },
    { slug: "jane-smith-expert" },
    { slug: "jane-smith-expert-a" },
  ]);
});
test("name changes retain earlier URLs and reserve them for the same person", async () => {
  await db.query("UPDATE expert_profiles SET full_name='Barakat Ayo' WHERE id=$1", [first]);
  expect((await db.query("SELECT slug FROM expert_profiles WHERE id=$1", [first])).rows[0]).toEqual(
    { slug: "barakat-ayo" },
  );
  expect(
    (await db.query("SELECT expert_id FROM expert_slug_aliases WHERE slug='barakat-ayomide'"))
      .rows[0],
  ).toEqual({ expert_id: first });
  const other = crypto.randomUUID();
  await db.query(
    "INSERT INTO expert_profiles(id,full_name,slug) VALUES($1,'Barakat Ayomide','ignored')",
    [other],
  );
  expect((await db.query("SELECT slug FROM expert_profiles WHERE id=$1", [other])).rows[0]).toEqual(
    { slug: "barakat-ayomide-expert" },
  );
});
test("private alias table is not readable by public database roles", async () => {
  await db.exec("SET ROLE anon");
  await expect(db.query("SELECT * FROM expert_slug_aliases")).rejects.toThrow();
  await db.exec("RESET ROLE");
});
