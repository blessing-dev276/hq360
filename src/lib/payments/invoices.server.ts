import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendEmail } from "@/lib/email.server";
import { checkRemita, generateRrr, isVerifiedPayment, paymentSetup } from "./remita.server";
import { money, type Invoice } from "./types";

const db = () => (supabaseAdmin as SupabaseClient).from("payment_invoices");
export const invoiceSchema = z.object({
  id: z.string().uuid(),
  buyer_name: z.string().trim().min(2).max(150),
  buyer_email: z.string().trim().email().max(254),
  buyer_phone: z
    .string()
    .trim()
    .regex(/^\+?[\d ()-]{7,25}$/),
  description: z.string().trim().min(3).max(1000),
  amount_minor: z.number().int().positive().max(10000000000),
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(
      (value) =>
        !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value,
      "Invalid date",
    ),
});
export function paymentJson(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
export function sameOrigin(request: Request) {
  return request.headers.get("origin") === new URL(request.url).origin;
}
export async function listInvoices() {
  const { data, error } = await db()
    .select("*")
    .eq("environment", paymentSetup().environment)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error)
    throw new Error(
      "Invoice storage is unavailable. Apply the payments migration and check the database connection.",
    );
  return data as Invoice[];
}
export async function getInvoice(id: string, byToken = false): Promise<Invoice> {
  const valid = byToken ? /^[a-f0-9]{64}$/.test(id) : z.string().uuid().safeParse(id).success;
  if (!valid) throw new Error("Invoice not found.");
  const { data, error } = await db()
    .select("*")
    .eq(byToken ? "payment_token" : "id", id)
    .maybeSingle();
  if (error) throw new Error("Invoice storage is unavailable.");
  if (!data) throw new Error("Invoice not found.");
  return data as Invoice;
}
export async function createInvoice(input: z.infer<typeof invoiceSchema>) {
  const { error } = await db().upsert(
    { ...input, environment: paymentSetup().environment },
    { onConflict: "id", ignoreDuplicates: true },
  );
  if (error)
    throw new Error("Could not save the invoice. Check the database connection and migration.");
  return getInvoice(input.id);
}
export async function issueInvoice(invoice: Invoice) {
  if (invoice.rrr) return invoice;
  // A durable claim prevents double clicks and concurrent requests from generating two RRRs.
  const { data, error } = await db()
    .update({ issue_locked_at: new Date().toISOString() })
    .eq("id", invoice.id)
    .is("rrr", null)
    .or(`issue_locked_at.is.null,issue_locked_at.lt.${new Date(Date.now() - 60000).toISOString()}`)
    .select("id");
  if (error || !data?.length)
    throw new Error("This invoice is being issued. Wait a minute before retrying.");
  try {
    const rrr = await generateRrr(invoice);
    const result = await db()
      .update({ rrr, status: "pending" })
      .eq("id", invoice.id)
      .is("rrr", null);
    if (result.error)
      throw new Error("The reference could not be saved. Retry this same invoice to recover it.");
    return await getInvoice(invoice.id);
  } finally {
    await db().update({ issue_locked_at: null }).eq("id", invoice.id);
  }
}
export async function verifyInvoice(invoice: Invoice) {
  if (invoice.status === "paid") return invoice;
  // Database-backed throttle also covers public callers and multiple server instances.
  const { data, error } = await db()
    .update({ checked_at: new Date().toISOString() })
    .eq("id", invoice.id)
    .or(`checked_at.is.null,checked_at.lt.${new Date(Date.now() - 15000).toISOString()}`)
    .select("id");
  if (error) throw new Error("Payment verification is unavailable.");
  if (!data?.length) return getInvoice(invoice.id);
  const result = await checkRemita(invoice);
  if (isVerifiedPayment(result, invoice)) {
    const saved = await db()
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", invoice.id)
      .neq("status", "paid");
    if (saved.error)
      throw new Error("Payment verified but could not be saved. Please check again.");
  }
  return getInvoice(invoice.id);
}
export function invoiceLink(invoice: Invoice) {
  const site = new URL(process.env.SITE_URL || "https://www.hq360.space");
  if (site.protocol !== "https:" && site.hostname !== "localhost")
    throw new Error("Configure a secure SITE_URL before sending invoices.");
  return `${site.origin}/pay/${invoice.payment_token}`;
}
export async function emailInvoice(invoice: Invoice) {
  if (!invoice.rrr) throw new Error("Issue the invoice before sending it.");
  if (invoice.status === "paid") throw new Error("This invoice has already been paid.");
  const result = await sendEmail({
    to: invoice.buyer_email,
    subject: `${invoice.environment === "demo" ? "[TEST] " : ""}Your HQ360 invoice ${invoice.number}`,
    text: `${invoice.environment === "demo" ? "TEST INVOICE — no real payment will be collected.\n\n" : ""}Hello ${invoice.buyer_name},\n\nYour invoice ${invoice.number} is ready.\n\n${invoice.description}\nAmount: ${money(invoice.amount_minor)}\nDue: ${invoice.due_date}\nRemita reference: ${invoice.rrr}\n\nView your invoice and pay securely:\n${invoiceLink(invoice)}\n\nThank you,\nHQ360`,
  });
  if (!result.sent)
    throw new Error(
      "The invoice was not emailed. Check the email provider settings, or copy the payment link.",
    );
  const saved = await db().update({ sent_at: new Date().toISOString() }).eq("id", invoice.id);
  if (saved.error)
    throw new Error(
      "Email sent, but delivery time could not be saved. Avoid sending again immediately.",
    );
  return getInvoice(invoice.id);
}
