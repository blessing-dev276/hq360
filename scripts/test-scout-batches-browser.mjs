// Fixture-only: start bun dev, then SCOUT_TEST_URL=http://127.0.0.1:8082 bun scripts/test-scout-batches-browser.mjs
import { chromium, expect } from "@playwright/test";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const batches = [];
const claims = new Map();
let writes = 0;
let failOnce = false;
let searchMode = "normal";
await context.route("**/api/admin/session", (route) =>
  route.fulfill({ json: { configured: true, authed: true } }),
);
await context.route("**/api/admin/scout-reedsy-genres", (route) =>
  route.fulfill({ json: { genres: [{ id: 1, name: "Fiction", depth: 0, bookCount: 1000 }] } }),
);
await context.route("**/api/admin/scout-batches", (route) => {
  if (route.request().method() === "POST") {
    const body = route.request().postDataJSON();
    expect(body.requestedMax).toBeLessThanOrEqual(100);
    const batch = {
      id: crypto.randomUUID(),
      label: body.label,
      sources: [body.source],
      genre: body.genre,
      item_count: 0,
      created_at: new Date().toISOString(),
    };
    batches.push(batch);
    return route.fulfill({ json: { item: batch } });
  }
  return route.fulfill({ json: { items: batches } });
});
await context.route("**/api/admin/scout-batches/*", (route) => {
  if (route.request().method() === "DELETE") {
    const id = route.request().url().split("/").pop();
    const index = batches.findIndex((batch) => batch.id === id);
    if (index >= 0) batches.splice(index, 1);
    return route.fulfill({ json: { ok: true, removed: true } });
  }
  return route.fulfill({ json: { items: [] } });
});
await context.route("**/api/admin/scout-reedsy-search", async (route) => {
  const body = route.request().postDataJSON();
  await new Promise((resolve) => setTimeout(resolve, 100));
  if (searchMode !== "normal")
    return route.fulfill({
      json: {
        nextPage: null,
        items:
          searchMode === "empty"
            ? []
            : [
                {
                  authorName: "Author 0",
                  title: "Book 0",
                  sourceUrl: "https://reedsy.com/discovery/book/0",
                  genre: "Fiction",
                  verdictRating: 4,
                  qualified: true,
                },
              ],
      },
    });
  return route.fulfill({
    json: {
      nextPage: body.page < 20 ? body.page + 1 : null,
      items: Array.from({ length: 12 }, (_, index) => {
        const id = (body.page - 1) * 12 + index;
        return {
          authorName: `Author ${id}`,
          title: `Book ${id}`,
          sourceUrl: `https://reedsy.com/discovery/book/${id}`,
          genre: "Fiction",
          verdictRating: 4,
          qualified: true,
        };
      }).filter((item) => !claims.has(item.authorName)),
    },
  });
});
await context.route("**/api/admin/scout-readers-favorite", (route) => {
  const body = route.request().postDataJSON();
  expect(body.metadataOnly).toBe(true);
  return route.fulfill({
    json: {
      genres: [
        {
          path: "/book-reviews/book-reviews-genre-fiction-thriller-general.htm",
          name: "Thriller",
          bookCount: 3844,
          minimumBookCount: 3844,
        },
        {
          path: "/book-reviews/book-reviews-genre-fiction-fantasy.htm",
          name: "Fantasy",
          bookCount: body.catalog.includes("fantasy") ? 123 : null,
          minimumBookCount: 0,
        },
      ],
      items: [],
    },
  });
});
await context.route("**/api/admin/scout-manual-ingest", async (route) => {
  const body = route.request().postDataJSON();
  writes++;
  await new Promise((resolve) => setTimeout(resolve, 150));
  if (failOnce) {
    failOnce = false;
    return route.fulfill({ status: 503, json: { error: "Fixture storage failure" } });
  }
  const existing = claims.get(body.authorName);
  if (existing && existing !== body.batchId) return route.fulfill({ json: { duplicate: true } });
  claims.set(body.authorName, body.batchId);
  return route.fulfill({ json: { ok: true } });
});
try {
  await page.goto(`${process.env.SCOUT_TEST_URL || "http://127.0.0.1:8082"}/scout`);
  const count = page.getByRole("spinbutton", { name: "Authors to find" });
  const start = page.getByRole("button", { name: "Search & create batch" });
  await expect(page.getByLabel("Batches to generate")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Generation batches" })).toHaveCount(0);
  await count.fill("101");
  await expect(count).toHaveValue("100");
  await count.fill("9999");
  await expect(count).toHaveValue("100");
  await count.fill("");
  await expect(count).toHaveValue("");
  await count.fill("20");
  const panel = page.getByRole("region", { name: "Generation batches" });
  const jobs = panel.locator("article");
  for (let index = 0; index < 3; index++) {
    await start.click();
    await jobs.nth(index).getByRole("button", { name: "Pause", exact: true }).click();
  }
  await expect(jobs).toHaveCount(3);
  await expect(panel.getByRole("heading", { name: /3\/3 slots used/ })).toBeVisible();
  await expect(start).toBeDisabled();
  await page.waitForTimeout(500);
  const stoppedAt = writes;
  await page.waitForTimeout(400);
  expect(writes).toBe(stoppedAt);
  await jobs.nth(0).getByRole("button", { name: "Resume" }).click();
  await expect(jobs).toHaveCount(2, { timeout: 20000 });
  await expect(start).toBeEnabled();
  await expect(panel.getByRole("heading", { name: /2\/3 slots used/ })).toBeVisible();
  await jobs.nth(0).getByRole("button", { name: "Resume" }).click();
  await expect(jobs).toHaveCount(1, { timeout: 20000 });
  await jobs.nth(0).getByRole("button", { name: "Resume" }).click();
  await expect(panel).toHaveCount(0, { timeout: 20000 });
  expect(claims.size).toBe(60);
  for (const batch of batches)
    expect([...claims.values()].filter((id) => id === batch.id)).toHaveLength(20);
  expect(batches).toHaveLength(3);
  failOnce = true;
  await start.click();
  await jobs.nth(0).getByRole("button", { name: "Retry", exact: true }).click();
  await expect(panel).toHaveCount(0, { timeout: 20000 });
  expect(claims.size).toBe(80);
  searchMode = "empty";
  await start.click();
  await expect(
    page.getByText("No books found. No batch was saved. Try another category or source."),
  ).toBeVisible();
  expect(batches).toHaveLength(4);
  searchMode = "duplicates";
  await start.click();
  await expect(panel).toHaveCount(0, { timeout: 20000 });
  expect(batches).toHaveLength(4);
  await page
    .getByRole("navigation", { name: "Scouting sections" })
    .getByRole("button", { name: "Batches", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "Batches", exact: true })).toBeVisible();
  await expect(start).toBeHidden();
  await expect(page.getByLabel("Choose a batch").locator("option")).toHaveCount(5);
  await page
    .getByRole("navigation", { name: "Scouting sections" })
    .getByRole("button", { name: "Scouting", exact: true })
    .click();
  await page.getByLabel("Review source", { exact: true }).selectOption("readers_favorite");
  await expect(
    page
      .getByLabel("Book review category")
      .locator("option", { hasText: "Thriller (3,844 books)" }),
  ).toHaveCount(1);
  await page
    .getByLabel("Book review category")
    .selectOption("/book-reviews/book-reviews-genre-fiction-fantasy.htm");
  await expect(
    page.getByLabel("Book review category").locator("option", { hasText: "Fantasy (123 books)" }),
  ).toHaveCount(1);
  await page
    .getByLabel("Book review category")
    .selectOption("/book-reviews/book-reviews-genre-fiction-thriller-general.htm");
  await expect(
    page.getByLabel("Book review category").locator("option", { hasText: "Fantasy (123 books)" }),
  ).toHaveCount(1);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(errors).toEqual([]);
  console.log(
    "PASS: typed limit, max 100, three batches, independent pause/resume, repeated-search exclusions, retry, mobile layout.",
  );
} finally {
  await browser.close();
}
