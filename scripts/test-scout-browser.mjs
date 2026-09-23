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
const name = 'Test Author, "Quoted"';
const title = 'Test Book, "Quoted"';
await context.route("**/api/admin/session", (route) =>
  route.fulfill({ json: { configured: true, authed: true } }),
);
await context.route("**/api/admin/scout-books?*", (route) =>
  route.fulfill({ status: 503, json: { ok: false, message: "Fixture database unavailable" } }),
);
await context.route("**/api/admin/scout-reedsy-genres", (route) =>
  route.fulfill({
    json: {
      ok: true,
      genres: [
        { id: 10, name: "Fiction", emoji: "📚", depth: 0, bookCount: 8273 },
        { id: 2, name: "Fantasy", emoji: "🧙‍♂️", depth: 1, bookCount: 512 },
      ],
    },
  }),
);
await context.route("**/api/admin/scout-reedsy-search", (route) =>
  route.fulfill({
    json: {
      ok: true,
      searched: 18,
      qualifying: 1,
      items: [
        {
          title,
          authorName: name,
          sourceUrl: "https://reedsy.com/discovery/book/test-book-test-author",
          verdictRating: 4,
          overview: "A gripping synopsis of the test book.",
          genre: "Fiction",
          qualified: true,
          reasons: [],
        },
        {
          title: "Unqualified Test Book",
          authorName: "Unqualified Author",
          sourceUrl: "https://reedsy.com/discovery/book/unqualified-test-book",
          verdictRating: 2,
          overview: "A synopsis of the unqualified book.",
          genre: "Fiction",
          qualified: false,
          reasons: ["2/5 is below the minimum 3/5"],
        },
      ],
    },
  }),
);
await context.route("**/api/admin/scout-manual-ingest", (route) => {
  const body = route.request().postDataJSON();
  return route.fulfill({
    json: {
      ok: true,
      item: {
        book: {
          id: "server-book",
          title: body.bookTitle,
          genre: body.genre,
          asin: null,
          source_url: body.sourceUrl,
        },
        author: { id: "server-author", name: body.authorName, country: body.country },
      },
    },
  });
});

try {
  await page.goto(`${process.env.SCOUT_TEST_URL || "http://localhost:8081"}/scout`);
  await page.getByRole("button", { name: "Search Reedsy" }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await expect(page.getByText("Unqualified Test Book", { exact: true })).toBeVisible();
  await expect(page.getByText(/Reedsy: Fiction/)).toBeVisible();
  await expect(page.getByText("A gripping synopsis of the test book.")).toBeVisible();
  console.log("PASS: Reedsy search saves qualified results and shows unqualified ones separately.");

  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Reedsy results (CSV)" }).click();
  const download = await downloadEvent;
  const csv = await readFile(await download.path(), "utf8");
  expect(csv).toContain('"Test Author, ""Quoted""","Test Book, ""Quoted""","4/5"');
  expect(csv).toContain('"Unqualified Author","Unqualified Test Book"');
  expect(await download.failure()).toBeNull();
  console.log("PASS: CSV export includes both qualified and unqualified results.");

  expect(errors).toEqual([]);
} finally {
  await browser.close();
}
