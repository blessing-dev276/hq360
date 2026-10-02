import { timingSafeEqual } from "node:crypto";
import { RejectedInvoiceError, type Invoice, type ProviderSetup } from "./types";

const API_BASE = "https://api.flutterwave.com/v3";

export function paymentSetup(): ProviderSetup {
  return {
    configured: Boolean(
      process.env.FLUTTERWAVE_SECRET_KEY?.trim() && process.env.FLUTTERWAVE_WEBHOOK_SECRET?.trim(),
    ),
    environment: process.env.FLUTTERWAVE_ENVIRONMENT === "live" ? "live" : "demo",
  };
}
export function assertReady(environment: Invoice["environment"]) {
  flutterwaveConfig(environment);
  siteOrigin();
}
export function statusOf(result: Record<string, unknown>) {
  return String(result.status);
}
export function isRefunded(result: Record<string, unknown>) {
  return result.status === "refunded";
}
export function flutterwaveConfig(environment = paymentSetup().environment) {
  if (!paymentSetup().configured)
    throw new Error(
      "Configure the Flutterwave secret key and webhook secret before issuing invoices.",
    );
  if (environment !== paymentSetup().environment)
    throw new Error("This invoice belongs to a different Flutterwave environment.");
  return { secretKey: process.env.FLUTTERWAVE_SECRET_KEY!.trim() };
}
export function siteOrigin() {
  const site = new URL(process.env.SITE_URL || "https://www.hq360.space");
  if (site.protocol !== "https:")
    throw new Error("Configure a public HTTPS SITE_URL for Flutterwave callbacks.");
  return site.origin;
}
// Live checkouts are always on checkout.flutterwave.com; test-mode keys get
// links on Flutterwave's sandbox hosts instead.
const LIVE_CHECKOUT_HOSTS = ["checkout.flutterwave.com"];
const TEST_CHECKOUT_HOSTS = [
  ...LIVE_CHECKOUT_HOSTS,
  "checkout-testing.flutterwave.com",
  "ravemodal-dev.herokuapp.com",
];
export function checkoutUrl(value: unknown, environment?: Invoice["environment"]) {
  if (typeof value !== "string") throw new Error("Flutterwave returned an invalid checkout link.");
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    !(environment === "live" ? LIVE_CHECKOUT_HOSTS : TEST_CHECKOUT_HOSTS).includes(url.hostname) ||
    url.username ||
    url.password ||
    url.port
  )
    throw new Error("Flutterwave returned an unexpected checkout host.");
  return url.href;
}
async function request(
  path: string,
  environment: Invoice["environment"],
  method: "GET" | "POST",
  body?: unknown,
) {
  const c = flutterwaveConfig(environment);
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: { Authorization: `Bearer ${c.secretKey}`, "content-type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new Error(
      "Flutterwave did not respond. Invoice issuance may need reconciliation before another attempt.",
    );
  }
  if (!response.ok) {
    if (body && [400, 401, 403, 422, 429].includes(response.status))
      throw new RejectedInvoiceError(
        "Flutterwave rejected the invoice. Check your API key, supported currency and minimum amount before retrying.",
      );
    throw new Error("Flutterwave is unavailable. Please check again later.");
  }
  const result: unknown = await response.json();
  if (!result || typeof result !== "object" || Array.isArray(result))
    throw new Error("Invalid Flutterwave response.");
  return result as Record<string, unknown>;
}
export async function createHostedInvoice(invoice: Invoice) {
  flutterwaveConfig(invoice.environment);
  const origin = siteOrigin();
  // We control tx_ref (the invoice's own id), so it's known immediately --
  // unlike NOWPayments there's no separate async "payment id" discovery step.
  const result = await request("/payments", invoice.environment, "POST", {
    tx_ref: invoice.id,
    amount: invoice.amount_minor / 100,
    currency: invoice.currency,
    redirect_url: `${origin}/pay/${invoice.payment_token}`,
    customer: {
      email: invoice.buyer_email,
      phonenumber: invoice.buyer_phone,
      name: invoice.buyer_name,
    },
    customizations: {
      title: `HQ360 invoice ${invoice.number}`,
      description: invoice.description.slice(0, 200),
    },
  });
  const data = result.data as Record<string, unknown> | undefined;
  const link = data?.link;
  if (typeof link !== "string") throw new Error("Flutterwave did not return a checkout link.");
  return {
    provider_invoice_id: invoice.id,
    checkout_url: checkoutUrl(link, invoice.environment),
    // Known up front (our own tx_ref), so the buyer can check status right away
    // instead of waiting on the webhook to populate it.
    payment_id: invoice.id,
  };
}
/** Flutterwave webhooks carry a dashboard-configured shared secret in the
 *  `verif-hash` header -- a plain string compare, not a computed signature. */
export function verifyWebhookSignature(signature: string | null) {
  const secret = process.env.FLUTTERWAVE_WEBHOOK_SECRET?.trim();
  if (!secret || !signature) return false;
  const a = Buffer.from(signature);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function paymentMatches(result: Record<string, unknown>, invoice: Invoice) {
  return (
    invoice.provider === "flutterwave" &&
    !!invoice.provider_invoice_id &&
    String(result.tx_ref) === invoice.provider_invoice_id &&
    String(result.currency).toUpperCase() === invoice.currency &&
    Number.isFinite(Number(result.amount)) &&
    Math.round(Number(result.amount) * 100) === invoice.amount_minor
  );
}
export function isVerifiedPayment(result: Record<string, unknown>, invoice: Invoice) {
  const charged = Number(result.charged_amount ?? result.amount);
  return (
    paymentMatches(result, invoice) &&
    result.status === "successful" &&
    Number.isFinite(charged) &&
    Math.round(charged * 100) >= invoice.amount_minor
  );
}
/** Verify by our own tx_ref -- no need to know Flutterwave's numeric
 *  transaction id at all. */
export async function checkPayment(txRef: string, environment: Invoice["environment"]) {
  const result = await request(
    `/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`,
    environment,
    "GET",
  );
  const data = result.data as Record<string, unknown> | undefined;
  if (!data || String(data.tx_ref) !== txRef)
    throw new Error("Flutterwave transaction reference did not match.");
  return data;
}
