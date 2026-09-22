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
await context.route("**/api/admin/scout-amazon-search", (route) =>
  route.fulfill({
    json: {
      ok: true,
      searched: 18,
      qualifying: 1,
      skippedWithoutAuthor: 0,
      items: [
        {
          asin: "B012345678",
          title,
          authorName: name,
          reviewCount: 12,
          sourceUrl: "https://www.amazon.de/dp/B012345678",
          genre: "Horror",
          country: "Germany",
        },
      ],
    },
  }),
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
        author: { id: "server-author", name: body.authorName, country: body.country },
      },
    },
  });
});
async function search() {
  await page.getByRole("button", { name: "Search Amazon and save results" }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
}
async function checkCsv() {
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  const download = await downloadEvent;
  const csv = await readFile(await download.path(), "utf8");
  expect(csv).toContain('"Test Author, ""Quoted""","Test Book, ""Quoted""","12"');
  expect(csv).toContain('"B012345678","https://www.amazon.de/dp/B012345678"');
  expect(await download.failure()).toBeNull();
}
try {
  await page.goto(`${process.env.SCOUT_TEST_URL || "http://localhost:8081"}/scout`);
  await search();
  await expect(page.getByRole("button", { name: "Retry sync" })).toBeVisible();
  await checkCsv();
  await page.reload();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await checkCsv();
  console.log("PASS: automatic search collects data, survives a failed save and downloads CSV.");

  unavailable = false;
  await page.getByRole("button", { name: "Retry sync" }).click();
  await expect(
    page.getByText("Book saved to your account and ready to export.", { exact: true }),
  ).toBeVisible();
  await checkCsv();
  expect(imports).toBe(2);
  console.log("PASS: retry saves the automatically collected result and keeps it exportable.");

  await page.evaluate(() => localStorage.clear());
  await context.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Storage blocked", "QuotaExceededError");
    };
  });
  unavailable = true;
  await page.reload();
  await search();
  await checkCsv();
  console.log("PASS: blocked browser storage does not prevent automatic search or CSV export.");
  expect(errors).toEqual([]);
} finally {
  await browser.close();
}
