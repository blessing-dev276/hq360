import { afterEach, describe, expect, test } from "bun:test";
import { createHmac } from "node:crypto";
import {
  createHostedInvoice,
  isVerifiedPayment,
  paymentMatches,
  paymentSetup,
  nowpaymentsConfig,
  verifyIpnSignature,
  checkoutUrl,
  checkPayment,
  RejectedInvoiceError,
} from "../src/lib/payments/nowpayments.server";
import { invoiceSchema, sameOrigin } from "../src/lib/payments/invoices.server";
import type { Invoice } from "../src/lib/payments/types";
const invoice: Invoice = {
  id: "915f46ec-429d-4a93-a319-85e001f8d0a0",
  number: "HQ-000001",
  buyer_name: "Test Buyer",
  buyer_email: "buyer@example.com",
  buyer_phone: "08012345678",
  description: "Website project",
  amount_minor: 450050,
  currency: "NGN",
  due_date: "2026-10-01",
  status: "pending",
  provider: "nowpayments",
  provider_invoice_id: "123456789012",
  checkout_url: "https://sandbox.nowpayments.io/payment/?iid=123456789012",
  payment_id: null,
  provider_status: null,
  payment_token: "a".repeat(64),
  environment: "demo",
  created_at: "2026-09-23T00:00:00Z",
  sent_at: null,
  paid_at: null,
};
const valid = {
  payment_id: "98765",
  invoice_id: invoice.provider_invoice_id,
  order_id: invoice.id,
  price_currency: "ngn",
  price_amount: 4500.5,
  pay_amount: 0.0005,
  actually_paid: 0.0005,
  payment_status: "finished",
};
const originalFetch = globalThis.fetch;
const env = { ...process.env };
afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const key of [
    "NOWPAYMENTS_ENVIRONMENT",
    "NOWPAYMENTS_API_KEY",
    "NOWPAYMENTS_IPN_SECRET",
    "SITE_URL",
  ]) {
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  }
});
function configure() {
  Object.assign(process.env, {
    NOWPAYMENTS_ENVIRONMENT: "demo",
    NOWPAYMENTS_API_KEY: "api-test-key",
    NOWPAYMENTS_IPN_SECRET: "ipn-test-secret",
    SITE_URL: "https://hq360.example",
  });
}
describe("NOWPayments payment integrity", () => {
  test("only finishes fully paid matching orders", () => {
    expect(isVerifiedPayment(valid, invoice)).toBe(true);
    for (const override of [
      { payment_status: "confirming" },
      { payment_status: "confirmed" },
      { payment_status: "sending" },
      { payment_status: "partially_paid" },
      { payment_status: "failed" },
      { payment_status: "expired" },
      { payment_status: "refunded" },
      { invoice_id: "wrong" },
      { price_amount: 1 },
      { order_id: "wrong" },
      { price_currency: "usd" },
      { actually_paid: 0.0004 },
      { actually_paid: null },
      { pay_amount: 0 },
    ])
      expect(isVerifiedPayment({ ...valid, ...override }, invoice)).toBe(false);
    expect(paymentMatches(valid, { ...invoice, provider: "remita" })).toBe(false);
  });
  test("verifies canonical nested IPN signatures and rejects missing/tampered signatures", () => {
    configure();
    const canonical = '{"a":{"a":1,"z":2},"items":[{"a":1,"b":2}],"z":3}';
    const signature = createHmac("sha512", "ipn-test-secret").update(canonical).digest("hex");
    const payload = { z: 3, items: [{ b: 2, a: 1 }], a: { z: 2, a: 1 } };
    expect(verifyIpnSignature(payload, signature)).toBe(true);
    expect(verifyIpnSignature({ ...payload, z: 4 }, signature)).toBe(false);
    expect(verifyIpnSignature(payload, null)).toBe(false);
    expect(verifyIpnSignature(payload, "bad")).toBe(false);
  });
  test("creates hosted checkout with private API key and trusted return/callback URLs", async () => {
    configure();
    globalThis.fetch = (async (url, init) => {
      expect(String(url)).toBe("https://api-sandbox.nowpayments.io/v1/invoice");
      expect(new Headers(init?.headers).get("x-api-key")).toBe("api-test-key");
      const body = JSON.parse(String(init?.body));
      expect(body.price_amount).toBe(4500.5);
      expect(body.price_currency).toBe("ngn");
      expect(body.order_id).toBe(invoice.id);
      expect(body.ipn_callback_url).toBe("https://hq360.example/api/payments/nowpayments/ipn");
      expect(body.success_url).toBe(`https://hq360.example/pay/${invoice.payment_token}`);
      expect(body.pay_currency).toBeUndefined();
      return Response.json({ id: invoice.provider_invoice_id, invoice_url: invoice.checkout_url });
    }) as typeof fetch;
    expect(await createHostedInvoice(invoice)).toEqual({
      provider_invoice_id: invoice.provider_invoice_id,
      checkout_url: invoice.checkout_url,
    });
  });
  test("rejects untrusted checkout redirects and cross-environment links", () => {
    for (const value of [
      "javascript:alert(1)",
      "https://nowpayments.io.evil.example/pay",
      "https://evil.example",
      "https://user@nowpayments.io/payment",
      "http://nowpayments.io/payment",
      "https://sandbox.nowpayments.io/payment",
    ])
      expect(() => checkoutUrl(value, "live")).toThrow();
    expect(checkoutUrl("https://nowpayments.io/payment/?iid=1", "live")).toBe(
      "https://nowpayments.io/payment/?iid=1",
    );
  });
  test("distinguishes definitive rejection from ambiguous timeout without automatic retry", async () => {
    configure();
    globalThis.fetch = (async () => new Response("", { status: 400 })) as typeof fetch;
    await expect(createHostedInvoice(invoice)).rejects.toBeInstanceOf(RejectedInvoiceError);
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      throw new Error("timeout");
    }) as typeof fetch;
    await expect(createHostedInvoice(invoice)).rejects.toThrow("reconciliation");
    expect(calls).toBe(1);
  });
  test("payment lookup binds the response to the requested payment", async () => {
    configure();
    globalThis.fetch = (async (url) => {
      expect(String(url)).toEndWith("/payment/98765");
      return Response.json(valid);
    }) as typeof fetch;
    expect(await checkPayment("98765", "demo")).toEqual(valid);
    globalThis.fetch = (async () =>
      Response.json({ ...valid, payment_id: "different" })) as typeof fetch;
    await expect(checkPayment("98765", "demo")).rejects.toThrow("did not match");
  });
  test("requires both API and IPN credentials and prevents environment mixing", () => {
    configure();
    expect(() => nowpaymentsConfig("live")).toThrow();
    delete process.env.NOWPAYMENTS_IPN_SECRET;
    expect(paymentSetup().configured).toBe(false);
  });
  test("validates integer minor-unit amounts and buyer details", () => {
    expect(invoiceSchema.safeParse(invoice).success).toBe(true);
    for (const override of [
      { amount_minor: -1 },
      { amount_minor: 0.2 },
      { due_date: "2026-02-31" },
      { buyer_email: "invalid" },
    ])
      expect(invoiceSchema.safeParse({ ...invoice, ...override }).success).toBe(false);
  });
  test("requires same-origin admin and buyer mutations", () => {
    expect(
      sameOrigin(
        new Request("https://hq360.space/api", { headers: { origin: "https://hq360.space" } }),
      ),
    ).toBe(true);
    expect(
      sameOrigin(
        new Request("https://hq360.space/api", { headers: { origin: "https://evil.example" } }),
      ),
    ).toBe(false);
    expect(sameOrigin(new Request("https://hq360.space/api"))).toBe(false);
  });
});
