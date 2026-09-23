// Run bun run build and bun run preview --port 8081, then bun scripts/test-payments-browser.mjs.
// All payment and session APIs are fixtures; no emails or real payments are sent.
import { chromium, expect } from "@playwright/test";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const setup = { configured: true, emailConfigured: true, environment: "demo" };
let invoices = [];
await context.route("**/api/admin/session", (route) =>
  route.fulfill({ json: { authed: true, configured: true } }),
);
await context.route("**/api/admin/invoices", (route) => {
  if (route.request().method() === "POST") {
    const input = route.request().postDataJSON();
    const invoice = {
      ...input,
      number: "HQ-000001",
      currency: "NGN",
      status: "draft",
      rrr: null,
      payment_token: "a".repeat(64),
      environment: "demo",
      created_at: new Date().toISOString(),
      sent_at: null,
      paid_at: null,
    };
    invoices.push(invoice);
    return route.fulfill({ status: 201, json: { invoice } });
  }
  return route.fulfill({ json: { invoices, setup } });
});
await context.route("**/api/admin/invoices/*", (route) => {
  const { action } = route.request().postDataJSON();
  if (action === "issue") Object.assign(invoices[0], { rrr: "123456789012", status: "pending" });
  if (action === "send") invoices[0].sent_at = new Date().toISOString();
  if (action === "verify") invoices[0].status = "paid";
  return route.fulfill({ json: { invoice: invoices[0] } });
});
await context.route("**/api/pay/*", (route) =>
  route.fulfill({
    json: {
      invoice: { ...invoices[0], status: route.request().method() === "POST" ? "paid" : "pending" },
      checkout: {
        publicKey: "fixture-public-key",
        script: "https://remitademo.net/payment/v1/remita-pay-inline.bundle.js",
      },
    },
  }),
);
await context.route("https://remitademo.net/payment/v1/remita-pay-inline.bundle.js", (route) =>
  route.fulfill({
    contentType: "text/javascript",
    body: 'window.RmPaymentEngine = { init: function(options) { if (!options.processRrr || options.extendedData.customFields[0].value !== "123456789012") throw new Error("Bad RRR checkout configuration"); return {showPaymentWidget: function() { options.onSuccess({status: "00"}); }}; }};',
  }),
);
try {
  const base = process.env.PAYMENTS_TEST_URL || "http://localhost:8081";
  await page.goto(`${base}/admin`);
  await expect(page.getByRole("heading", { name: "Welcome to your workspace" })).toBeVisible();
  await page.screenshot({ path: "/tmp/hq360-admin-desktop.png", fullPage: true });
  await page.getByRole("button", { name: "Payments", exact: false }).first().click();
  await page.getByRole("button", { name: "Create invoice", exact: true }).click();
  await page.getByLabel("Buyer name", { exact: true }).fill("Acme Studio");
  await page.getByLabel("Email address").fill("buyer@example.com");
  await page.getByLabel("Phone number").fill("+2348012345678");
  await page.getByLabel("What is this invoice for?").fill("Brand strategy and website design");
  await page.getByLabel("Amount (NGN)").fill("125000.50");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByRole("heading", { name: "Invoice HQ-000001" })).toBeVisible();
  expect(invoices[0].amount_minor).toBe(12500050);
  await page.getByRole("button", { name: "Issue with Remita" }).click();
  await expect(page.getByText("123456789012", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Send invoice", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Invoice emailed");
  await page.getByRole("button", { name: "Check payment", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Payment verified");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.screenshot({ path: "/tmp/hq360-payments-desktop.png", fullPage: true });
  await page.getByLabel("Search invoices").fill("no match");
  await expect(page.getByRole("heading", { name: "No matching invoices" })).toBeVisible();
  await page.getByLabel("Search invoices").fill("");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "/tmp/hq360-admin-mobile.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.goto(`${base}/pay/${"a".repeat(64)}`);
  await expect(
    page.getByRole("heading", { name: "Let’s make great things happen." }),
  ).toBeVisible();
  await page.screenshot({ path: "/tmp/hq360-buyer-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Pay securely with Remita" }).click();
  await expect(page.getByText("Payment confirmed by Remita", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(errors).toEqual([]);
  console.log(
    "PASS: desktop/mobile dashboard, draft creation, Remita issuance, email action, verified payment, search and buyer checkout.",
  );
} finally {
  await browser.close();
}
