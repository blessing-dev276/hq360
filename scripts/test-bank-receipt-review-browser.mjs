// Mocked staff review: no database, email or bank transfer is touched.
import { chromium, expect } from "@playwright/test";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const id = "11111111-1111-4111-8111-111111111111";
  let status = "submitted";
  await page.route(`**/api/staff/payment-receipts/${id}/image`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "image/png",
      body: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    }),
  );
  await page.route(`**/api/staff/payment-receipts/${id}`, (route) => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      if (!body.bank_checked || body.reference !== "BANK-123")
        return route.fulfill({ status: 400, json: { error: "Bank receipt required" } });
      status = "approved";
      return route.fulfill({ json: { ok: true, status } });
    }
    return route.fulfill({
      json: {
        receipt: {
          id,
          status,
          submitted_at: "2026-10-09T12:00:00Z",
          reviewed_at: null,
          bank_reference: null,
          admin_note: null,
        },
        invoice: {
          id,
          number: "HQ-123456",
          buyer_name: "Test Buyer",
          buyer_email: "buyer@example.com",
          description: "Premium",
          amount_minor: 125050,
          currency: "USD",
          bank_transfer_amount_minor: 110000,
          status: status === "approved" ? "paid" : "pending",
          payment_id: null,
        },
      },
    });
  });
  await page.goto(
    `${process.env.PAYMENTS_TEST_URL || "http://localhost:8081"}/payment-review/${id}`,
  );
  await expect(
    page.getByRole("heading", { name: "Review bank transfer screenshot" }),
  ).toBeVisible();
  await expect(page.getByText("$1,250.50")).toBeVisible();
  await expect(page.getByText("€1,100.00")).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm payment" })).toBeDisabled();
  await page.getByRole("checkbox").check();
  await page.getByLabel("Bank transaction reference").fill("BANK-123");
  await page.getByRole("button", { name: "Confirm payment" }).click();
  await expect(page.getByText("Status: approved")).toBeVisible();
  console.log("Receipt review approval check passed.");
} finally {
  await browser.close();
}
