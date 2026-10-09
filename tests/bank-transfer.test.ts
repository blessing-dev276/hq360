import { afterAll, beforeAll, expect, test } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { buildInvoiceEmail } from "../src/lib/payments/invoice-email";
import type { Invoice } from "../src/lib/payments/types";
const db = new PGlite();
beforeAll(async () => {
  await db.exec(
    "create role anon; create role authenticated; create role service_role; create table expert_profiles(id uuid primary key);",
  );
  for (const name of [
    "20260923090000_payment_invoices",
    "20260923100000_nowpayments",
    "20260924090000_invoice_usd",
    "20260930110000_nowpayments_only",
    "20261002100000_flutterwave_invoices",
    "20261002110000_cancel_invoices",
    "20261009170000_bank_transfer_invoices",
  ]) {
    await db.exec(
      await readFile(new URL(`../supabase/migrations/${name}.sql`, import.meta.url), "utf8"),
    );
  }
}, 30000);
afterAll(() => db.close());
async function draft(currency = "EUR") {
  return (
    await db.query<Invoice>(
      `insert into payment_invoices(buyer_name,buyer_email,buyer_phone,description,amount_minor,currency,due_date,environment,provider) values ('Client','client@example.com','08012345678','Project',125050,$1,'2026-11-01','live','bank_transfer') returning *`,
      [currency],
    )
  ).rows[0]!;
}
test("bank transfers require EUR and an issued invoice reference", async () => {
  await expect(draft("USD")).rejects.toThrow();
  const inv = await draft();
  await expect(
    db.query("update payment_invoices set status='pending' where id=$1", [inv.id]),
  ).rejects.toThrow();
  await db.query(
    "update payment_invoices set status='pending',provider_invoice_id=number where id=$1",
    [inv.id],
  );
  await expect(
    db.query("update payment_invoices set status='paid',paid_at=now() where id=$1", [inv.id]),
  ).rejects.toThrow();
  await db.query(
    "update payment_invoices set status='paid',paid_at=now(),payment_id='BANK-123',provider_status='receipt_confirmed_by_admin' where id=$1 and status='pending'",
    [inv.id],
  );
  expect(
    (await db.query<Invoice>("select * from payment_invoices where id=$1", [inv.id])).rows[0]
      ?.status,
  ).toBe("paid");
});
test("email includes exact bank details, EUR restrictions and invoice reference", async () => {
  const inv = await draft();
  inv.due_date = "2026-11-01";
  inv.created_at = "2026-10-09T12:00:00Z";
  const email = buildInvoiceEmail(
    inv,
    "https://www.hq360.space/pay/token",
    "https://www.hq360.space",
  );
  for (const body of [email.text, email.html]) {
    for (const detail of [
      "Blessing Durosinmi",
      "GB04CLJU04130735848221",
      "CLJUGB21XXX",
      "35848221",
      "041307",
      "Clear Junction Limited",
      "SEPA Instant",
      "EUR only",
      inv.number,
    ])
      expect(body).toContain(detail);
  }
});
