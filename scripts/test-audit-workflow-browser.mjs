// Explicitly opt in: creates an isolated test audit in the configured database,
// exercises the real local app and private client endpoints, then removes only
// its own audit, author/book and evidence files. Never sends client messages.
import { chromium, expect } from "@playwright/test";
import { sessionCookie } from "../src/lib/admin-auth.server.ts";
import { supabaseAdmin } from "../src/integrations/supabase/client.server.ts";
import { SECTION_KEYS } from "../src/lib/author-audit/workflow.ts";
if (process.env.RUN_AUDIT_LIVE_TEST !== "1")
  throw new Error("Set RUN_AUDIT_LIVE_TEST=1 to create and clean up an isolated test audit.");
const base = process.env.AUDIT_TEST_URL || "http://127.0.0.1:8088";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ extraHTTPHeaders: { Origin: base } });
const cookie = (await sessionCookie()).split(";")[0];
await context.addCookies([
  { name: "hq360_admin", value: cookie.slice(cookie.indexOf("=") + 1), url: base, httpOnly: true },
]);
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
let id, authorId, bookId;
const testName = `HQ360 Workflow Test ${crypto.randomUUID().slice(0, 8)}`;
let wf;
async function state() {
  const r = await context.request.get(`${base}${wf}`);
  expect(r.ok()).toBeTruthy();
  return r.json();
}
async function act(body, status = 200) {
  const r = await context.request.post(`${base}${wf}`, { data: body });
  const data = await r.json();
  if (r.status() !== status)
    throw new Error(
      `${body.action}: expected ${status}, got ${r.status()}: ${JSON.stringify(data)}`,
    );
  return data;
}
async function tab(name) {
  await page
    .getByRole("navigation", { name: "Audit workflow" })
    .getByRole("button", { name, exact: true })
    .click();
}
async function settle() {
  await expect(
    page.getByRole("status").filter({ hasText: /Saving|Save…|Approve…|Import…/ }),
  ).toHaveCount(0);
}
async function reopen() {
  await page.reload();
  await page
    .getByRole("navigation", { name: "Admin navigation" })
    .getByRole("button", { name: "Audit", exact: true })
    .click();
  await page.getByLabel("Search audits").fill(testName);
  await page
    .getByRole("button")
    .filter({ hasText: `Fixture Book — ${testName}` })
    .click();
  await expect(page.getByRole("navigation", { name: "Audit workflow" })).toBeVisible();
}
try {
  await page.goto(`${base}/admin`);
  await page
    .getByRole("navigation", { name: "Admin navigation" })
    .getByRole("button", { name: "Audit", exact: true })
    .click();
  await page.getByRole("button", { name: "+ New audit", exact: true }).click();
  await page.getByLabel("Author name", { exact: true }).fill(testName);
  await page.getByLabel("Book title", { exact: true }).fill("Fixture Book");
  await page.getByLabel("Author website (optional)").fill("https://example.com");
  await page.getByLabel("Notes (optional)").fill("Isolated workflow test");
  const created = page.waitForResponse(
    (r) => r.url().endsWith("/api/admin/author-audits") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Create audit", exact: true }).click();
  const result = await (await created).json();
  if (!result.item) throw new Error(JSON.stringify(result));
  ({ id, author_id: authorId, book_id: bookId } = result.item);
  wf = `/api/admin/author-audits/${id}/workflow`;
  await expect(page.getByRole("navigation", { name: "Audit workflow" })).toBeVisible();
  expect((await state()).audit.status).toBe("research_pending");
  await tab("Research");
  await page.getByRole("button", { name: "Generate Prompt", exact: true }).click();
  await expect(page.getByLabel("Generated research prompt")).toContainText(id);
  expect(await page.getByLabel("Generated research prompt").inputValue()).toContain(testName);
  await page.getByLabel("Research JSON", { exact: true }).fill("{ bad JSON");
  await page.getByRole("button", { name: "Validate JSON", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("JSON syntax");
  const raw = {
    ...Object.fromEntries(SECTION_KEYS.map((k) => [k, null])),
    audit_meta: {
      audit_id: id,
      author_name: testName,
      book_title: "Fixture Book",
      research_date: "2026-10-02",
    },
    executive_summary: "A specific, evidence-led review of the book website.",
    audit_findings: [
      {
        title: "Newsletter link missing",
        category: "website_audit",
        what_we_checked: "The book page footer",
        what_we_found: "No newsletter link on the inspected page.",
        evidence: "Observed on the page, October 2, 2026.",
        source_urls: ["https://example.com/book"],
        why_it_matters: "Readers need a way to follow.",
        recommendation: "Add the newsletter link.",
        implementation_steps: ["Add a sign-up link"],
      },
      {
        title: "Unconfirmed retailer gap",
        category: "amazon_audit",
        what_we_found: "Needs checking",
      },
    ],
    goodreads_listopia_audit: [
      {
        list_name: "Fixture Fantasy List",
        list_url: "https://www.goodreads.com/list/show/1",
        book_present: true,
        position: 184,
        page: 4,
        votes: 7,
        number_of_books: 400,
        competition: "high",
        relevance_score: 75,
        books_above: ["Book Above"],
        books_below: ["Book Below"],
        why_position: "Cause unknown; this is not an algorithm claim.",
        how_to_improve: "Check relevance and reader pathways.",
        evidence: "Manual page review needed.",
      },
    ],
    screenshot_queue: [
      {
        title: "Capture list position",
        category: "goodreads_listopia_audit",
        instructions: "Include list name, position, page, two books above and below.",
        required: true,
      },
    ],
    manual_review_queue: [
      {
        title: "Verify book page",
        category: "website_audit",
        instructions: "Inspect the linked source",
        required: true,
      },
    ],
    priority_action_plan: [
      {
        title: "Improve reader follow path",
        description: "Add the confirmed newsletter link.",
        horizon: "do_first",
        service: "Website optimization",
      },
    ],
  };
  await page.getByLabel("Research JSON", { exact: true }).fill(JSON.stringify(raw));
  await page.getByRole("button", { name: "Validate JSON", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Research preview" })).toBeVisible();
  await page.getByRole("button", { name: "Import Research", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Newsletter link missing", exact: true }),
  ).toBeVisible();
  const card = page
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name: "Newsletter link missing", exact: true }) });
  await card.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByLabel("Manual verification", { exact: true }).selectOption("verified");
  await page.getByLabel("Reviewer notes (internal)").fill("INTERNAL NOTE MUST NOT LEAK");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("button", { name: "Save changes", exact: true })).toHaveCount(0);
  await card.getByRole("button", { name: "Approve", exact: true }).click();
  await settle();
  await page
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name: "Unconfirmed retailer gap", exact: true }) })
    .getByRole("button", { name: "Reject", exact: true })
    .click();
  await settle();
  await page.getByRole("button", { name: "+ Add Manual Finding" }).click();
  await page.getByLabel("Finding title", { exact: true }).fill("Manual reader-path finding");
  await page
    .getByLabel("What We Found", { exact: true })
    .fill("A working book purchase link is present.");
  await page.getByLabel("Evidence", { exact: true }).fill("Observed on the book page.");
  await page.getByLabel("Recommendation", { exact: true }).fill("Preserve the working link.");
  await page.getByLabel("Manual verification", { exact: true }).selectOption("verified");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Manual reader-path finding" })).toBeVisible();
  await page
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name: "Manual reader-path finding" }) })
    .getByRole("button", { name: "Approve", exact: true })
    .click();
  await settle();
  // Publishing before review/QA must fail, even for an authenticated admin.
  const early = await act({ action: "generate", notes: "Incomplete review" });
  await act({ action: "publish", versionId: early.versionId }, 409);
  await tab("Goodreads");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByLabel("Manual verification", { exact: true }).selectOption("verified");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("button", { name: "Save changes", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await settle();
  await tab("Screenshots");
  const png = await page.screenshot();
  await page
    .getByText("Upload screenshot", { exact: true })
    .locator("input")
    .setInputFiles({ name: "real-browser-capture.png", mimeType: "image/png", buffer: png });
  await expect(page.getByRole("heading", { name: "real-browser-capture.png" })).toBeVisible();
  let current = await state();
  const finding = current.findings.find((f) => f.title === "Newsletter link missing");
  const list = current.listopia[0];
  await page
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name: "real-browser-capture.png" }) })
    .getByRole("button", { name: "Edit", exact: true })
    .click();
  await page.getByLabel("Finding ID (optional)", { exact: true }).fill(finding.id);
  await page.getByLabel("Listopia list ID (optional)", { exact: true }).fill(list.id);
  await page.getByLabel("Caption", { exact: true }).fill("Browser workflow fixture");
  await page
    .getByLabel("What it proves", { exact: true })
    .fill("Test screenshot is attached to the audit.");
  await page.getByLabel("Source URL", { exact: true }).fill("https://example.com/book");
  await page.getByLabel("Capture date", { exact: true }).fill("2026-10-02");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("button", { name: "Save changes", exact: true })).toHaveCount(0);
  await page
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name: "real-browser-capture.png" }) })
    .getByRole("button", { name: "Approve", exact: true })
    .click();
  await settle();
  await tab("Manual Review");
  await page.getByRole("button", { name: "Approved", exact: true }).click();
  await settle();
  current = await state();
  for (const a of current.actions)
    await act({
      action: "save",
      entity: "action",
      id: a.id,
      approve: true,
      values: { ...a, finding_ids: [finding.id], review_status: "approved" },
    });
  const reversed = [...current.sections]
    .sort((a, b) => b.sort_order - a.sort_order)
    .map((s) => s.id);
  await act({ action: "reorder", ids: reversed });
  current = await state();
  expect(
    [...current.sections].sort((a, b) => a.sort_order - b.sort_order).map((s) => s.id),
  ).toEqual(reversed);
  for (const section of current.sections.filter((s) => s.enabled))
    await act({
      action: "save",
      entity: "section",
      id: section.id,
      approve: true,
      values: { ...section, review_status: "approved" },
    });
  await act({ action: "approve" });
  await reopen();
  await tab("Client Site");
  await page.getByLabel("Version change notes").fill("First reviewed version");
  await page.getByRole("button", { name: "Generate Client Site", exact: true }).click();
  await expect(page.getByLabel("Audit version")).not.toHaveValue("");
  await page.getByRole("button", { name: "Preview client site", exact: true }).click();
  await expect(page.getByRole("heading", { name: "HQ360 recommendations" })).toBeVisible();
  await page.getByRole("button", { name: "Final QA complete", exact: true }).click();
  await settle();
  const publishedResponse = page.waitForResponse(
    (r) =>
      r.url().endsWith("/workflow") &&
      r.request().method() === "POST" &&
      r.request().postDataJSON().action === "publish",
  );
  await page.getByRole("button", { name: "Publish version", exact: true }).click();
  const published = await (await publishedResponse).json();
  expect(published.code).toBeTruthy();
  const client = await browser.newContext({ extraHTTPHeaders: { Origin: base } });
  try {
    let r = await client.request.post(`${base}/api/private-audit`, {
      data: { action: "login", code: "WRONG-CODE" },
    });
    expect(r.status()).toBe(401);
    r = await client.request.post(`${base}/api/private-audit`, {
      data: { action: "login", code: published.code },
    });
    expect(r.status()).toBe(200);
    const sessionHeader = r.headers()["set-cookie"];
    await client.addCookies([
      {
        name: "hq360_audit",
        value: sessionHeader.split(";")[0].split("=")[1],
        url: base,
        httpOnly: true,
      },
    ]);
    const slug = published.path.replace("/author-audit/", "");
    r = await client.request.get(`${base}/api/private-audit?slug=${slug}`);
    expect(r.status()).toBe(200);
    const delivered = await r.json();
    const serialized = JSON.stringify(delivered);
    expect(serialized).not.toContain("INTERNAL NOTE");
    expect(serialized).not.toContain("reviewer_notes");
    expect(serialized).not.toContain("storage_path");
    expect(serialized).not.toContain("research_import");
    expect(delivered.report.findings).toHaveLength(2);
    expect(delivered.report.assets).toHaveLength(1);
    const image = await client.request.get(
      `${base}/api/private-audit?asset=${delivered.report.assets[0].id}`,
    );
    expect(image.status()).toBe(200);
    const clientPage = await client.newPage();
    await clientPage.goto(base + published.path);
    await expect(
      clientPage.getByRole("heading", { name: "Fixture Book", exact: true }),
    ).toBeVisible();
    await clientPage.setViewportSize({ width: 390, height: 844 });
    expect(
      await clientPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBeTruthy();
    await act({
      action: "save",
      entity: "finding",
      id: finding.id,
      values: {
        ...finding,
        what_we_found: "EDITED DRAFT ONLY",
        review_status: "needs_verification",
      },
    });
    r = await client.request.get(`${base}/api/private-audit?slug=${slug}`);
    expect(JSON.stringify(await r.json())).not.toContain("EDITED DRAFT ONLY");
    const rotated = await act({ action: "regenerate" });
    r = await client.request.get(`${base}/api/private-audit?slug=${slug}`);
    expect(r.status()).toBe(401);
    r = await client.request.post(`${base}/api/private-audit`, {
      data: { action: "login", code: published.code },
    });
    expect(r.status()).toBe(401);
    r = await client.request.post(`${base}/api/private-audit`, {
      data: { action: "login", code: rotated.code },
    });
    expect(r.status()).toBe(200);
    await act({ action: "disable" });
    r = await client.request.post(`${base}/api/private-audit`, {
      data: { action: "login", code: rotated.code },
    });
    expect(r.status()).toBe(401);
  } finally {
    await client.close();
  }
  expect(errors).toEqual([]);
  console.log(
    "PASS: real audit creation, prompt, validation/import, finding edits/rejection/manual finding, screenshots, Listopia, section order, approvals, private preview/publish, code access/rotation, immutable published revision, mobile layout.",
  );
} catch (e) {
  console.error((await page.locator("body").innerText()).slice(-5000));
  throw e;
} finally {
  if (id) {
    const files = await supabaseAdmin.storage.from("audit-research-evidence").list(id);
    if (files.data?.length)
      await supabaseAdmin.storage
        .from("audit-research-evidence")
        .remove(files.data.map((f) => `${id}/${f.name}`));
    const removed = await supabaseAdmin.from("author_audits").delete().eq("id", id);
    if (removed.error) console.error("Test audit cleanup failed:", removed.error.code);
  }
  if (bookId) await supabaseAdmin.from("books").delete().eq("id", bookId);
  if (authorId) await supabaseAdmin.from("authors").delete().eq("id", authorId);
  await browser.close();
}
