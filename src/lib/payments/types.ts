export type Invoice = {
  id: string;
  number: string;
  buyer_name: string;
  buyer_email: string;
  buyer_phone: string;
  description: string;
  /** Optional invoice heading, e.g. the project. */
  title?: string;
  package_name?: string;
  /** What's included in the package, one item per entry. */
  included?: string[];
  /** "deposit" (50% to start) and "balance" (50% on delivery) are linked by installment_group. */
  installment?: "full" | "deposit" | "balance";
  installment_group?: string | null;
  /** Full project price when the invoice is one part of a split. */
  project_total_minor?: number | null;
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
  sender_expert_id?: string | null;
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
/** For a 50/50 split: which part this invoice is and how it fits the total. */
export function installmentInfo(
  invoice: Pick<Invoice, "installment" | "project_total_minor" | "amount_minor" | "currency">,
) {
  if (!invoice.installment || invoice.installment === "full" || !invoice.project_total_minor)
    return null;
  const total = money(invoice.project_total_minor, invoice.currency);
  const other = money(invoice.project_total_minor - invoice.amount_minor, invoice.currency);
  return invoice.installment === "deposit"
    ? {
        label: "Deposit · 50% to start",
        short: "Deposit 1 of 2",
        note: `Project total ${total}. This 50% deposit starts the work; the remaining ${other} is due on delivery.`,
      }
    : {
        label: "Balance · 50% on delivery",
        short: "Balance 2 of 2",
        note: `Project total ${total}. The 50% deposit of ${other} was the first payment; this balance is due on delivery.`,
      };
}
export function invoiceStatus(invoice: Invoice) {
  return invoice.status === "pending" && invoice.due_date < new Date().toISOString().slice(0, 10)
    ? "overdue"
    : invoice.status;
}
