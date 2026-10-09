// Mocked buyer flow: no bank operations or email delivery.
import { chromium, expect } from "@playwright/test";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let status = "pending";
  await page.route("**/api/pay/*", (route) =>
    route.fulfill({
      json: {
        invoice: {
          number: "HQ-123456",
          description: "Consulting services",
          amount_minor: 125050,
          currency: "USD",
          bank_transfer_amount_minor: 110000,
          due_date: "2026-11-01",
          status,
          provider: "bank_transfer",
          provider_invoice_id: "HQ-123456",
          provider_status: null,
          environment: "live",
          buyer_name: "Test Client",
        },
        checkout: { url: "" },
      },
    }),
  );
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(
      `${process.env.PAYMENTS_TEST_URL || "http://localhost:8081"}/pay/${"a".repeat(64)}`,
    );
    await expect(page.getByRole("heading", { name: "Pay by bank transfer" })).toBeVisible();
    await expect(page.locator(".buyer-total-amount")).toHaveText("$1,250.50");
    await expect(page.locator(".buyer-transfer strong")).toBeVisible();
    await expect(page.getByText("GB04CLJU04130735848221", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Refresh payment status" }).click();
    await expect(page.getByText("Awaiting payment", { exact: true })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.emulateMedia({ media: "print" });
    await expect(page.getByText("GB04CLJU04130735848221", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Refresh payment status" })).toBeHidden();
    await page.emulateMedia({ media: "screen" });
  }
  status = "cancelled";
  await page.reload();
  await expect(page.getByText("Cancelled", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pay by bank transfer" })).toHaveCount(0);
  expect(errors).toEqual([]);
  console.log("Bank transfer buyer checks passed on desktop, mobile and print.");
} finally {
  await browser.close();
}
