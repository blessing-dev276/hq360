// Local preview only. All public submissions and analytics traffic are intercepted.
import { chromium, expect } from "@playwright/test";
const base = process.env.BASE_URL || "http://localhost:8083";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname))
  throw new Error("Use a local preview");
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
});
await context.addInitScript(() => {
  localStorage.setItem("hq360-cookie-consent", "declined");
  sessionStorage.setItem("hq360-popup-shown", "1");
});
await context.route(/google-analytics|googletagmanager/, (route) => route.abort());
const submissions = [];
let fail = false;
await context.route("**/api/public/**", (route) => {
  const url = route.request().url();
  if (route.request().method() !== "GET") {
    submissions.push(route.request().postDataJSON());
    return route.fulfill({
      status: fail ? 500 : 200,
      json: { ok: !fail, emailed: true, id: "fixture" },
    });
  }
  return route.fulfill({
    json: url.includes("/team")
      ? { members: [] }
      : url.includes("/portfolio")
        ? {
            items: [
              {
                id: "fixture-creator",
                title: "Fixture creator website",
                description: "Website design and build.",
                media_type: "image",
                media_url: "/favicon.ico",
                thumbnail_url: null,
                capability_slug: "websites-funnels",
                industry_slug: "creators",
                external_link: null,
              },
            ],
          }
        : { items: [] },
  });
});
const page = await context.newPage();
// Wait for hydration before interacting with server-rendered controls.
const goto = async (url) => {
  await page.goto(url, { waitUntil: "load" });
  // SSR content is visible before React attaches event handlers.
  await page.waitForFunction(() =>
    Object.keys(document.querySelector("main") ?? {}).some((key) =>
      key.startsWith("__reactProps$"),
    ),
  );
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
};
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const services = [
  "website-development",
  "mobile-app-development",
  "automation-crm",
  "writing-editing",
  "translation-localization",
];
const audiences = [
  "authors",
  "ugc-creators",
  "agencies",
  "cleaning-businesses",
  "appointment-based-businesses",
  "local-businesses",
];
try {
  await goto(base);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Your next website");
  const nav = page.getByRole("navigation", { name: "Primary", exact: true });
  const servicesButton = nav.getByRole("button", { name: "Services", exact: true });
  await servicesButton.focus();
  await page.keyboard.press("ArrowDown");
  await expect(nav.getByRole("link", { name: "Explore services", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(servicesButton).toBeFocused();
  await nav.getByRole("button", { name: "Who We Help", exact: true }).click();
  await expect(nav.getByRole("link", { name: "Cleaning Businesses", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  expect(submissions).toHaveLength(0);
  await page.screenshot({ path: "/tmp/hq360-agency-desktop.png" });
  for (const slug of services) {
    await goto(`${base}/services/${slug}`);
    await expect(
      page.getByRole("heading", { name: "What determines scope and price" }),
    ).toBeVisible();
    await expect(page.locator("#project-inquiry input[type=checkbox]:checked")).toHaveCount(1);
  }
  for (const slug of audiences) {
    await goto(`${base}/${slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    if (slug !== "authors")
      await expect(page.locator("#project-inquiry select[name=industry]")).not.toHaveValue("");
  }
  await goto(`${base}/authors`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Bring your book to life");
  await expect(page.locator('a[href="/tools/author-visibility-audit"]').first()).toBeVisible();
  await goto(`${base}/ugc-creators`);
  await page.locator("footer").getByRole("link", { name: "Start a Project", exact: true }).click();
  await expect(page.locator("select[name=industry]")).toHaveValue("UGC Creators");
  // Audience -> service -> header inquiry must retain origin, while allowing edits.
  await goto(`${base}/cleaning-businesses`);
  await page
    .locator("main")
    .getByRole("link", { name: "Website Development →", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/audience=cleaning-businesses/);
  await page.locator(".hq-header-cta").click();
  await expect(page).toHaveURL(/\/contact\?/);
  await expect(
    page.getByRole("checkbox", { name: "Website Development", exact: true }),
  ).toBeChecked();
  await expect(page.locator("select[name=industry]")).toHaveValue("Cleaning Businesses");
  const form = page
    .locator("form")
    .filter({ has: page.getByRole("button", { name: "Send enquiry" }) });
  await page.evaluate(() => {
    localStorage.setItem("hq360-cookie-consent", "accepted");
    window.__events = [];
    window.gtag = (...args) => window.__events.push(args);
  });
  await form.getByRole("button", { name: "Send enquiry" }).click();
  expect(submissions).toHaveLength(0);
  await expect(form.getByRole("alert")).toHaveCount(2);
  await form.locator("[name=name]").fill("Test Business");
  await form.locator("[name=email]").fill("business@example.com");
  await form.locator("[name=industry]").selectOption("Agencies");
  await form.getByRole("checkbox", { name: "Automation & CRM", exact: true }).check();
  fail = true;
  await form.getByRole("button", { name: "Send enquiry" }).click();
  await expect(form.getByRole("alert")).toContainText("could not send");
  expect(await page.evaluate(() => window.__events)).toEqual([]);
  fail = false;
  await form.getByRole("button", { name: "Send enquiry" }).click();
  await expect(page.getByRole("heading", { name: "Thanks — that's in." })).toBeVisible();
  const submission = submissions.at(-1);
  expect(submission.industry).toBe("Agencies");
  expect(submission.helpWith).toEqual(["Website Development", "Automation & CRM"]);
  expect(submission.sourceIndustry).toBe("cleaning-businesses");
  expect(submission.sourcePath).toBe("/cleaning-businesses?service=website-development");
  expect(
    await page.evaluate(
      () => window.__events.filter((e) => e[1] === "project_inquiry_submitted").length,
    ),
  ).toBe(1);
  await goto(`${base}/work`);
  await expect(page.getByRole("heading", { name: "Fixture creator website" })).toBeVisible();
  await page.getByLabel("Service", { exact: true }).selectOption("mobile-app-development");
  await expect(
    page.getByText("No published examples match this selection yet.", { exact: false }),
  ).toBeVisible();
  for (const [old, target] of [
    ["creators", "ugc-creators"],
    ["team", "about#team"],
    ["local-business", "local-businesses"],
    ["services/websites-funnels", "services/website-development"],
    ["services/crm-automation", "services/automation-crm"],
    ["services/writing-translation", "services/writing-editing"],
    ["capabilities/websites-funnels", "services/website-development"],
  ]) {
    const response = await page.request.get(`${base}/${old}`, { maxRedirects: 0 });
    expect(response.status()).toBe(301);
    expect(response.headers().location).toContain(`/${target}`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await goto(base);
  await page.getByRole("button", { name: "Open menu" }).click();
  const mobile = page.getByRole("navigation", { name: "Mobile navigation" });
  await mobile.getByText("Who We Help", { exact: true }).click();
  await mobile.getByRole("link", { name: "Cleaning Businesses", exact: true }).click();
  await expect(page).toHaveURL(/\/cleaning-businesses$/);
  await expect(page.getByRole("dialog", { name: "Site navigation" })).not.toBeVisible();
  for (const path of [
    "/",
    "/contact?audience=authors&service=book-writing-editing",
    "/work",
    "/services/translation-localization",
    "/cleaning-businesses",
  ]) {
    await goto(`${base}${path}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await goto(base);
  await page.screenshot({ path: "/tmp/hq360-agency-mobile.png", fullPage: true });
  expect(errors).toEqual([]);
  console.log(
    "PASS: agency routes, keyboard/mobile navigation, context across pages, multiple services, validation/failure/success conversion, filters, empty states, redirects and mobile overflow.",
  );
} finally {
  await browser.close();
}
