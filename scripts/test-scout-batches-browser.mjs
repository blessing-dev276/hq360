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
await context.route("**/api/admin/scout-batches/*", (route) =>
  route.fulfill({ json: { items: [] } }),
);
await context.route("**/api/admin/scout-reedsy-search", async (route) => {
  const body = route.request().postDataJSON();
  await new Promise((resolve) => setTimeout(resolve, 100));
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
  await count.fill("101");
  await start.click();
  expect(batches).toHaveLength(0);
  await count.fill("20");
  await page.getByLabel("Batches to generate").selectOption("3");
  await start.click();
  const jobs = page.getByRole("region", { name: "Generation batches" }).locator("article");
  await expect(jobs).toHaveCount(3);
  await expect(start).toBeDisabled();
  await jobs.nth(0).getByRole("button", { name: "Pause", exact: true }).click();
  await expect(jobs.nth(0).getByRole("button", { name: "Resume" })).toBeVisible();
  await expect(jobs.nth(1).getByText("Batch complete", { exact: true })).toBeVisible({
    timeout: 20000,
  });
  await expect(jobs.nth(2).getByText("Batch complete", { exact: true })).toBeVisible({
    timeout: 20000,
  });
  const stoppedAt = writes;
  await page.waitForTimeout(400);
  expect(writes).toBe(stoppedAt);
  await jobs.nth(0).getByRole("button", { name: "Resume" }).click();
  await expect(jobs.nth(0).getByText("Batch complete", { exact: true })).toBeVisible({
    timeout: 20000,
  });
  expect(claims.size).toBe(60);
  for (const batch of batches)
    expect([...claims.values()].filter((id) => id === batch.id)).toHaveLength(20);
  await page.getByLabel("Batches to generate").selectOption("1");
  failOnce = true;
  await start.click();
  await jobs.nth(3).getByRole("button", { name: "Retry", exact: true }).click();
  await expect(jobs.nth(3).getByText("Batch complete", { exact: true })).toBeVisible({
    timeout: 20000,
  });
  expect(claims.size).toBe(80);
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
