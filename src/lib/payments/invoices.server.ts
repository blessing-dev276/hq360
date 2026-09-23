import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendEmail } from "@/lib/email.server";
import {
  checkPayment,
  createHostedInvoice,
  isVerifiedPayment,
  paymentMatches,
  paymentSetup,
  RejectedInvoiceError,
} from "./nowpayments.server";
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
    .eq("provider", "nowpayments")
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
  if (!data || data.provider !== "nowpayments") throw new Error("Invoice not found.");
  return data as Invoice;
}
export async function createInvoice(input: z.infer<typeof invoiceSchema>) {
  const { error } = await db().upsert(
    { ...input, provider: "nowpayments", environment: paymentSetup().environment },
    { onConflict: "id", ignoreDuplicates: true },
  );
  if (error)
    throw new Error("Could not save the invoice. Check the database connection and migration.");
  return getInvoice(input.id);
}
export async function issueInvoice(invoice: Invoice) {
  if (invoice.provider_invoice_id) return invoice;
  // Validate local configuration before claiming the one-shot provider request.
  const { nowpaymentsConfig, siteOrigin } = await import("./nowpayments.server");
  nowpaymentsConfig(invoice.environment);
  siteOrigin();
  const { data, error } = await db()
    .update({ issue_locked_at: new Date().toISOString() })
    .eq("id", invoice.id)
    .is("provider_invoice_id", null)
    .is("issue_locked_at", null)
    .select("id");
  if (error || !data?.length)
    throw new Error(
      "Issuance is in progress or needs reconciliation. Check NOWPayments before attempting another invoice.",
    );
  try {
    const reference = await createHostedInvoice(invoice);
    const saved = await db()
      .update({ ...reference, status: "pending", issue_locked_at: null })
      .eq("id", invoice.id)
      .is("provider_invoice_id", null);
    if (saved.error)
      throw new Error(
        "NOWPayments created the invoice but its reference could not be saved. Reconcile this order in NOWPayments before retrying.",
      );
    return await getInvoice(invoice.id);
  } catch (error) {
    // No documented idempotency guarantee: timeouts/5xx must not trigger duplicate invoices.
    if (error instanceof RejectedInvoiceError)
      await db().update({ issue_locked_at: null }).eq("id", invoice.id);
    throw error;
  }
}
export async function reconcilePayment(invoice: Invoice, paymentId: string) {
  const result = await checkPayment(paymentId, invoice.environment);
  if (!paymentMatches(result, invoice))
    throw new Error("Payment details do not match this invoice.");
  const paid = isVerifiedPayment(result, invoice);
  const refunded = result.payment_status === "refunded";
  const update: Record<string, unknown> = {
    payment_id: paymentId,
    provider_status: String(result.payment_status),
    checked_at: new Date().toISOString(),
  };
  if (paid) Object.assign(update, { status: "paid", paid_at: new Date().toISOString() });
  if (refunded) Object.assign(update, { status: "refunded" });
  let query = db().update(update).eq("id", invoice.id);
  // Only the payment which settled the invoice can refund it. Delayed events
  // and other checkout attempts must never downgrade or resurrect it.
  if (refunded) query = query.eq("payment_id", paymentId).eq("status", "paid");
  else query = query.in("status", ["draft", "pending"]);
  const { error } = await query;
  if (error) throw new Error("Payment status could not be saved. Please check again.");
  return getInvoice(invoice.id);
}
export async function verifyInvoice(invoice: Invoice) {
  if (!invoice.provider_invoice_id) throw new Error("Issue this invoice before checking payment.");
  // The signed IPN supplies the payment ID once the buyer chooses a coin.
  if (!invoice.payment_id || invoice.status === "refunded") return invoice;
  const { data, error } = await db()
    .update({ checked_at: new Date().toISOString() })
    .eq("id", invoice.id)
    .or(`checked_at.is.null,checked_at.lt.${new Date(Date.now() - 15000).toISOString()}`)
    .select("id");
  if (error) throw new Error("Payment verification is unavailable.");
  if (!data?.length) return getInvoice(invoice.id);
  return reconcilePayment(invoice, invoice.payment_id);
}
export function invoiceLink(invoice: Invoice) {
  const site = new URL(process.env.SITE_URL || "https://www.hq360.space");
  if (site.protocol !== "https:" && site.hostname !== "localhost")
    throw new Error("Configure a secure SITE_URL before sending invoices.");
  return `${site.origin}/pay/${invoice.payment_token}`;
}
export async function emailInvoice(invoice: Invoice) {
  if (!invoice.provider_invoice_id) throw new Error("Issue the invoice before sending it.");
  if (["paid", "refunded"].includes(invoice.status))
    throw new Error("This invoice has already been paid.");
  const result = await sendEmail({
    to: invoice.buyer_email,
    subject: `${invoice.environment === "demo" ? "[TEST] " : ""}Your HQ360 invoice ${invoice.number}`,
    text: `${invoice.environment === "demo" ? "TEST INVOICE — no real payment will be collected.\n\n" : ""}Hello ${invoice.buyer_name},\n\nYour invoice ${invoice.number} is ready.\n\n${invoice.description}\nAmount: ${money(invoice.amount_minor)}\nDue: ${invoice.due_date}\nNOWPayments invoice: ${invoice.provider_invoice_id}\n\nView your invoice and pay securely:\n${invoiceLink(invoice)}\n\nThank you,\nHQ360`,
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
