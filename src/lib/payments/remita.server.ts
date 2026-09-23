import { createHash } from "node:crypto";
import type { Invoice, PaymentSetup } from "./types";

export function paymentSetup(): PaymentSetup {
  return {
    configured: [
      "REMITA_MERCHANT_ID",
      "REMITA_SERVICE_TYPE_ID",
      "REMITA_API_KEY",
      "REMITA_PUBLIC_KEY",
    ].every((key) => Boolean(process.env[key]?.trim())),
    emailConfigured: process.env.EMAIL_PROVIDER === "resend" && Boolean(process.env.RESEND_API_KEY),
    environment: process.env.REMITA_ENVIRONMENT === "live" ? "live" : "demo",
  };
}
export function remitaConfig(environment = paymentSetup().environment) {
  if (!paymentSetup().configured)
    throw new Error("Configure Remita credentials before issuing invoices.");
  if (environment !== paymentSetup().environment)
    throw new Error("This invoice belongs to a different Remita environment.");
  return {
    merchantId: process.env.REMITA_MERCHANT_ID!.trim(),
    serviceTypeId: process.env.REMITA_SERVICE_TYPE_ID!.trim(),
    apiKey: process.env.REMITA_API_KEY!.trim(),
    publicKey: process.env.REMITA_PUBLIC_KEY!.trim(),
    origin: environment === "live" ? "https://login.remita.net" : "https://remitademo.net",
  };
}
export const hash = (value: string) => createHash("sha512").update(value).digest("hex");
export function parseRemitaResponse(text: string): Record<string, unknown> {
  // Some Remita collections endpoints wrap JSON in jsonp(...). Never evaluate it.
  const clean = text
    .trim()
    .replace(/^jsonp\s*\(\s*/, "")
    .replace(/\s*\)\s*;?$/, "");
  const result: unknown = JSON.parse(clean);
  if (!result || typeof result !== "object" || Array.isArray(result))
    throw new Error("Invalid Remita response.");
  return result as Record<string, unknown>;
}
async function request(url: string, init?: RequestInit) {
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(20000) });
  } catch {
    throw new Error("Remita did not respond. Retry using this same invoice.");
  }
  if (!response.ok) throw new Error("Remita is unavailable. Please try again later.");
  try {
    return parseRemitaResponse(await response.text());
  } catch {
    throw new Error("Remita returned an unreadable response. Please retry later.");
  }
}
export async function generateRrr(invoice: Invoice) {
  const c = remitaConfig(invoice.environment);
  const amount = (invoice.amount_minor / 100).toFixed(2);
  const token = hash(c.merchantId + c.serviceTypeId + invoice.id + amount + c.apiKey);
  const result = await request(
    `${c.origin}/remita/exapp/api/v1/send/api/echannelsvc/merchant/api/paymentinit`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `remitaConsumerKey=${c.merchantId},remitaConsumerToken=${token}`,
      },
      body: JSON.stringify({
        serviceTypeId: c.serviceTypeId,
        amount,
        orderId: invoice.id,
        payerName: invoice.buyer_name,
        payerEmail: invoice.buyer_email,
        payerPhone: invoice.buyer_phone,
        description: invoice.description,
      }),
    },
  );
  // A retry uses the original order ID. Recover the original RRR if Remita
  // reports a duplicate order after a timeout or a failed database write.
  if (["027", "028", "055"].includes(String(result.statuscode))) {
    const recovered = await request(
      `${c.origin}/remita/ecomm/${encodeURIComponent(c.merchantId)}/${invoice.id}/${hash(invoice.id + c.apiKey + c.merchantId)}/orderstatus.reg`,
    );
    const reference = String(recovered.RRR ?? recovered.rrr ?? "");
    if (String(recovered.orderId) === invoice.id && /^\d{10,20}$/.test(reference)) return reference;
    throw new Error(
      "Remita already has this order but its reference could not be recovered. Contact support with the invoice ID; do not create a replacement.",
    );
  }
  const rrr = String(result.RRR ?? result.rrr ?? "");
  if (String(result.statuscode) !== "025" || !/^\d{10,20}$/.test(rrr)) {
    throw new Error(
      "Remita could not issue this invoice. Verify your merchant settings or retry this invoice; do not create a replacement for an uncertain request.",
    );
  }
  return rrr;
}
export function isVerifiedPayment(result: Record<string, unknown>, invoice: Invoice) {
  const status = String(result.status ?? "");
  const rrr = String(result.RRR ?? result.rrr ?? "");
  const amount = Number(result.amount);
  return (
    status === "00" &&
    rrr === invoice.rrr &&
    Number.isFinite(amount) &&
    Math.round(amount * 100) === invoice.amount_minor &&
    (result.orderId == null || String(result.orderId) === invoice.id) &&
    (result.currency == null || result.currency === "NGN")
  );
}
export async function checkRemita(invoice: Invoice) {
  const c = remitaConfig(invoice.environment);
  if (!invoice.rrr) throw new Error("Issue this invoice before checking payment.");
  const token = hash(invoice.rrr + c.apiKey + c.merchantId);
  return request(
    `${c.origin}/remita/ecomm/${encodeURIComponent(c.merchantId)}/${invoice.rrr}/${token}/status.reg`,
  );
}
