export type Invoice = {
  id: string;
  number: string;
  buyer_name: string;
  buyer_email: string;
  buyer_phone: string;
  description: string;
  amount_minor: number;
  currency: "USD" | "NGN";
  due_date: string;
  status: "draft" | "pending" | "paid" | "refunded";
  provider: "nowpayments" | "remita";
  provider_invoice_id: string | null;
  checkout_url: string | null;
  payment_id: string | null;
  provider_status: string | null;
  payment_token: string;
  environment: "demo" | "live";
  created_at: string;
  sent_at: string | null;
  paid_at: string | null;
};
export type PaymentSetup = {
  configured: boolean;
  emailConfigured: boolean;
  environment: "demo" | "live";
};
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
