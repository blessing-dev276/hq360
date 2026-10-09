import { z } from "zod";
import { quoteInput } from "./quotes-schema.server";
import type { Quote } from "./quotes";

export const conversionInput = z.object({
  package_index: z.number().int().min(0).max(3),
  buyer_email: z.string().trim().email().max(254),
  buyer_phone: z
    .string()
    .trim()
    .regex(/^\+?[\d ()-]{7,25}$/)
    .or(z.literal(""))
    .default(""),
  bank_transfer_amount_minor: z.number().int().positive().max(10000000000).optional(),
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(
      (value) =>
        !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value,
      "Invalid due date",
    ),
  payment_method: z.enum(["bank_transfer", "flutterwave", "nowpayments"]),
  /** 50% to start, 50% on delivery (admin invoices only). */
  split: z.boolean().default(false),
  balance_due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export function quoteInvoiceDetails(
  quote: Quote,
  index: number,
  method: "bank_transfer" | "flutterwave" | "nowpayments",
) {
  const parsed = quoteInput.safeParse(quote);
  if (!parsed.success) throw new Error("The saved quote is invalid. Review it before invoicing.");
  if (!quote.client_name.trim()) throw new Error("Add the buyer's name to the quote first.");
  const pkg = parsed.data.packages[index];
  if (!pkg) throw new Error("Choose a package from the saved quote.");
  if (parsed.data.currency === "EUR" && method !== "bank_transfer")
    throw new Error("EUR quotes use the SEPA bank transfer method.");
  if (!(["EUR", "USD"] as string[]).includes(parsed.data.currency))
    throw new Error(
      "Invoices support USD checkout or EUR bank transfer. Agree on one of those currencies and save the quote first.",
    );
  const amount = Math.round(pkg.price * 100);
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 10_000_000_000)
    throw new Error("The selected package needs a valid price greater than zero.");
  const description = [parsed.data.project_title, `${pkg.name} package`, ...pkg.features]
    .filter(Boolean)
    .join(" · ")
    .slice(0, 1000);
  return {
    buyer_name: parsed.data.client_name,
    description,
    title: parsed.data.project_title.slice(0, 200),
    package_name: pkg.name.slice(0, 160),
    included: pkg.features.filter(Boolean).slice(0, 30),
    amount_minor: amount,
    currency: parsed.data.currency as "USD" | "EUR",
  };
}
