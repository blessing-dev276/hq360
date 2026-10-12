import { expect, test } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const sql = readFileSync(
  new URL("../supabase/migrations/20261012090000_scout_email_optional_budget.sql", import.meta.url),
  "utf8",
);

async function setup() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create table scout_email_runs (
      id uuid primary key default gen_random_uuid(), owner text not null,
      budget_usd numeric(12,6) check (budget_usd between 0.1 and 25),
      accounted_usd numeric(12,6) not null default 0, targets jsonb not null,
      status text not null default 'running');
    create table scout_email_attempts (
      id uuid primary key default gen_random_uuid(), run_id uuid not null, author_id uuid not null,
      stage integer not null, reserved_usd numeric(12,6) not null default 0.10,
      actual_usd numeric(12,6), settled boolean not null default false);`);
  await db.exec(sql);
  return db;
}
const author = "11111111-1111-4111-8111-111111111111";
async function run(db: PGlite, budget: number | null) {
  const { rows } = await db.query<{ id: string }>(
    "insert into scout_email_runs(owner, budget_usd, targets) values ('hq360', $1, $2) returning id",
    [budget, JSON.stringify([{ authorId: author, bookId: author }])],
  );
  return rows[0]!.id;
}
const reserve = async (db: PGlite, id: string) =>
  (
    await db.query<{ t: string | null }>("select reserve_scout_email_pass($1,'hq360',$2,0) t", [
      id,
      author,
    ])
  ).rows[0]!.t;

test("a budget stops paid passes once the next would go over", async () => {
  const db = await setup();
  const id = await run(db, 0.12);
  expect(await reserve(db, id)).not.toBeNull();
  expect(await reserve(db, id)).not.toBeNull();
  expect(await reserve(db, id)).toBeNull(); // 0.15 > 0.12
});

test("no budget means no limit, and budgets above the old $25 are allowed", async () => {
  const db = await setup();
  const id = await run(db, null);
  for (let i = 0; i < 30; i++) expect(await reserve(db, id)).not.toBeNull();
  await run(db, 200);
});
