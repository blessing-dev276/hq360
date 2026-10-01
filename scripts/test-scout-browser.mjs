// Run the app first, then: SCOUT_TEST_URL=http://localhost:8081 bun scripts/test-scout-browser.mjs
// All scouting requests use fixtures; no production records are written.
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
const batches = [],
  books = new Map(),
  memberships = new Map();
let failOnce = false,
  empty = false;
const name = 'Test Author, "Quoted"';
await context.route("**/api/admin/session", (route) =>
  route.fulfill({ json: { configured: true, authed: true } }),
);
await context.route("**/api/admin/scout-batches", (route) => {
  if (route.request().method() === "POST") {
    const body = route.request().postDataJSON();
    const batch = {
      id: crypto.randomUUID(),
      label: body.label,
      sources: [body.source],
      genre: body.genre,
      created_at: new Date().toISOString(),
      item_count: 0,
    };
    batches.unshift(batch);
    memberships.set(batch.id, new Set());
    return route.fulfill({ json: { ok: true, item: batch } });
  }
  return route.fulfill({
    json: {
      ok: true,
      items: batches.map((batch) => ({ ...batch, item_count: memberships.get(batch.id).size })),
    },
  });
});
await context.route("**/api/admin/scout-batches/*", (route) => {
  const id = route.request().url().split("/").pop();
  return route.fulfill({
    json: { ok: true, items: [...memberships.get(id)].map((url) => books.get(url)) },
  });
});
await context.route("**/api/admin/scout-reedsy-genres", (route) =>
  route.fulfill({
    json: { ok: true, genres: [{ id: 10, name: "Fiction", depth: 0, bookCount: 100 }] },
  }),
);
await context.route("**/api/admin/scout-reedsy-search", (route) => {
  const body = route.request().postDataJSON();
  expect(body).not.toHaveProperty("debutOnly");
  expect(body).not.toHaveProperty("minVerdictRating");
  return route.fulfill({
    json: {
      ok: true,
      items: empty
        ? []
        : [
            {
              title: "First book",
              authorName: name,
              sourceUrl: "https://reedsy.com/discovery/book/first",
              verdictRating: 4,
              overview: "Complete book synopsis.",
              genre: "Fiction",
            },
            {
              title: "Second book",
              authorName: "Second author",
              sourceUrl: "https://reedsy.com/discovery/book/second",
              verdictRating: null,
              overview: "No score yet.",
              genre: "Fiction",
            },
          ],
    },
  });
});
await context.route("**/api/admin/scout-readers-favorite", (route) =>
  route.fulfill({
    json: {
      items: [
        {
          title: "Reader book",
          authorName: "Reader author",
          sourceUrl: "https://readersfavorite.com/book-review/example",
          rating: 5,
          genre: "Fantasy",
        },
      ],
      genres: [{ path: "/book-reviews/book-reviews-genre-fiction-fantasy.htm", name: "Fantasy" }],
      hasNext: false,
    },
  }),
);
await context.route("**/api/admin/scout-manual-ingest", (route) => {
  if (failOnce) {
    failOnce = false;
    return route.fulfill({ status: 503, json: { ok: false, error: "storage" } });
  }
  const body = route.request().postDataJSON();
  const book = {
    id: body.sourceUrl,
    title: body.bookTitle,
    genre: body.genre,
    source_slug: body.sourceSlug,
    source_url: body.sourceUrl,
    description: body.description,
    scout_authors: {
      id: body.sourceUrl,
      name: body.authorName,
      country: "Nigeria",
      bio: "Author biography.",
    },
    scout_review_counts: body.reviewRating
      ? [{ platform: body.reviewPlatform, rating: body.reviewRating, review_count: null }]
      : [],
    scout_prospects: [],
  };
  books.set(body.sourceUrl, book);
  memberships.get(body.batchId).add(body.sourceUrl);
  return route.fulfill({ json: { ok: true } });
});
try {
  await page.goto(`${process.env.SCOUT_TEST_URL || "http://localhost:8081"}/scout`);
  const search = page.getByRole("button", { name: "Search & create batch" });
  await search.click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await expect(page.getByText("Complete book synopsis.")).toBeVisible();
  await expect(page.getByText("Imported authors", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Saved authors", { exact: true })).toHaveCount(0);
  await page.getByRole("combobox", { name: /^Book reviews/ }).selectOption("unknown");
  await expect(page.getByRole("heading", { name: "Second author" })).toBeVisible();
  await expect(page.getByRole("heading", { name, exact: true })).toHaveCount(0);
  await page.getByRole("combobox", { name: /^Book reviews/ }).selectOption("all");
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  const csv = await readFile(await (await downloadEvent).path(), "utf8");
  expect(csv).toContain('"Test Author, ""Quoted""","First book"');
  expect(csv).toContain("Second author");
  await search.click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  expect(batches).toHaveLength(2);
  await expect.poll(() => memberships.get(batches[0].id).size).toBe(2);
  await expect(search).toBeEnabled();
  await page.reload();
  await page
    .getByRole("button", { name: /Reedsy · Fiction/ })
    .first()
    .click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: /^Review source/ }).selectOption("readers_favorite");
  await expect(
    page.getByLabel("Book review category").getByRole("option", { name: "Fantasy", exact: true }),
  ).toHaveCount(1);
  await page
    .getByLabel("Book review category")
    .selectOption("/book-reviews/book-reviews-genre-fiction-fantasy.htm");
  failOnce = true;
  await search.click();
  await page.getByRole("button", { name: "Retry 1 unsaved results" }).click();
  await expect(page.getByRole("heading", { name: "Reader author" })).toBeVisible();
  await expect(page.getByText("5/5 · Readers’ Favorite", { exact: false })).toBeVisible();
  await page.screenshot({ path: "/tmp/hq360-scout-desktop.png", fullPage: true });
  await page.getByLabel("Filter batches").selectOption("readers_favorite");
  await expect(page.getByRole("button", { name: /Reedsy · Fiction/ })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole("combobox", { name: /^Review source/ }).selectOption("reedsy_discovery");
  empty = true;
  await search.click();
  await expect(page.getByText("This batch has no saved results.")).toBeVisible();
  expect(batches).toHaveLength(4);
  expect(errors).toEqual([]);
  await page.screenshot({ path: "/tmp/hq360-scout-mobile.png", fullPage: true });
  console.log(
    "PASS: batches, repeat searches, reload persistence, both sources, review filtering, CSV, retry, empty results, mobile layout.",
  );
} finally {
  await browser.close();
}
