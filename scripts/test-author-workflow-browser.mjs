// Run after `bun run build` and `bun run preview --port 8081`.
// All writable APIs are intercepted; this test never writes to Supabase or a CRM.
import { chromium, expect } from "@playwright/test";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const goto = async (url) => {
  await page.goto(url);
  // SSR content is visible before React attaches event handlers.
  await page.waitForFunction(() =>
    Object.keys(document.querySelector("main") ?? {}).some((key) =>
      key.startsWith("__reactProps$"),
    ),
  );
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
};
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await context.addInitScript(() => {
  localStorage.setItem("hq360-cookie-consent", "declined");
  sessionStorage.setItem("hq360-popup-shown", "1");
});
await context.route("**/api/public/**", (route) =>
  route.fulfill({
    json:
      route.request().method() === "POST"
        ? { ok: true, emailed: true }
        : route.request().url().includes("/team")
          ? { ok: true, members: [] }
          : { ok: true, items: [] },
  }),
);
await context.route("**/api/admin/session", (route) =>
  route.fulfill({ json: { authed: true, configured: true } }),
);
let records = [];
await context.route("**/api/admin/leads", (route) => {
  if (route.request().method() !== "GET") {
    const input = route.request().postDataJSON();
    const item = {
      ...input,
      id: input.id || "12345678-1234-4234-8234-123456789012",
      source_kind: "manual",
      created_at: new Date().toISOString(),
    };
    records = [item];
    return route.fulfill({ json: { ok: true, item, forwarded: false } });
  }
  return route.fulfill({ json: { ok: true, items: records, invoices: [], events: [] } });
});
try {
  const base = process.env.BASE_URL || "http://localhost:8081";
  await goto(`${base}/authors`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Bring your book to life");
  const nav = page.getByRole("navigation", { name: "Primary", exact: true });
  await expect(nav.getByRole("link", { name: "Our Work" })).toBeVisible();
  await expect(nav.getByRole("button", { name: "Who We Help", exact: true })).toBeVisible();
  await nav.getByRole("button", { name: "Services", exact: true }).click();
  await expect(nav.getByRole("link", { name: /Website Development/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.screenshot({ path: "/tmp/hq360-authors-desktop.png", fullPage: true });
  for (const slug of [
    "book-writing-editing",
    "book-formatting-publishing",
    "author-visibility-marketing",
    "author-websites-email",
  ]) {
    await goto(`${base}/services/${slug}`);
    await expect(page.getByRole("heading", { name: "What we can help you deliver" })).toBeVisible();
  }
  await goto(`${base}/resources`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Guides, answers");
  await goto(`${base}/contact?audience=authors&service=book-writing-editing&from=/authors`);
  const inquiry = page
    .locator("form")
    .filter({ has: page.getByRole("button", { name: "Send enquiry" }) });
  await inquiry.getByLabel("Full name").fill("Test Author");
  await inquiry.getByLabel("Email", { exact: true }).fill("author@example.com");
  await page.getByRole("checkbox", { name: "Book Writing & Editing" }).check();
  await page.getByRole("button", { name: "Send enquiry" }).click();
  await expect(page.getByRole("heading", { name: "Thanks — that's in." })).toBeVisible();
  await goto(`${base}/tools/author-visibility-audit`);
  const check = page.locator("#audit-form form");
  await check.getByLabel("Author name").fill("Test Author");
  await check.getByLabel("Book title").fill("Test Book");
  await check.getByRole("button", { name: "Continue" }).click();
  await check.getByRole("button", { name: "Continue" }).click();
  await check.getByLabel("Email address").fill("author@example.com");
  await check.getByRole("checkbox").check();
  await check.getByRole("button", { name: "Request my free check" }).click();
  await expect(page.getByRole("heading", { name: "Your next chapter starts here." })).toBeVisible();
  expect((await page.request.get(`${base}/api/admin/leads`)).status()).toBe(401);
  await page.setViewportSize({ width: 390, height: 844 });
  await goto(base);
  await page.getByRole("button", { name: "Open menu" }).click();
  const mobile = page.getByRole("navigation", { name: "Mobile navigation" });
  await expect(mobile.getByRole("link", { name: "Our Work" })).toBeVisible();
  await expect(mobile.getByText("Industries", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Close menu" }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "/tmp/hq360-authors-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await goto(`${base}/admin`);
  await expect(page.getByRole("heading", { name: "Leads & Follow-ups" })).toBeVisible();
  await page.getByRole("button", { name: "Add lead" }).click();
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("Test Author");
  await page.getByRole("textbox", { name: "Assigned to" }).fill("Editor");
  await page.getByLabel("Sales stage").selectOption("proposal");
  await page.getByLabel("Project status").selectOption("scoping");
  await page.getByRole("button", { name: "Save record" }).click();
  await expect(page.getByRole("heading", { name: "Test Author", exact: true })).toBeVisible();
  await page
    .getByRole("navigation", { name: "Admin navigation" })
    .getByRole("button", { name: "Projects" })
    .click();
  await expect(page.getByRole("heading", { name: "Test Author", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Review / edit" }).click();
  await page.getByLabel("Project status").selectOption("delivered");
  await page.getByRole("button", { name: "Save record" }).click();
  expect(records[0].project_status).toBe("delivered");
  await page.screenshot({ path: "/tmp/hq360-projects-desktop.png", fullPage: true });
  expect(errors).toEqual([]);
  console.log(
    "PASS: desktop/mobile navigation, four offers, resources, inquiry submission, lead creation and project delivery.",
  );
} finally {
  await browser.close();
}
