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
      author_name: null,
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
  for (const value of ["netgalley", "booksirens", "booksprout", "storyorigin"])
    await expect(
      page.getByLabel("Review source", { exact: true }).locator(`option[value="${value}"]`),
    ).toHaveCount(1);
  await page.getByLabel("Genre", { exact: true }).selectOption("Fantasy");
  await page.getByLabel("Publication from").fill("2026-10-01");
  await page.getByRole("button", { name: "Search and create batch" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Discovering NetGalley" })).toBeVisible();
  await expect(
    page.getByText("Author unknown · Publication date unknown · Review count unknown", {
      exact: true,
    }),
  ).toBeVisible();
  expect(requests[0]).toMatchObject({
    source: "netgalley",
    genre: "Fantasy",
    from: "2026-10-01",
    includeUnknown: true,
  });
  await expect(page.getByRole("button", { name: "Confirm and save author" })).toBeDisabled();
  await page.getByLabel("Author name", { exact: true }).fill("Fixture Author");
  await page.getByRole("button", { name: "Confirm and save author" }).click();
  await expect(
    page.getByRole("button", { name: "Open author details & batch email discovery" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open author details & batch email discovery" }).click();
  await expect(page.getByRole("heading", { name: "Fixture Author" })).toBeVisible();
  await expect(page.getByRole("link", { name: "View NetGalley listing" })).toBeVisible();
  await page.getByRole("button", { name: /Find emails for entire batch/ }).click();
  await expect(page.getByText(/email found: author@example.com/).first()).toBeVisible();
  await page.getByLabel("Review source", { exact: true }).selectOption("netgalley");
  await expect(page.getByText(/Author saved to/)).toBeVisible();
  await page.getByLabel("Review source", { exact: true }).selectOption("booksprout");
  await page.getByText("Add a specific review-copy link", { exact: true }).click();
  await page
    .getByLabel("Booksprout book URL")
    .fill("https://booksprout.co/reviewer/review-copy/view/123/test-book");
  await page.getByRole("button", { name: "Add to new batch" }).click();
  await expect(page.getByRole("heading", { name: "Book details needed" })).toBeVisible();
  expect(errors).toEqual([]);
  console.log(
    "ARC browser checks passed: sources, filters, glass loading, saved batches, confirmation, email handoff and manual links.",
  );
} catch (error) {
  console.error((await page.locator("body").innerText()).slice(0, 6000));
  throw error;
} finally {
  await browser.close();
}
