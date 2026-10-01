// All credential and workspace requests use fixtures. No real sign-ins or emails.
import { chromium, expect } from "@playwright/test";
const base = process.env.AUTH_TEST_URL || "http://localhost:8105";
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 960 },
  reducedMotion: "reduce",
});
await context.addInitScript(() => {
  localStorage.setItem("hq360-cookie-consent", "declined");
  sessionStorage.setItem("hq360-popup-shown", "1");
});
let adminSuccess = false;
let expertState = "invalid";
let adminPosts = 0;
const user = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "fixture@example.com",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: {},
  user_metadata: {},
  created_at: new Date().toISOString(),
};
const token = [
  Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"),
  Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 })).toString(
    "base64url",
  ),
  "fixture",
].join(".");
await context.route("**/auth/v1/**", (route) => {
  if (route.request().url().includes("/token"))
    return route.fulfill(
      expertState === "invalid"
        ? {
            status: 400,
            json: { error: "invalid_grant", error_description: "Invalid login credentials" },
          }
        : {
            json: {
              access_token: token,
              token_type: "bearer",
              expires_in: 3600,
              refresh_token: "fixture",
              user,
            },
          },
    );
  return route.fulfill({ json: {} });
});
await context.route("**/api/admin/**", (route) => {
  if (route.request().url().endsWith("/session")) {
    if (route.request().method() === "POST") {
      adminPosts++;
      return route.fulfill({ status: adminSuccess ? 200 : 401, json: { authed: adminSuccess } });
    }
    return route.fulfill({ json: { authed: false, configured: true } });
  }
  return route.fulfill({
    json: { ok: true, items: [], invoices: [], events: [], audits: [], experts: [] },
  });
});
await context.route("**/api/expert/**", (route) => {
  if (route.request().url().endsWith("/session"))
    return route.fulfill(
      expertState === "approved"
        ? { json: { ok: true } }
        : { status: 403, json: { status: expertState } },
    );
  return route.fulfill({
    json: { profile: { ...user, full_name: "Test expert", specialties: [], status: "approved" } },
  });
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
async function ready(path) {
  await page.goto(base + path);
  await page.waitForFunction(() =>
    Object.keys(document.querySelector("main") ?? {}).some((key) =>
      key.startsWith("__reactProps$"),
    ),
  );
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}
async function noOverflow() {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}
try {
  await ready("/admin");
  await expect(page.getByLabel("Username", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  expect(adminPosts).toBe(0);
  await page.getByLabel("Username", { exact: true }).fill("fixture");
  await page.getByLabel("Password", { exact: true }).fill("fixture");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator(".hq-auth [role=alert]")).toContainText("incorrect");
  await page.screenshot({ path: "/tmp/hq-admin-desktop.png", fullPage: true });
  await noOverflow();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "/tmp/hq-admin-mobile.png", fullPage: true });
  await noOverflow();
  adminSuccess = true;
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator(".hq-auth")).toHaveCount(0);
  await ready("/expert");
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  await page.screenshot({ path: "/tmp/hq-expert-mobile.png", fullPage: true });
  await noOverflow();
  await page.getByLabel("Email", { exact: true }).fill("fixture@example.com");
  await page.getByLabel("Password", { exact: true }).fill("fixture");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator(".hq-auth [role=alert]")).toContainText("incorrect");
  for (const state of ["pending", "rejected", "approved"]) {
    expertState = state;
    await ready("/expert");
    await page.getByLabel("Email", { exact: true }).fill("fixture@example.com");
    await page.getByLabel("Password", { exact: true }).fill("fixture");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    if (state === "pending")
      await expect(page.locator(".hq-auth-notice")).toContainText("waiting on admin approval");
    if (state === "rejected")
      await expect(page.locator(".hq-auth-notice")).toContainText("not approved");
    if (state === "approved")
      await expect(page.getByRole("navigation", { name: "Expert navigation" })).toBeVisible();
  }
  await page.setViewportSize({ width: 1440, height: 960 });
  await ready("/");
  await expect(page.locator(".hqd-hero-team img")).toHaveCount(5);
  await page.locator(".hqd-hero-team img").evaluateAll(async (imgs) => {
    await Promise.all(imgs.map((img) => img.decode()));
  });
  const alphas = await page.locator(".hqd-hero-team img").evaluateAll((imgs) =>
    imgs.map((img) => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      return { alpha: ctx.getImageData(0, 0, 1, 1).data[3], filter: getComputedStyle(img).filter };
    }),
  );
  expect(alphas.every((x) => x.alpha === 0 && x.filter === "brightness(0.58) contrast(1.12)")).toBe(
    true,
  );
  await page.screenshot({ path: "/tmp/hq-hero-desktop.png" });
  await noOverflow();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "/tmp/hq-hero-mobile.png" });
  await noOverflow();
  expect(errors).toEqual([]);
  console.log(
    "PASS: admin validation/failure/success; expert failure/pending/rejected/approved; desktop/mobile layout; five transparent hero assets; no browser errors.",
  );
} finally {
  await browser.close();
}
