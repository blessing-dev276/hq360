// Run a built preview first, then: SCOUT_TEST_URL=http://localhost:8081 bun scripts/test-scout-browser.mjs
// API fixtures exercise browser behavior without inserting test records into production.
import { chromium, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
    : {}),
});
const context = await browser.newContext();
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
let imports = 0;
let unavailable = true;
const name = 'Test Author, "Quoted"';
const title = 'Test Book, "Quoted"';
await context.route("**/api/admin/session", (route) =>
  route.fulfill({ json: { configured: true, authed: true } }),
);
await context.route("**/api/admin/scout-books?*", (route) =>
  route.fulfill({ status: 503, json: { ok: false, message: "Fixture database unavailable" } }),
);
await context.route("**/api/admin/scout-manual-ingest", (route) => {
  imports++;
  if (unavailable)
    return route.fulfill({ status: 503, json: { ok: false, message: "Fixture save unavailable" } });
  const body = route.request().postDataJSON();
  return route.fulfill({
    json: {
      ok: true,
      item: {
        book: {
          id: "server-book",
          title: body.bookTitle,
          genre: body.genre,
          asin: "B012345678",
          source_url: body.sourceUrl,
        },
        author: { id: "server-author", name: body.authorName, country: null },
      },
    },
  });
});
async function fill(url) {
  await page.getByLabel("Author name", { exact: true }).fill(name);
  await page.getByLabel("Book title", { exact: true }).fill(title);
  await page.getByLabel("Direct Amazon product URL").fill(url);
  await page.getByLabel("Amazon ratings", { exact: true }).fill("12");
  await page.getByRole("button", { name: "Import author", exact: true }).click();
}
async function checkCsv() {
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  const download = await downloadEvent;
  const csv = await readFile(await download.path(), "utf8");
  expect(csv).toContain('"Test Author, ""Quoted""","Test Book, ""Quoted""","12"');
  expect(csv).toContain('"B012345678","https://www.amazon.ca/dp/B012345678"');
  expect(await download.failure()).toBeNull();
}
try {
  await page.goto(`${process.env.SCOUT_TEST_URL || "http://localhost:8081"}/scout`);
  await fill(
    "https://www.google.com/search?q=site%3Aamazon.ca%20horror%20Canada%20(1..49%20ratings)",
  );
  await expect(page.getByRole("alert")).toContainText("This is a Google search link");
  expect(imports).toBe(0);
  await expect(page.getByRole("button", { name: "Export CSV" })).toBeDisabled();
  console.log("PASS: Google results URL rejected clearly without a save request.");

  await fill("https://www.amazon.ca/Test/dp/B012345678/ref=test?tag=tracking");
  await expect(page.getByRole("button", { name: "Retry sync" })).toBeVisible();
  await checkCsv();
  await page.reload();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await checkCsv();
  console.log("PASS: failed save remains visible, survives reload, and downloads correct CSV.");

  unavailable = false;
  await page.getByRole("button", { name: "Retry sync" }).click();
  await expect(
    page.getByText("Book saved to your account and ready to export.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await checkCsv();
  expect(imports).toBe(2);
  console.log(
    "PASS: retry uses the saved entry; successful save stays visible despite list API failure.",
  );
  await page.evaluate(() => localStorage.clear());
  await context.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Storage blocked", "QuotaExceededError");
    };
  });
  unavailable = true;
  await page.reload();
  await fill("https://www.amazon.ca/dp/B012345678");
  await expect(page.getByRole("button", { name: "Retry sync" })).toBeVisible();
  await checkCsv();
  console.log("PASS: blocked browser storage does not crash the form or prevent CSV export.");
  expect(errors).toEqual([]);
} finally {
  await browser.close();
}
