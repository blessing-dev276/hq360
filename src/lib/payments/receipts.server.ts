import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isAdminRequest } from "@/lib/admin-auth.server";
import { isExpertRequest } from "@/lib/expert-auth.server";
import { leadInboxAddress, sendEmail } from "@/lib/email.server";
import { money, type Invoice } from "./types";

const db = supabaseAdmin as SupabaseClient;
const bucket = () => db.storage.from("bank-transfer-receipts");
const receipts = () => db.from("bank_transfer_receipts");
export const MAX_RECEIPT_BYTES = 4 * 1024 * 1024;

export async function canReviewBankReceipts(request: Request) {
  if (await isAdminRequest(request)) return true;
  const expertId = await isExpertRequest(request);
  if (!expertId) return false;
  const { data } = await db
    .from("expert_profiles")
    .select("is_founder")
    .eq("id", expertId)
    .maybeSingle();
  return data?.is_founder === true;
}

export function imageType(bytes: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "image/jpeg";
  if (
    bytes.length >= 8 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((value, i) => bytes[i] === value)
  )
    return "image/png";
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  )
    return "image/webp";
  return null;
}

export async function submitBankReceipt(invoice: Invoice, file: File) {
  if (
    invoice.provider !== "bank_transfer" ||
    invoice.status !== "pending" ||
    !invoice.provider_invoice_id
  )
    throw new Error("This invoice is not awaiting a bank transfer.");
  if (file.size < 100 || file.size > MAX_RECEIPT_BYTES)
    throw new Error("Choose a screenshot under 4 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const contentType = imageType(bytes);
  if (!contentType || file.type !== contentType)
    throw new Error("Choose a PNG, JPEG or WebP screenshot.");
  const { data: old, error: oldError } = await receipts()
    .select("id,status")
    .eq("invoice_id", invoice.id)
    .order("submitted_at", { ascending: false })
    .limit(4);
  if (oldError) throw new Error("Could not check earlier submissions.");
  if (old?.some((row) => row.status === "submitted"))
    throw new Error("Your screenshot is already awaiting review.");
  if ((old?.length ?? 0) >= 3) throw new Error("Please contact HQ360 about this invoice.");
  const id = crypto.randomUUID();
  const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  const path = `${invoice.id}/${id}.${ext}`;
  const upload = await bucket().upload(path, bytes, { contentType, upsert: false });
  if (upload.error) throw new Error("Could not upload the screenshot. Please try again.");
  const inserted = await receipts()
    .insert({ id, invoice_id: invoice.id, storage_path: path, content_type: contentType })
    .select("id,status,submitted_at")
    .single();
  if (inserted.error || !inserted.data) {
    await bucket().remove([path]);
    if (inserted.error?.code === "23505")
      throw new Error("Your screenshot is already awaiting review.");
    throw new Error("Could not save the screenshot. Please try again.");
  }
  await db.from("notifications").insert({
    audience: "admin",
    kind: "bank_receipt_submitted",
    title: `Bank receipt for ${invoice.number}`,
    body: `${invoice.buyer_name} submitted a transfer screenshot for review.`,
    tab: "payments",
  });
  // Email delivery does not change the receipt state; reviewers can still find it in Payments.
  await notifyReviewers(invoice, id, bytes, contentType).catch(() => undefined);
  return inserted.data;
}

async function notifyReviewers(
  invoice: Invoice,
  id: string,
  bytes: Uint8Array,
  contentType: string,
) {
  const { data: founder } = await db
    .from("expert_profiles")
    .select("email")
    .eq("is_founder", true)
    .maybeSingle();
  const recipients = [
    ...new Set(
      [
        leadInboxAddress(),
        ...(process.env.ADMIN_NOTIFY_EMAIL ?? "").split(","),
        founder?.email ?? "",
      ]
        .map((x) => x.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  const site = new URL(process.env.SITE_URL || "https://www.hq360.space").origin;
  const link = `${site}/payment-review/${id}`;
  const transfer = money(invoice.bank_transfer_amount_minor ?? invoice.amount_minor, "EUR");
  const subject = `Review bank transfer screenshot for ${invoice.number}`;
  const text = `${invoice.buyer_name} submitted a screenshot for invoice ${invoice.number}.\nInvoice total: ${money(invoice.amount_minor, invoice.currency)}. Expected EUR transfer: ${transfer}.\n\nOpen the secure review screen:\n${link}\n\nThe screenshot alone does not confirm payment. Check the bank account and enter the bank transaction reference before approving.`;
  const attachment = {
    filename: `receipt-${invoice.number}.${contentType.split("/")[1] === "jpeg" ? "jpg" : contentType.split("/")[1]}`,
    content: Buffer.from(bytes).toString("base64"),
    content_type: contentType,
  };
  await Promise.all(
    recipients.map((to) => sendEmail({ to, subject, text, attachments: [attachment] })),
  );
}

export async function getBankReceipt(id: string) {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Receipt not found.");
  const { data, error } = await receipts().select("*").eq("id", id).maybeSingle();
  if (error || !data) throw new Error("Receipt not found.");
  const { data: invoice, error: invoiceError } = await db
    .from("payment_invoices")
    .select(
      "id,number,buyer_name,buyer_email,description,amount_minor,currency,bank_transfer_amount_minor,status,provider,payment_id",
    )
    .eq("id", data.invoice_id)
    .maybeSingle();
  if (invoiceError || !invoice) throw new Error("Invoice not found.");
  return { receipt: data, invoice };
}

export async function receiptImage(path: string) {
  const { data, error } = await bucket().download(path);
  if (error || !data) throw new Error("Screenshot unavailable.");
  return data;
}
