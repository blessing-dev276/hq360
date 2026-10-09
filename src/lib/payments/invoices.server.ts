import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { leadInboxAddress, sendEmail } from "@/lib/email.server";
import * as nowpayments from "./nowpayments.server";
import * as flutterwave from "./flutterwave.server";
import {
  money,
  providerLabel,
  RejectedInvoiceError,
  type Invoice,
  type PaymentSetup,
} from "./types";

const ACTIVE_PROVIDERS = ["bank_transfer", "nowpayments", "flutterwave"] as const;
const HOSTED_PROVIDERS = ["nowpayments", "flutterwave"] as const;
type HostedProvider = (typeof HOSTED_PROVIDERS)[number];
type ProviderModule = {
  paymentSetup: () => { configured: boolean; environment: Invoice["environment"] };
  assertReady: (environment: Invoice["environment"]) => void;
  createHostedInvoice: (
    invoice: Invoice,
  ) => Promise<{ provider_invoice_id: string; checkout_url: string; payment_id?: string }>;
  checkPayment: (
    reference: string,
    environment: Invoice["environment"],
  ) => Promise<Record<string, unknown>>;
  paymentMatches: (result: Record<string, unknown>, invoice: Invoice) => boolean;
  isVerifiedPayment: (result: Record<string, unknown>, invoice: Invoice) => boolean;
  statusOf: (result: Record<string, unknown>) => string;
  isRefunded: (result: Record<string, unknown>) => boolean;
  checkoutUrl: (value: unknown, environment: Invoice["environment"]) => string;
};
const providers: Record<HostedProvider, ProviderModule> = { nowpayments, flutterwave };
function providerModule(name: Invoice["provider"]) {
  if (name !== "nowpayments" && name !== "flutterwave")
    throw new Error("This provider is no longer supported for new invoices.");
  return providers[name];
}
function addDays(date: string, days: number) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400_000).toISOString().slice(0, 10);
}
/** A stable UUID derived from another, for the balance half of a split. */
function derivedId(id: string) {
  const hex = createHash("sha256").update(`balance:${id}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
export function combinedSetup(): PaymentSetup {
  return {
    bank_transfer: { configured: true, environment: "live" },
    emailConfigured: process.env.EMAIL_PROVIDER === "resend" && Boolean(process.env.RESEND_API_KEY),
    nowpayments: nowpayments.paymentSetup(),
    flutterwave: flutterwave.paymentSetup(),
  };
}
export function checkoutUrlFor(invoice: Invoice) {
  if (invoice.provider === "bank_transfer") return "";
  return providerModule(invoice.provider).checkoutUrl(invoice.checkout_url, invoice.environment);
}

const db = () => (supabaseAdmin as SupabaseClient).from("payment_invoices");
export const invoiceSchema = z.object({
  id: z.string().uuid(),
  provider: z.enum(ACTIVE_PROVIDERS),
  buyer_name: z.string().trim().min(2).max(150),
  buyer_email: z.string().trim().email().max(254),
  buyer_phone: z
    .string()
    .trim()
    .regex(/^\+?[\d ()-]{7,25}$/)
    .or(z.literal(""))
    .default(""),
  description: z.string().trim().min(3).max(1000),
  title: z.string().trim().max(200).optional(),
  /** Split into 50% to start (this invoice) and 50% on delivery (a linked draft). */
  split: z.boolean().optional(),
  balance_due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  package_name: z.string().trim().max(160).optional(),
  included: z
    .array(z.string().trim().max(300))
    .max(30)
    .transform((items) => items.filter(Boolean))
    .optional(),
  amount_minor: z.number().int().positive().max(10000000000),
  currency: z.enum(["USD", "EUR"]).optional(),
  bank_transfer_amount_minor: z.number().int().positive().max(10000000000).optional(),
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(
      (value) =>
        !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value,
      "Invalid date",
    ),
  requested_by_expert_id: z.string().uuid().optional(),
  /** Expert the buyer sees as the sender; omitted = HQ360. */
  sender_expert_id: z.string().uuid().optional(),
  source_quote_id: z.string().uuid().optional(),
  source_package_index: z.number().int().min(0).max(3).optional(),
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
    .select(
      "*, requested_by:expert_profiles!payment_invoices_requested_by_expert_id_fkey(full_name, email)",
    )
    .in("provider", ACTIVE_PROVIDERS)
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
  if (!data || !ACTIVE_PROVIDERS.includes(data.provider)) throw new Error("Invoice not found.");
  return data as Invoice;
}
export async function createInvoice(input: z.infer<typeof invoiceSchema>) {
  const currency = input.currency ?? (input.provider === "bank_transfer" ? "EUR" : "USD");
  if (input.provider === "bank_transfer") {
    if (!(["USD", "EUR"] as string[]).includes(currency))
      throw new Error("Unsupported bank invoice currency.");
    if (currency === "USD" && !input.bank_transfer_amount_minor)
      throw new Error("Enter the agreed EUR transfer amount for a USD invoice.");
  } else if (currency !== "USD" || input.bank_transfer_amount_minor)
    throw new Error("Hosted checkout invoices use USD and do not have a EUR transfer amount.");
  const environment =
    input.provider === "bank_transfer"
      ? "live"
      : providerModule(input.provider).paymentSetup().environment;
  const { split, balance_due_date, ...fields } = input;
  const base = {
    ...fields,
    // The requesting expert is the sender unless another one was picked.
    sender_expert_id: input.sender_expert_id ?? input.requested_by_expert_id ?? null,
    currency,
    environment,
  };
  const rows: Record<string, unknown>[] = [];
  if (split) {
    // 50% to start now, 50% on delivery. The balance is a linked draft the
    // admin issues when the work is delivered. Its id is derived from the
    // deposit's, so a retried request never creates a second balance.
    const half = (n: number) => Math.ceil(n / 2);
    const balanceId = derivedId(input.id);
    const bank = input.bank_transfer_amount_minor;
    rows.push(
      {
        ...base,
        amount_minor: half(input.amount_minor),
        bank_transfer_amount_minor: bank ? half(bank) : bank,
        installment: "deposit",
        installment_group: input.id,
        project_total_minor: input.amount_minor,
      },
      {
        ...base,
        id: balanceId,
        amount_minor: input.amount_minor - half(input.amount_minor),
        bank_transfer_amount_minor: bank ? bank - half(bank) : bank,
        due_date: balance_due_date ?? addDays(input.due_date, 30),
        installment: "balance",
        installment_group: input.id,
        project_total_minor: input.amount_minor,
      },
    );
  } else rows.push(base);
  const { error } = await db().upsert(rows, { onConflict: "id", ignoreDuplicates: true });
  if (error)
    throw new Error("Could not save the invoice. Check the database connection and migration.");
  return getInvoice(input.id);
}
export async function deleteDraft(id: string) {
  if (!z.string().uuid().safeParse(id).success) throw new Error("Invalid invoice ID.");
  // Atomic predicate prevents deletion racing with an issuance claim.
  const { data, error } = await db()
    .delete()
    .eq("id", id)
    .in("provider", ACTIVE_PROVIDERS)
    .eq("status", "draft")
    .is("provider_invoice_id", null)
    .is("payment_id", null)
    .is("issue_locked_at", null)
    .is("rrr", null)
    .select("id");
  if (error) throw new Error("Could not delete the draft. Please try again.");
  if (!data?.length)
    throw new Error(
      "Only unissued drafts can be deleted. This invoice may have been issued, be awaiting reconciliation, or already be deleted.",
    );
}
export async function cancelInvoice(id: string) {
  if (!z.string().uuid().safeParse(id).success) throw new Error("Invalid invoice ID.");
  // Cancel, not delete: the checkout link stays live at the provider, so the
  // row must survive for a late webhook to find and ignore. Only an unpaid,
  // unrefunded invoice can be cancelled.
  const { data, error } = await db()
    .update({ status: "cancelled" })
    .eq("id", id)
    .in("provider", ACTIVE_PROVIDERS)
    .eq("status", "pending")
    .select("id");
  if (error) throw new Error("Could not cancel this invoice. Please try again.");
  if (!data?.length) throw new Error("Only an issued, unpaid invoice can be cancelled.");
}
export async function issueInvoice(invoice: Invoice) {
  if (invoice.provider === "bank_transfer") {
    if (invoice.provider_invoice_id) return invoice;
    const { error, data } = await db()
      .update({ status: "pending", provider_invoice_id: invoice.number })
      .eq("id", invoice.id)
      .eq("provider", "bank_transfer")
      .in("currency", ["USD", "EUR"])
      .eq("status", "draft")
      .is("provider_invoice_id", null)
      .select("id");
    if (error || !data?.length) throw new Error("Could not issue the bank transfer invoice.");
    return getInvoice(invoice.id);
  }
  const mod = providerModule(invoice.provider);
  if (invoice.provider_invoice_id) return invoice;
  // Validate local configuration before claiming the one-shot provider request.
  mod.assertReady(invoice.environment);
  // Flutterwave payments are keyed by our own tx_ref (the invoice id), so a
  // retry can't create a second payable record; a lock left by a crashed or
  // rejected attempt may be reclaimed once it's stale. Other providers stay
  // one-shot until reconciled by hand.
  const current = await db()
    .select("issue_locked_at")
    .eq("id", invoice.id)
    .maybeSingle<{ issue_locked_at: string | null }>();
  const lockedAt = current.data?.issue_locked_at ?? null;
  const stale =
    invoice.provider === "flutterwave" &&
    lockedAt !== null &&
    Date.now() - new Date(lockedAt).getTime() > 60 * 1000;
  const claim = db()
    .update({ issue_locked_at: new Date().toISOString() })
    .eq("id", invoice.id)
    .is("provider_invoice_id", null);
  const { data, error } = await (
    stale && lockedAt ? claim.eq("issue_locked_at", lockedAt) : claim.is("issue_locked_at", null)
  ).select("id");
  if (error || !data?.length)
    throw new Error(
      `Issuance is in progress or needs reconciliation. Check ${providerLabel(invoice.provider)} before attempting another invoice.`,
    );
  try {
    const reference = await mod.createHostedInvoice(invoice);
    const saved = await db()
      .update({ ...reference, status: "pending", issue_locked_at: null })
      .eq("id", invoice.id)
      .is("provider_invoice_id", null);
    if (saved.error)
      throw new Error(
        `${providerLabel(invoice.provider)} created the invoice but its reference could not be saved. Reconcile this order there before retrying.`,
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
  const mod = providerModule(invoice.provider);
  const result = await mod.checkPayment(paymentId, invoice.environment);
  if (!mod.paymentMatches(result, invoice))
    throw new Error("Payment details do not match this invoice.");
  const paid = mod.isVerifiedPayment(result, invoice);
  const refunded = mod.isRefunded(result);
  const update: Record<string, unknown> = {
    payment_id: paymentId,
    provider_status: mod.statusOf(result),
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
export async function confirmBankTransfer(invoice: Invoice, reference: unknown) {
  const parsed = z.string().trim().min(3).max(200).safeParse(reference);
  if (invoice.provider !== "bank_transfer" || !parsed.success)
    throw new Error("Enter the bank transaction reference after confirming receipt.");
  const { data: pendingReceipt, error: receiptError } = await (supabaseAdmin as SupabaseClient)
    .from("bank_transfer_receipts")
    .select("id")
    .eq("invoice_id", invoice.id)
    .eq("status", "submitted")
    .maybeSingle();
  if (receiptError) throw new Error("Could not check the buyer's screenshot.");
  if (pendingReceipt) throw new Error("Review the buyer's screenshot before confirming payment.");
  const { error, data } = await db()
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      payment_id: parsed.data,
      provider_status: "receipt_confirmed_by_admin",
    })
    .eq("id", invoice.id)
    .eq("provider", "bank_transfer")
    .in("currency", ["USD", "EUR"])
    .eq("status", "pending")
    .select("id");
  if (error || !data?.length)
    throw new Error("Only an unpaid bank transfer invoice can be confirmed.");
  return getInvoice(invoice.id);
}
export async function verifyInvoice(invoice: Invoice) {
  if (invoice.provider === "bank_transfer") return getInvoice(invoice.id);
  providerModule(invoice.provider);
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
  if (invoice.provider !== "bank_transfer") providerModule(invoice.provider);
  if (!invoice.provider_invoice_id) throw new Error("Issue the invoice before sending it.");
  if (invoice.status === "cancelled") throw new Error("This invoice was cancelled.");
  if (["paid", "refunded"].includes(invoice.status))
    throw new Error("This invoice has already been paid.");
  const { buildInvoiceEmail } = await import("./invoice-email");
  const link = invoiceLink(invoice);
  const sender = await invoiceSender(invoice.sender_expert_id);
  const email = buildInvoiceEmail(invoice, link, new URL(link).origin, sender?.name);
  const result = await sendEmail({
    to: invoice.buyer_email,
    subject: email.subject,
    text: email.text,
    html: email.html,
    // Replies reach a real, monitored inbox -- a signal of a genuine sender.
    replyTo: leadInboxAddress(),
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

/** The expert a buyer sees as an invoice's sender, or null for HQ360. */
export async function invoiceSender(expertId: string | null | undefined) {
  if (!expertId) return null;
  const { data } = await (supabaseAdmin as SupabaseClient)
    .from("expert_profiles")
    .select("full_name, headline, photo_url, slug, is_public")
    .eq("id", expertId)
    .maybeSingle();
  const e = data as {
    full_name: string | null;
    headline: string | null;
    photo_url: string | null;
    slug: string | null;
    is_public: boolean;
  } | null;
  if (!e?.full_name) return null;
  return {
    name: e.full_name,
    headline: e.headline || "HQ360 expert",
    photo: e.photo_url,
    profileUrl: e.is_public && e.slug ? `/experts/${e.slug}` : null,
  };
}

export async function setInvoiceSender(id: string, expertId: string | null) {
  if (!z.string().uuid().safeParse(id).success) throw new Error("Invoice not found.");
  if (expertId) {
    const { data } = await (supabaseAdmin as SupabaseClient)
      .from("expert_profiles")
      .select("id")
      .eq("id", expertId)
      .eq("status", "approved")
      .maybeSingle();
    if (!data) throw new Error("That expert isn't approved.");
  }
  const { error } = await db().update({ sender_expert_id: expertId }).eq("id", id);
  if (error) throw new Error("Could not change the sender.");
}
