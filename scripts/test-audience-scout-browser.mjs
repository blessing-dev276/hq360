// Start a local production preview; all API traffic here uses fixtures.
import { chromium, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const batches = [],
  memberships = new Map(),
  leads = new Map(),
  requests = [];
let failSearch = true;
await page.route("**/api/admin/session", (route) =>
  route.fulfill({ json: { configured: true, authed: true } }),
);
await page.route("**/api/admin/scout-batches", (route) =>
  route.fulfill({ json: { ok: true, items: [] } }),
);
await page.route("**/api/admin/scout-reedsy-genres", (route) =>
  route.fulfill({ json: { ok: true, genres: [] } }),
);
await page.route("**/api/admin/scout-audience-batches?*", async (route) => {
  const audience = new URL(route.request().url()).searchParams.get("audience");
  await new Promise((resolve) => setTimeout(resolve, 150));
  return route.fulfill({
    json: { ok: true, items: batches.filter((batch) => batch.audience === audience) },
  });
});
await page.route("**/api/admin/scout-audience-batches", async (route) => {
  const body = route.request().postDataJSON();
  requests.push(body);
  await new Promise((resolve) => setTimeout(resolve, 250));
  if (failSearch) {
    failSearch = false;
    return route.fulfill({
      status: 503,
      json: { ok: false, message: "Fixture provider temporarily unavailable" },
    });
  }
  const batch = {
    id: body.requestId,
    audience: body.audience,
    source: body.source,
    label: `${body.source} · ${body.niche} · ${body.location}`,
    query: body.niche,
    created_at: new Date().toISOString(),
    item_count: 2,
    location: body.location,
    page: body.page,
  };
  if (!batches.some((item) => item.id === batch.id)) batches.unshift(batch);
  const ids = [0, 1].map((index) => {
    const key = `${body.source}-${index}`;
    if (!leads.has(key))
      leads.set(key, {
        id: crypto.randomUUID(),
        source: body.source,
        source_key: key,
        name: index === 0 ? "=Fixture Company" : "Second Prospect",
        source_url: `https://example.com/${key}`,
        website_url: index === 0 ? "https://example.com" : null,
        description: "Public listing description",
        category: body.source === "maps" ? "Cleaning service" : null,
        address: body.source === "maps" ? "London" : null,
        phone: body.source === "maps" ? "+44 123" : null,
        rating: body.source === "maps" ? 4.8 : null,
        review_count: body.source === "maps" ? 15 : null,
        contact_email: null,
        contact_source_url: null,
        contact_status: "unverified",
        shortlisted: false,
      });
    return key;
  });
  memberships.set(batch.id, ids);
  return route.fulfill({ json: { ok: true, batch } });
});
await page.route("**/api/admin/scout-audience-batches/*", (route) => {
  const id = route.request().url().split("/").pop();
  return route.fulfill({
    json: {
      ok: true,
      batch: batches.find((batch) => batch.id === id),
      items: memberships.get(id).map((key) => leads.get(key)),
    },
  });
});
await page.route("**/api/admin/scout-audience-leads/*", async (route) => {
  const id = route.request().url().split("/").pop();
  const lead = [...leads.values()].find((item) => item.id === id);
  const { action } = route.request().postDataJSON();
  await new Promise((resolve) => setTimeout(resolve, 150));
  if (action === "find-email" && lead.website_url) {
    lead.contact_email = "hello@example.com";
    lead.contact_source_url = "https://example.com/contact";
  }
  if (action === "verify-email") lead.contact_status = "verified";
  if (action === "shortlist") lead.shortlisted = true;
  return route.fulfill({
    json: {
      ok: true,
      item: lead,
      message: lead.contact_email ? "Email available." : "No website is listed.",
    },
  });
});
try {
  await page.goto(`${process.env.SCOUT_TEST_URL || "http://127.0.0.1:8081"}/scout`);
  await page.getByLabel("Audience", { exact: true }).selectOption("cleaning-businesses");
  await expect(page.getByRole("heading", { name: "Cleaning Businesses scouting" })).toBeVisible();
  await expect(page.getByLabel("Search source")).toHaveValue("maps");
  await page.getByLabel("Niche or keywords").fill("residential");
  await page.getByLabel("Location", { exact: true }).fill("London UK");
  const search = page.getByRole("button", { name: "Search & create batch" });
  await search.click();
  await expect(page.getByText("Searching Google Maps and saving your batch…")).toBeVisible();
  await expect(page.getByText(/Fixture provider temporarily unavailable/)).toBeVisible();
  expect(batches).toHaveLength(0);
  await search.click();
  await expect(page.getByRole("heading", { name: "=Fixture Company" })).toBeVisible();
  expect(requests[0].requestId).toBe(requests[1].requestId);
  await expect(page.getByText("4.8/5 · 15 reviews")).toHaveCount(2);
  await page.getByRole("button", { name: "Find emails for entire batch" }).click();
  await expect(page.getByText(/2 of 2 leads checked · 1 emails available/)).toBeVisible();
  await page.getByLabel("Filter leads").selectOption("email");
  await expect(page.getByRole("heading", { name: "Second Prospect" })).toHaveCount(0);
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  const csv = await readFile(await (await downloadEvent).path(), "utf8");
  expect(csv).toContain("'=Fixture Company");
  expect(csv).toContain("hello@example.com");
  expect(csv).toContain("unverified");
  expect(csv).not.toContain("Second Prospect");
  await page.getByRole("button", { name: "I’ve checked this — verify email" }).click();
  await expect(page.getByText("hello@example.com · verified")).toBeVisible();
  await page.getByRole("button", { name: "Shortlist", exact: true }).click();
  await expect(page.getByRole("button", { name: "Shortlisted", exact: true })).toBeDisabled();
  const firstBatch = batches[0].id;
  await page.reload();
  await page.getByLabel("Audience", { exact: true }).selectOption("cleaning-businesses");
  await page.getByLabel("Choose a batch").selectOption(firstBatch);
  await expect(page.getByText("hello@example.com · verified")).toBeVisible();
  await page.getByLabel("Search source").selectOption("web");
  await page.getByLabel("Niche or keywords").fill("sustainable cleaning");
  await search.click();
  await expect(page.getByRole("heading", { name: "=Fixture Company" })).toBeVisible();
  await expect(search).toBeEnabled();
  await expect(page.getByText("4.8/5 · 15 reviews")).toHaveCount(0);
  expect(batches[0].source).toBe("web");
  await page.screenshot({ path: "/tmp/hq360-audience-scout-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "/tmp/hq360-audience-scout-mobile.png", fullPage: true });
  await page.getByLabel("Audience", { exact: true }).selectOption("ugc-creators");
  await expect(page.getByLabel("Search source")).toHaveValue("web");
  await expect(page.getByLabel("Choose a batch").getByRole("option")).toHaveCount(1);
  expect(errors).toEqual([]);
  console.log(
    "PASS: Maps + web searches, audience isolation, glass loading, failed-search retry identity, batches, persistent verification, bulk email, shortlist, CSV and mobile layout.",
  );
} finally {
  await browser.close();
}
