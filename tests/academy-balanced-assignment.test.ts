import { expect, test } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const fn = readFileSync(
  new URL("../supabase/migrations/20261009110000_academy_balanced_assignment.sql", import.meta.url),
  "utf8",
);

async function setup(trainers: number) {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create table profiles (
      id uuid primary key, role text not null,
      trainer_id uuid references profiles(id) on delete set null,
      trainer_assigned_at timestamptz);`);
  await db.exec(fn);
  for (let i = 0; i < trainers; i++)
    await db.query("insert into profiles(id, role) values (gen_random_uuid(), 'trainer')");
  return db;
}
const counts = async (db: PGlite) =>
  (
    await db.query<{ n: number }>(
      `select count(s.id)::int n from profiles t
       left join profiles s on s.trainer_id = t.id and s.role = 'trainee'
       where t.role = 'trainer' group by t.id`,
    )
  ).rows.map((r) => r.n);

test("draws stay balanced: no trainer gets a second trainee while another has none", async () => {
  const db = await setup(3);
  for (let i = 1; i <= 7; i++) {
    const { rows } = await db.query<{ id: string }>(
      "insert into profiles(id, role) values (gen_random_uuid(), 'trainee') returning id",
    );
    await db.query("select assign_academy_trainer($1)", [rows[0]!.id]);
    const c = await counts(db);
    expect(Math.max(...c) - Math.min(...c)).toBeLessThanOrEqual(1);
    expect(c.reduce((a, b) => a + b, 0)).toBe(i);
  }
  expect((await counts(db)).sort()).toEqual([2, 2, 3]);
});

test("keeps an existing trainer, but redraws if they stopped being a trainer", async () => {
  const db = await setup(2);
  const { rows } = await db.query<{ id: string }>(
    "insert into profiles(id, role) values (gen_random_uuid(), 'trainee') returning id",
  );
  const id = rows[0]!.id;
  const first = (await db.query<{ t: string }>("select assign_academy_trainer($1) t", [id]))
    .rows[0]!.t;
  expect(
    (await db.query<{ t: string }>("select assign_academy_trainer($1) t", [id])).rows[0]!.t,
  ).toBe(first);
  await db.query("update profiles set role = 'trainee' where id = $1", [first]);
  const second = (await db.query<{ t: string }>("select assign_academy_trainer($1) t", [id]))
    .rows[0]!.t;
  expect(second).not.toBe(first);
});
