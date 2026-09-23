import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  generateRrr,
  isVerifiedPayment,
  parseRemitaResponse,
  paymentSetup,
  remitaConfig,
} from "../src/lib/payments/remita.server";
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
  rrr: "123456789012",
  payment_token: "a".repeat(64),
  environment: "demo",
  created_at: "2026-09-23T00:00:00Z",
  sent_at: null,
  paid_at: null,
};
const originalFetch = globalThis.fetch;
const env = { ...process.env };
afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const key of [
    "REMITA_ENVIRONMENT",
    "REMITA_MERCHANT_ID",
    "REMITA_SERVICE_TYPE_ID",
    "REMITA_API_KEY",
    "REMITA_PUBLIC_KEY",
  ]) {
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  }
});
function configure() {
  Object.assign(process.env, {
    REMITA_ENVIRONMENT: "demo",
    REMITA_MERCHANT_ID: "merchant",
    REMITA_SERVICE_TYPE_ID: "service",
    REMITA_API_KEY: "private-test-key",
    REMITA_PUBLIC_KEY: "public-test-key",
  });
}
describe("Remita payment integrity", () => {
  test("only confirms matching reference, amount, order and successful status", () => {
    const valid = { status: "00", RRR: invoice.rrr, amount: "4500.50", orderId: invoice.id };
    expect(isVerifiedPayment(valid, invoice)).toBe(true);
    expect(isVerifiedPayment({ ...valid, status: "01" }, invoice)).toBe(false);
    for (const override of [
      { status: "021" },
      { RRR: "999999999999" },
      { amount: "4500" },
      { amount: undefined },
      { orderId: "wrong" },
      { currency: "USD" },
    ])
      expect(isVerifiedPayment({ ...valid, ...override }, invoice)).toBe(false);
  });
  test("parses JSONP without executing arbitrary code", () => {
    expect(parseRemitaResponse('jsonp ({"statuscode":"025","RRR":"123456789012"});').RRR).toBe(
      invoice.rrr,
    );
    expect(() => parseRemitaResponse('evil({"status":"00"})')).toThrow();
    expect(() => parseRemitaResponse("null")).toThrow();
    expect(() => parseRemitaResponse("[]")).toThrow();
  });
  test("uses server credentials and exact decimal amount in the request signature", async () => {
    configure();
    let captured = false;
    globalThis.fetch = (async (url, init) => {
      expect(String(url)).toStartWith("https://remitademo.net/");
      const body = JSON.parse(String(init?.body));
      expect(body.amount).toBe("4500.50");
      expect(body.orderId).toBe(invoice.id);
      const signature = createHash("sha512")
        .update("merchantservice" + invoice.id + "4500.50private-test-key")
        .digest("hex");
      expect(new Headers(init?.headers).get("Authorization")).toBe(
        `remitaConsumerKey=merchant,remitaConsumerToken=${signature}`,
      );
      captured = true;
      return new Response('jsonp ({"statuscode":"025","RRR":"123456789012"})');
    }) as typeof fetch;
    expect(await generateRrr(invoice)).toBe(invoice.rrr);
    expect(captured).toBe(true);
  });
  test("recovers a duplicate order instead of creating a new reference", async () => {
    configure();
    let calls = 0;
    globalThis.fetch = (async (url) => {
      calls++;
      if (calls === 1) return Response.json({ statuscode: "028" });
      expect(String(url)).toContain(invoice.id);
      expect(String(url)).toEndWith("/orderstatus.reg");
      return Response.json({ orderId: invoice.id, RRR: invoice.rrr });
    }) as typeof fetch;
    expect(await generateRrr(invoice)).toBe(invoice.rrr);
    expect(calls).toBe(2);
  });
  test("rejects missing credentials and cross-environment invoices", () => {
    configure();
    expect(() => remitaConfig("live")).toThrow();
    delete process.env.REMITA_API_KEY;
    expect(paymentSetup().configured).toBe(false);
    expect(() => remitaConfig()).toThrow();
  });
  test("validates whole minor-unit amounts, real dates and buyer details", () => {
    const input = { ...invoice };
    expect(invoiceSchema.safeParse(input).success).toBe(true);
    for (const override of [
      { amount_minor: -1 },
      { amount_minor: 0.2 },
      { due_date: "2026-02-31" },
      { buyer_email: "invalid" },
      { buyer_phone: "abc" },
    ])
      expect(invoiceSchema.safeParse({ ...input, ...override }).success).toBe(false);
  });
  test("requires same-origin mutations", () => {
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
