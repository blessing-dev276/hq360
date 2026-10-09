export type Invoice = {
  id: string;
  number: string;
  buyer_name: string;
  buyer_email: string;
  buyer_phone: string;
  description: string;
  amount_minor: number;
  bank_transfer_amount_minor: number | null;
  currency: "USD" | "NGN" | "EUR";
  due_date: string;
  status: "draft" | "pending" | "paid" | "refunded" | "cancelled";
  provider: "bank_transfer" | "nowpayments" | "flutterwave" | "paystack" | "remita";
  provider_invoice_id: string | null;
  checkout_url: string | null;
  payment_id: string | null;
  provider_status: string | null;
  payment_token: string;
  environment: "demo" | "live";
  requested_by_expert_id: string | null;
  requested_by?: { full_name: string | null; email: string } | null;
  created_at: string;
  sent_at: string | null;
  paid_at: string | null;
};
export type ProviderSetup = { configured: boolean; environment: "demo" | "live" };
export type PaymentSetup = {
  emailConfigured: boolean;
  bank_transfer: ProviderSetup;
  nowpayments: ProviderSetup;
  flutterwave: ProviderSetup;
};
export function providerLabel(provider: Invoice["provider"]) {
  return provider === "bank_transfer"
    ? "Bank transfer (EUR)"
    : provider === "paystack"
      ? "Paystack"
      : provider === "nowpayments"
        ? "NOWPayments"
        : provider === "flutterwave"
          ? "Flutterwave"
          : "Remita";
}
/** Crypto (NOWPayments) vs card/bank (Flutterwave) -- drives copy on the
 *  buyer-facing checkout page and the expert invoice-request form. */
export function paymentKind(provider: Invoice["provider"]): "crypto" | "card" {
  return provider === "nowpayments" ? "crypto" : "card";
}
/** Thrown by a provider module when it gets a definitive (e.g. 4xx) rejection,
 *  as opposed to a timeout/5xx where an invoice may already exist provider-side. */
export class RejectedInvoiceError extends Error {}
export function money(minor: number, currency: Invoice["currency"] = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}
export function invoiceStatus(invoice: Invoice) {
  return invoice.status === "pending" && invoice.due_date < new Date().toISOString().slice(0, 10)
    ? "overdue"
    : invoice.status;
}
