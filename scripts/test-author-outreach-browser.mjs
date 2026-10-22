// All APIs are mocked. No messages are sent or real records modified.
import { chromium, expect } from "@playwright/test";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
let row = {
  id: "d0bdb390-4069-4b60-97b7-1a5ac76c4b3e",
  recipient: "author@example.com",
  subject: "A thoughtful introduction",
  content: "Hello, author!",
  sender_name: "Racheal",
  source: "composer",
  is_test: false,
  send_status: "accepted",
  provider_id: "provider-id",
  delivery_status: null,
  checked_at: null,
  workflow: "awaiting_reply",
  notes: "",
  follow_up_on: null,
  created_at: "2026-10-13T12:00:00Z",
};
let sent = 0;
await context.route("**/api/**", async (route) => {
  const request = route.request();
  const url = new URL(request.url());
  if (url.pathname === "/api/admin/session")
    return route.fulfill({ json: { authed: true, configured: true } });
  if (url.pathname === "/api/admin/author-email") {
    if (request.method() === "POST") {
      sent++;
      return route.fulfill({ json: { accepted: true, id: "provider-id" } });
    }
    return route.fulfill({
      json: { ready: true, from: "HQ360 <ceo@hq360.space>", replyTo: "ceo@hq360.space" },
    });
  }
  if (url.pathname === "/api/admin/author-outreach") {
    if (request.method() === "PATCH") {
      const body = request.postDataJSON();
      if (body.action === "refresh")
        row = { ...row, delivery_status: "delivered", checked_at: new Date().toISOString() };
      else
        row = { ...row, notes: body.notes, workflow: body.workflow, follow_up_on: body.followUpOn };
      return route.fulfill({ json: { ok: true } });
    }
    const matches = row.recipient.includes(url.searchParams.get("search") || "");
    return route.fulfill({ json: { items: matches ? [row] : [], total: matches ? 1 : 0 } });
  }
  return route.fulfill({ json: { items: [], unread: 0, ok: true } });
});
try {
  await page.goto(`${process.env.BASE_URL || "http://localhost:8083"}/admin#outreach`);
  await page.getByRole("button", { name: "Outreach history", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "author@example.com A thoughtful introduction" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Check delivery" }).click();
  await expect(page.getByRole("cell", { name: /delivered/ })).toBeVisible();
  await page.getByRole("button", { name: "View / follow up" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Follow-up status").selectOption("interested");
  await dialog.getByLabel("Follow-up date").fill("2026-10-20");
  await dialog.getByLabel("Notes").fill("Asked for a priority list.");
  await dialog.getByRole("button", { name: "Save follow-up" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("cell", { name: "Interested Due 2026-10-20" })).toBeVisible();
  await page.getByRole("button", { name: "View / follow up" }).click();
  await expect(dialog.getByLabel("Notes")).toHaveValue("Asked for a priority list.");
  await page.keyboard.press("Escape");
  await page.getByLabel("Search recipient").fill("missing@example.com");
  await expect(page.getByText(/No outreach matches/)).toBeVisible();
  await page.getByLabel("Search recipient").fill("");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: "View / follow up" })).toBeVisible();
  if (sent !== 0) throw new Error("History interactions unexpectedly sent email");
  console.log(
    "PASS: history, delivery refresh, notes/date save, search and mobile layout; no email sent.",
  );
} finally {
  await browser.close();
}
