import { chromium, expect } from "@playwright/test";
const base = process.env.BASE_URL || "http://localhost:8102";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname))
  throw new Error("Use local preview");
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
let searches = 0;
const imports = [];
let followups = 0;
await context.route("**/api/**", (route) => {
  const url = new URL(route.request().url());
  if (url.pathname.endsWith("/session"))
    return route.fulfill({ json: { authed: true, configured: true } });
  if (url.pathname.endsWith("scout-readers-favorite")) {
    searches++;
    return route.fulfill({
      json: {
        items: [
          {
            title: "A Test Book",
            authorName: "Alex Example",
            sourceUrl: "https://readersfavorite.com/book-review/a-test-book",
            rating: 5,
            genre: "Fiction",
          },
          {
            title: "Unrated Book",
            authorName: "Sam Writer",
            sourceUrl: "https://readersfavorite.com/book-review/unrated",
            rating: null,
            genre: "Fiction",
          },
        ],
        genres: [
          {
            path: "/book-reviews/book-reviews-genre-fiction-thriller-general.htm",
            name: "Fiction",
          },
        ],
        hasNext: false,
      },
    });
  }
  if (url.pathname.endsWith("scout-manual-ingest")) {
    imports.push(route.request().postDataJSON());
    return route.fulfill({
      json: {
        item: {
          book: { id: "22222222-2222-4222-8222-222222222222" },
          author: { id: "11111111-1111-4111-8111-111111111111", name: "Alex Example" },
        },
      },
    });
  }
  if (url.pathname.endsWith("scout-prospects") && route.request().method() === "POST") {
    followups++;
    return route.fulfill({ json: { ok: true } });
  }
  return route.fulfill({ json: { items: [], genres: [] } });
});
try {
  await page.goto(`${base}/scout`);
  await page.getByRole("button", { name: "Readers’ Favorite", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Find authors on Readers’ Favorite" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Search Readers’ Favorite", exact: true }).click();
  await expect(page.getByText("Alex Example", { exact: false }).first()).toBeVisible();
  await page.getByLabel("Minimum score").selectOption("5");
  await expect(page.getByText("Unrated Book", { exact: false })).toHaveCount(0);
  await page.getByRole("button", { name: "Select new results" }).click();
  await page.getByRole("button", { name: "Import selected (1)" }).click();
  await expect(page.locator("p[role=status]")).toContainText("1 books imported");
  expect(imports).toHaveLength(1);
  expect(imports[0].reviewRating).toBe(5);
  expect(imports[0].reviewCount).toBeUndefined();
  expect(imports[0].sourceSlug).toBe("readers_favorite");
  await page.getByRole("button", { name: "Save for follow-up" }).click();
  await expect(page.locator("p[role=status]")).toContainText("saved for follow-up");
  expect(followups).toBe(1);
  expect(searches).toBe(1);
  await page.screenshot({ path: "/tmp/readers-favorite-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Reedsy Discovery", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Find new and debut authors on Reedsy" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  console.log(
    "PASS: source switching, search, unknown-rating filter, selected import, score semantics, follow-up, mobile overflow.",
  );
} finally {
  await browser.close();
}
