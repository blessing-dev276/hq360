import { createHmac, timingSafeEqual } from "node:crypto";
import type { Invoice, PaymentSetup } from "./types";

export function paymentSetup(): PaymentSetup {
  return {
    configured: Boolean(
      process.env.NOWPAYMENTS_API_KEY?.trim() && process.env.NOWPAYMENTS_IPN_SECRET?.trim(),
    ),
    emailConfigured: process.env.EMAIL_PROVIDER === "resend" && Boolean(process.env.RESEND_API_KEY),
    environment: process.env.NOWPAYMENTS_ENVIRONMENT === "live" ? "live" : "demo",
  };
}
export function nowpaymentsConfig(environment = paymentSetup().environment) {
  if (!paymentSetup().configured)
    throw new Error("Configure the NOWPayments API key and IPN secret before issuing invoices.");
  if (environment !== paymentSetup().environment)
    throw new Error("This invoice belongs to a different NOWPayments environment.");
  return {
    apiKey: process.env.NOWPAYMENTS_API_KEY!.trim(),
    base:
      environment === "live"
        ? "https://api.nowpayments.io/v1"
        : "https://api-sandbox.nowpayments.io/v1",
  };
}
export function siteOrigin() {
  const site = new URL(process.env.SITE_URL || "https://www.hq360.space");
  if (site.protocol !== "https:")
    throw new Error("Configure a public HTTPS SITE_URL for NOWPayments callbacks.");
  return site.origin;
}
export function checkoutUrl(value: unknown, environment: Invoice["environment"]) {
  if (typeof value !== "string") throw new Error("NOWPayments returned an invalid checkout link.");
  const url = new URL(value);
  const allowed = environment === "live" ? ["nowpayments.io"] : ["sandbox.nowpayments.io"];
  if (
    url.protocol !== "https:" ||
    !allowed.includes(url.hostname) ||
    url.username ||
    url.password ||
    url.port
  )
    throw new Error("NOWPayments returned an unexpected checkout host.");
  return url.href;
}
export class RejectedInvoiceError extends Error {}
async function request(path: string, environment: Invoice["environment"], body?: unknown) {
  const c = nowpaymentsConfig(environment);
  let response: Response;
  try {
    response = await fetch(`${c.base}${path}`, {
      method: body ? "POST" : "GET",
      headers: { "x-api-key": c.apiKey, "content-type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new Error(
      "NOWPayments did not respond. Invoice issuance may need reconciliation before another attempt.",
    );
  }
  if (!response.ok) {
    if (body && [400, 401, 403, 422, 429].includes(response.status))
      throw new RejectedInvoiceError(
        "NOWPayments rejected the invoice. Check your API key, supported price currency and minimum amount before retrying.",
      );
    throw new Error("NOWPayments is unavailable. Please check again later.");
  }
  const result: unknown = await response.json();
  if (!result || typeof result !== "object" || Array.isArray(result))
    throw new Error("Invalid NOWPayments response.");
  return result as Record<string, unknown>;
}
export async function createHostedInvoice(invoice: Invoice) {
  nowpaymentsConfig(invoice.environment);
  const origin = siteOrigin();
  const result = await request("/invoice", invoice.environment, {
    price_amount: invoice.amount_minor / 100,
    price_currency: invoice.currency.toLowerCase(),
    order_id: invoice.id,
    order_description: `${invoice.number}: ${invoice.description}`,
    ipn_callback_url: `${origin}/api/payments/nowpayments/ipn`,
    success_url: `${origin}/pay/${invoice.payment_token}`,
    cancel_url: `${origin}/pay/${invoice.payment_token}`,
  });
  const id = String(result.id ?? "");
  if (!/^\d+$/.test(id))
    throw new Error(
      "NOWPayments returned an invalid invoice reference. Reconcile this invoice before retrying.",
    );
  return {
    provider_invoice_id: id,
    checkout_url: checkoutUrl(result.invoice_url, invoice.environment),
  };
}
function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, item]) => [key, sortDeep(item)]),
    );
  return value;
}
export function verifyIpnSignature(payload: unknown, signature: string | null) {
  const secret = process.env.NOWPAYMENTS_IPN_SECRET?.trim();
  if (!secret || !signature || !/^[a-f0-9]{128}$/i.test(signature)) return false;
  const expected = createHmac("sha512", secret)
    .update(JSON.stringify(sortDeep(payload)))
    .digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}
export function paymentMatches(result: Record<string, unknown>, invoice: Invoice) {
  return (
    invoice.provider === "nowpayments" &&
    !!invoice.provider_invoice_id &&
    String(result.invoice_id) === invoice.provider_invoice_id &&
    String(result.order_id) === invoice.id &&
    String(result.price_currency).toUpperCase() === invoice.currency &&
    Number.isFinite(Number(result.price_amount)) &&
    Math.round(Number(result.price_amount) * 100) === invoice.amount_minor
  );
}
export function isVerifiedPayment(result: Record<string, unknown>, invoice: Invoice) {
  const due = Number(result.pay_amount),
    received = Number(result.actually_paid);
  return (
    paymentMatches(result, invoice) &&
    result.payment_status === "finished" &&
    Number.isFinite(due) &&
    due > 0 &&
    Number.isFinite(received) &&
    received >= due
  );
}
export async function checkPayment(paymentId: string, environment: Invoice["environment"]) {
  if (!/^\d+$/.test(paymentId)) throw new Error("Invalid NOWPayments payment reference.");
  const result = await request(`/payment/${paymentId}`, environment);
  if (String(result.payment_id) !== paymentId)
    throw new Error("NOWPayments payment reference did not match.");
  return result;
}
