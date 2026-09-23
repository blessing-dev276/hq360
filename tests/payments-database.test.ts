import { afterAll, beforeAll, expect, test } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
const db = new PGlite();
beforeAll(async () => {
  await db.exec("create role anon; create role authenticated; create role service_role;");
  await db.exec(
    await readFile(
      new URL("../supabase/migrations/20260923090000_payment_invoices.sql", import.meta.url),
      "utf8",
    ),
  );
}, 30000);
afterAll(async () => {
  await db.close();
});
const insert =
  "insert into payment_invoices(buyer_name,buyer_email,buyer_phone,description,amount_minor,due_date,environment) values ('Buyer','buyer@example.com','08012345678','Project',125050,'2026-10-01','demo') returning *";
test("migration generates unique invoice numbers and unguessable payment tokens", async () => {
  const a = (await db.query<{ number: string; payment_token: string }>(insert)).rows[0]!;
  const b = (await db.query<{ number: string; payment_token: string }>(insert)).rows[0]!;
  expect(a.number).not.toBe(b.number);
  expect(a.payment_token).toMatch(/^[a-f0-9]{64}$/);
  expect(a.payment_token).not.toBe(b.payment_token);
});
test("paid invoices require a reference and timestamp", async () => {
  await expect(db.exec("update payment_invoices set status='paid'")).rejects.toThrow();
});
test("anonymous and authenticated users cannot read buyer records", async () => {
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`set role ${role}`);
    await expect(db.query("select * from payment_invoices")).rejects.toThrow();
    await db.exec("reset role");
  }
});
