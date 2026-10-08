// Browser regression with intercepted APIs: no real records, emails or paid research.
import { chromium, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
const snapshot = JSON.parse(
  await readFile(new URL("../tests/fixtures/ruth-foster-audit.json", import.meta.url), "utf8"),
);
const model = JSON.parse(
  execFileSync(
    "bun",
    [
      "-e",
      'import r from "./tests/fixtures/ruth-foster-audit.json"; import {buildCommercialPlan,proposalDraft} from "./src/lib/author-audit/commercial"; import {DEFAULT_COMMERCIAL_CONFIG} from "./src/lib/author-audit/services"; const plan=buildCommercialPlan(r.findings); console.log(JSON.stringify({plan,config:DEFAULT_COMMERCIAL_CONFIG,draft:proposalDraft(plan,r.author.name,r.book.title)}));',
    ],
    { encoding: "utf8" },
  ),
);
const base = process.env.BASE_URL || "http://127.0.0.1:8091";
const id = "00000000-0000-4000-8000-000000000001";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
let inquiries = [],
  proposal = null,
  inquiryFailure = false;
await context.addInitScript(() => {
  localStorage.setItem("hq360-cookie-consent", "declined");
  sessionStorage.setItem("hq360-popup-shown", "1");
});
await context.route("**/api/**", async (route) => {
  const path = new URL(route.request().url()).pathname;
  const body = route.request().method() === "POST" ? route.request().postDataJSON() : null;
  if (path === "/api/private-audit/commerce") {
    if (body) {
      if (inquiryFailure)
        return route.fulfill({
          status: 503,
          json: { error: "Could not save your inquiry. Please retry." },
        });
      inquiries.push(body);
      return route.fulfill({ status: 201, json: { ok: true, id: "test-inquiry" } });
    }
    return route.fulfill({
      json: { plan: model.plan, proposal: proposal?.status === "shared" ? proposal.draft : null },
    });
  }
  if (path === "/api/private-audit")
    return route.fulfill({
      json: body
        ? { ok: true }
        : { report: { ...snapshot, ctaEnabled: true }, versionId: id, interests: [] },
    });
  if (path === "/api/admin/session")
    return route.fulfill({ json: { authed: true, configured: true } });
  if (path === "/api/admin/author-audits")
    return route.fulfill({
      json: {
        ok: true,
        items: [
          {
            id,
            status: "approved",
            created_at: "2026-10-08",
            authors: snapshot.author,
            books: snapshot.book,
          },
        ],
      },
    });
  if (path.endsWith("/workflow"))
    return route.fulfill({
      json: {
        audit: {
          id,
          workflow_version: 1,
          status: "approved",
          input_snapshot: {},
          authors: snapshot.author,
          books: snapshot.book,
        },
        findings: snapshot.findings.map((f) => ({
          ...f,
          hidden: false,
          review_status: "approved",
          manual_status: "verified",
          evidence_text: f.evidence,
        })),
        sections: snapshot.sections.map((s) => ({
          ...s,
          enabled: true,
          review_status: "approved",
        })),
        actions: [],
        assets: [],
        tasks: [],
        listopia: [],
        imports: [],
        sources: [],
        history: [],
        versions: [],
        assignments: [],
        experts: [],
        permissions: { admin: true, review: true },
        access: null,
        template: "",
        issues: [],
      },
    });
  if (path.endsWith("/commercial")) {
    if (body) {
      if (body.action === "generate")
        proposal = { draft: model.draft, status: "draft", revision: 1 };
      if (body.action === "save")
        proposal = { draft: body.draft, status: "draft", revision: (proposal?.revision ?? 0) + 1 };
      if (body.action === "approve")
        proposal = { ...proposal, status: "approved", revision: proposal.revision + 1 };
      if (body.action === "share")
        proposal = { ...proposal, status: "shared", revision: proposal.revision + 1 };
      return route.fulfill({ json: { ok: true } });
    }
    return route.fulfill({
      json: {
        config: model.config,
        configRevision: "default",
        plan: model.plan,
        proposal,
        auditRevision: 1,
        findings: snapshot.findings,
      },
    });
  }
  return route.fulfill({ json: { ok: true, items: [], members: [], invoices: [], events: [] } });
});
async function nav(name, mobile = false) {
  if (mobile) await page.getByRole("button", { name: "Pages", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Audit pages" })
    .filter({ visible: true })
    .getByRole("button", { name, exact: true })
    .click();
}
async function noOverflow() {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true);
}
try {
  await page.goto(`${base}/author-audit/ruth-foster/a-perfect-year`);
  await expect(page.getByRole("heading", { name: "A Perfect Year?", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Strengths to build on" })).toBeVisible();
  await nav("HQ360 Opportunities");
  await expect(
    page.getByRole("heading", { name: "Podcast and Press Placement", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Amazon Keyword and Category Optimization" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Discuss Podcast and Press Placement with HQ360", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Email", { exact: true }).fill("reader@example.com");
  await dialog
    .getByLabel("What would you like to discuss?")
    .fill("Discuss the prize-led media opportunity.");
  await dialog.getByRole("checkbox").check();
  inquiryFailure = true;
  await dialog.getByRole("button", { name: "Send inquiry", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("Could not save");
  expect(inquiries).toHaveLength(0);
  inquiryFailure = false;
  await dialog.getByRole("button", { name: "Send inquiry", exact: true }).click();
  await expect(dialog.getByRole("status")).toContainText("saved");
  expect(inquiries).toHaveLength(1);
  expect(inquiries[0].serviceId).toBe("podcast-press");
  expect(inquiries[0].findingIds.length).toBeGreaterThan(0);
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .getByRole("button", { name: /View finding: Verified 2025/ })
    .first()
    .click();
  await expect(
    page
      .locator("details[open]")
      .filter({ hasText: "Verified 2025 Comedy" })
      .getByText("Supporting evidence", { exact: true }),
  ).toBeVisible();
  await noOverflow();
  await page.screenshot({ path: "/tmp/hq360-commercial-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await nav("Action plan", true);
  await expect(
    page.getByRole("heading", { name: "Foundation and preparation", exact: true }),
  ).toBeVisible();
  await noOverflow();
  await nav("HQ360 Opportunities", true);
  await noOverflow();
  await page.screenshot({ path: "/tmp/hq360-commercial-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${base}/admin#audits`);
  await page.getByRole("button", { name: /A Perfect Year\? — Ruth Foster/ }).click();
  await page.getByRole("button", { name: /2\. Review/ }).click();
  await page
    .getByRole("navigation", { name: "Review content" })
    .getByRole("button", { name: "HQ360 opportunities", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "HQ360 opportunities & proposals" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Generate HQ360 Proposal", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Share approved proposal in private audit", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Approve proposal", exact: true }).click();
  await page
    .getByRole("button", { name: "Share approved proposal in private audit", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("shared");
  await page.getByLabel("Scope of work", { exact: true }).fill("Updated approved work scope");
  await expect(page.getByRole("button", { name: "Approve proposal", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Save proposal draft", exact: true }).click();
  expect(proposal.status).toBe("draft");
  await noOverflow();
  expect(errors).toEqual([]);
  console.log(
    "PASS: desktop/mobile reports, evidence navigation, failed/successful inquiry, admin proposal approval and editing.",
  );
} finally {
  await browser.close();
}
