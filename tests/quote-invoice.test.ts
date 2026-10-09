import { expect, test } from "bun:test";
import { newQuote } from "../src/lib/quotes";
import { quoteInvoiceDetails, conversionInput } from "../src/lib/quote-invoice.server";

const quote = newQuote("HQ360");
quote.client_name = "Ada Buyer";
quote.project_title = "Book launch";
quote.packages[2] = {
  name: "Premium",
  price: 1250.5,
  original_price: 1500,
  delivery: "3 weeks",
  features: ["Campaign plan", "Three ads"],
  recommended: false,
};

test("selected Premium package becomes invoice amount and scope", () => {
  const details = quoteInvoiceDetails(quote, 2, "flutterwave");
  expect(details).toEqual({
    buyer_name: "Ada Buyer",
    amount_minor: 125050,
    currency: "USD",
    description: "Book launch · Premium package · Campaign plan · Three ads",
  });
});

test("quote conversion preserves currency and validates buyer details", () => {
  expect(quoteInvoiceDetails(quote, 2, "bank_transfer").currency).toBe("USD");
  const euro = { ...quote, currency: "EUR" as const };
  expect(quoteInvoiceDetails(euro, 2, "bank_transfer").amount_minor).toBe(125050);
  expect(() => quoteInvoiceDetails(euro, 2, "flutterwave")).toThrow("EUR");
  expect(() => quoteInvoiceDetails({ ...quote, currency: "GBP" }, 2, "flutterwave")).toThrow(
    "Invoices support",
  );
  expect(() => quoteInvoiceDetails(quote, 1, "flutterwave")).toThrow("valid price");
  expect(
    conversionInput.safeParse({
      package_index: 2,
      buyer_email: "buyer@example.com",
      due_date: "2026-11-01",
      payment_method: "flutterwave",
    }).data?.buyer_phone,
  ).toBe("");
  expect(
    conversionInput.safeParse({
      package_index: 2,
      buyer_email: "buyer@example.com",
      buyer_phone: "",
      due_date: "2026-11-01",
      payment_method: "bank_transfer",
      bank_transfer_amount_minor: 110000,
    }).success,
  ).toBe(true);
  expect(
    conversionInput.safeParse({
      package_index: 2,
      buyer_email: "buyer@example.com",
      due_date: "2026-11-01",
      payment_method: "flutterwave",
    }).data?.buyer_phone,
  ).toBe("");
  expect(
    conversionInput.safeParse({
      package_index: 2,
      buyer_email: "bad",
      buyer_phone: "123",
      due_date: "2026-11-01",
      payment_method: "flutterwave",
    }).success,
  ).toBe(false);
});
