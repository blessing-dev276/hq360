// Production preview test with fixture APIs; no source or database writes.
import { chromium, expect } from "@playwright/test";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const batches = [],
  listings = new Map(),
  books = new Map(),
  requests = [];
await page.route("**/api/admin/session", (route) =>
  route.fulfill({ json: { configured: true, authed: true } }),
);
await page.route("**/api/admin/scout-batches", (route) =>
  route.fulfill({ json: { ok: true, items: batches } }),
);
await page.route("**/api/admin/scout-batches/*", (route) => {
  const id = route.request().url().split("/").pop();
  return route.fulfill({ json: { ok: true, items: books.has(id) ? [books.get(id)] : [] } });
});
await page.route("**/api/admin/scout-reedsy-genres", (route) =>
  route.fulfill({ json: { ok: true, genres: [{ id: 1, name: "Fantasy", bookCount: 5 }] } }),
);
await page.route("**/api/admin/scout-arc-discovery**", async (route) => {
  const request = route.request(),
    url = new URL(request.url());
  if (request.method() === "GET")
    return route.fulfill({
      json: {
        items: url.searchParams.has("batchId")
          ? (listings.get(url.searchParams.get("batchId")) ?? [])
          : batches.filter((b) => b.sources.includes(url.searchParams.get("source"))),
      },
    });
  const body = request.postDataJSON();
  if (request.method() === "PATCH") {
    for (const rows of listings.values())
      for (const row of rows) if (row.id === body.listingId) row.book_id = body.bookId;
    return route.fulfill({ json: { ok: true } });
  }
  requests.push(body);
  await new Promise((r) => setTimeout(r, 250));
  const batch = {
    id: body.requestId,
    label: `${body.source} · ${body.genre || "All genres"}`,
    genre: body.genre,
    sources: [body.source],
    item_count: 1,
    created_at: new Date().toISOString(),
  };
  batches.unshift(batch);
  listings.set(batch.id, [
    {
      id: crypto.randomUUID(),
      batch_id: batch.id,
      source: body.source,
      source_url: body.listingUrl || "https://www.netgalley.com/catalog/book/123",
      title: body.listingUrl ? "" : "Fixture Book",
      author_name: body.listingUrl ? null : "Fixture Author",
      publication_date: null,
      genre: null,
      evidence: "A public listing",
      discovery_method: body.listingUrl ? "manual" : "search_index",
      book_id: null,
    },
  ]);
  return route.fulfill({ json: { batch, message: "1 listing saved." } });
});
await page.route("**/api/admin/scout-manual-ingest", (route) => {
  const b = route.request().postDataJSON();
  const book = {
    id: crypto.randomUUID(),
    title: b.bookTitle,
    source_slug: b.sourceSlug,
    source_url: b.sourceUrl,
    genre: null,
    publication_date: b.publicationDate ?? null,
    scout_authors: { id: crypto.randomUUID(), name: b.authorName, contact_email: null },
    scout_review_counts: [],
    scout_prospects: [],
  };
  books.set(b.batchId, book);
  return route.fulfill({ json: { ok: true, item: { book, author: book.scout_authors } } });
});
await page.route("**/api/admin/scout-authors/*/find-contact", (route) =>
  route.fulfill({
    json: {
      ok: true,
      found: true,
      candidateUrl: "https://example.com",
      candidateTitle: "Fixture Author",
      contactEmail: "author@example.com",
      contactFormUrl: null,
      verified: false,
    },
  }),
);
try {
  await page.goto(`${process.env.SCOUT_TEST_URL || "http://127.0.0.1:8081"}/scout`);
  await page.getByLabel("Review source", { exact: true }).selectOption("netgalley");
  for (const value of [
    "netgalley",
    "booksirens",
    "booksprout",
    "storyorigin",
    "booklife",
    "onlinebookclub",
    "booknotification",
  ])
    await expect(
      page.getByLabel("Review source", { exact: true }).locator(`option[value="${value}"]`),
    ).toHaveCount(1);
  await page.getByLabel("Genre", { exact: true }).selectOption("Fantasy");
  await page.getByLabel("Publication from").fill("2026-10-01");
  await page.getByRole("button", { name: "Search and create batch" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Discovering NetGalley" })).toBeVisible();
  await expect(
    page.getByText("Fixture Author · Publication date unknown · Review count unknown", {
      exact: true,
    }),
  ).toBeVisible();
  expect(requests[0]).toMatchObject({
    source: "netgalley",
    genre: "Fantasy",
    from: "2026-10-01",
    includeUnknown: true,
  });
  await expect(page.getByRole("button", { name: "Save author details" })).toHaveCount(0);
  await expect(page.getByText(/1 authors saved automatically/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Open author details" })).toBeVisible();
  await page.getByRole("button", { name: "Open author details" }).click();
  await expect(page.getByRole("heading", { name: "Fixture Author" })).toBeVisible();
  await expect(page.getByRole("link", { name: "View NetGalley listing" })).toBeVisible();
  await page.getByLabel("Review source", { exact: true }).selectOption("netgalley");
  await expect(page.getByText(/Author saved to/)).toBeVisible();
  await page.getByLabel("Review source", { exact: true }).selectOption("booksprout");
  await page.getByText("Add a specific book link", { exact: true }).click();
  await page
    .getByLabel("Booksprout book URL")
    .fill("https://booksprout.co/reviewer/review-copy/view/123/test-book");
  await page.getByRole("button", { name: "Add to new batch" }).click();
  await expect(page.getByRole("heading", { name: "Book details needed" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save author details" })).toBeDisabled();
  const incomplete = listings.get(batches[0].id)[0];
  expect(incomplete.book_id).toBeNull();
  // Simulate an older complete listing or an interrupted automatic save.
  incomplete.title = "Recovered Book";
  incomplete.author_name = "Recovered Author";
  await page.getByLabel("Review source", { exact: true }).selectOption("netgalley");
  await page.getByLabel("Review source", { exact: true }).selectOption("booksprout");
  await page.getByRole("button", { name: "Save all ready authors" }).click();
  await expect(page.getByText(/Author saved to/)).toBeVisible();
  expect(incomplete.book_id).toBeTruthy();
  await page.getByLabel("Review source", { exact: true }).selectOption("booknotification");
  await expect(page.getByLabel("Genre", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/latest public upcoming-release sample/)).toBeVisible();
  await page.getByRole("button", { name: "Search and create batch" }).click();
  await expect(page.getByText(/1 authors saved automatically/)).toBeVisible();
  expect(requests.at(-1)).toMatchObject({
    source: "booknotification",
    genre: "",
    from: "",
    to: "",
    includeUnknown: true,
    page: 1,
  });
  expect(errors).toEqual([]);
  console.log(
    "ARC browser checks passed: sources, filters, glass loading, saved batches, automatic saving, batch recovery, author details and manual links.",
  );
} catch (error) {
  console.error((await page.locator("body").innerText()).slice(0, 6000));
  throw error;
} finally {
  await browser.close();
}
