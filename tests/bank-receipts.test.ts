import { afterAll, beforeAll, expect, test } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { imageType } from "../src/lib/payments/receipts.server";
const db = new PGlite();
beforeAll(async () => {
  await db.exec(
    "create role anon; create role authenticated; create role service_role; create table expert_profiles(id uuid primary key); create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);",
  );
  for (const name of [
    "20260923090000_payment_invoices",
    "20260923100000_nowpayments",
    "20260924090000_invoice_usd",
    "20260930110000_nowpayments_only",
    "20261002100000_flutterwave_invoices",
    "20261002110000_cancel_invoices",
    "20261009120000_bank_transfer_invoices",
    "20261009200000_bank_transfer_receipts",
  ])
    await db.exec(
      await readFile(new URL(`../supabase/migrations/${name}.sql`, import.meta.url), "utf8"),
    );
}, 30000);
afterAll(() => db.close());
async function invoice() {
  const row = await db.query<{ id: string }>(
    "insert into payment_invoices(buyer_name,buyer_email,buyer_phone,description,amount_minor,currency,due_date,environment,provider) values ('Client','c@example.com','','Premium',10000,'EUR','2026-11-01','live','bank_transfer') returning id",
  );
  const id = row.rows[0]!.id;
  await db.query(
    "update payment_invoices set status='pending', provider_invoice_id=number where id=$1",
    [id],
  );
  return id;
}
test("approving receipt changes invoice and receipt atomically", async () => {
  const invoiceId = await invoice();
  const row = await db.query<{ id: string }>(
    "insert into bank_transfer_receipts(invoice_id,storage_path,content_type) values ($1,'a/screenshot.png','image/png') returning id",
    [invoiceId],
  );
  const receiptId = row.rows[0]!.id;
  await expect(
    db.query("select approve_bank_transfer_receipt($1,$2)", [receiptId, " "]),
  ).rejects.toThrow();
  expect(
    (
      await db.query<{ status: string }>("select status from payment_invoices where id=$1", [
        invoiceId,
      ])
    ).rows[0]?.status,
  ).toBe("pending");
  await db.query("select approve_bank_transfer_receipt($1,$2)", [receiptId, "BANK-456"]);
  expect(
    (
      await db.query<{ status: string; payment_id: string }>(
        "select status,payment_id from payment_invoices where id=$1",
        [invoiceId],
      )
    ).rows[0],
  ).toMatchObject({ status: "paid", payment_id: "BANK-456" });
  expect(
    (
      await db.query<{ status: string }>("select status from bank_transfer_receipts where id=$1", [
        receiptId,
      ])
    ).rows[0]?.status,
  ).toBe("approved");
  await expect(
    db.query("select approve_bank_transfer_receipt($1,$2)", [receiptId, "BANK-456"]),
  ).rejects.toThrow();
});
test("rejected evidence leaves bank invoice pending", async () => {
  const invoiceId = await invoice();
  await db.query(
    "insert into bank_transfer_receipts(invoice_id,storage_path,content_type,status) values ($1,'b/screenshot.jpg','image/jpeg','rejected')",
    [invoiceId],
  );
  expect(
    (
      await db.query<{ status: string }>("select status from payment_invoices where id=$1", [
        invoiceId,
      ])
    ).rows[0]?.status,
  ).toBe("pending");
});
test("only raster screenshot formats are accepted", () => {
  expect(imageType(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]))).toBe("image/png");
  expect(imageType(new Uint8Array([255, 216, 255]))).toBe("image/jpeg");
  expect(imageType(new TextEncoder().encode("<svg xmlns='x'>"))).toBeNull();
});
