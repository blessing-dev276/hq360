// Uses fixture API responses only. Run against a local production preview.
import { chromium, expect } from "@playwright/test";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const profile = {
  email: "expert@example.com",
  slug: "test-expert",
  full_name: "Test Expert",
  headline: "Brand strategist",
  bio: "I help independent businesses grow.",
  location: "Lagos, Nigeria",
  specialties: ["Branding", "Strategy"],
  photo_url: null,
  website_url: "https://example.com",
  linkedin_url: "",
  is_public: false,
  profile_status: "draft",
  profile_review_note: null,
};
const user = {
  id: "00000000-0000-4000-8000-000000000001",
  email: profile.email,
  aud: "authenticated",
  role: "authenticated",
  app_metadata: {},
  user_metadata: {},
  created_at: new Date().toISOString(),
};
const token = [
  Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url"),
  Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 })).toString(
    "base64url",
  ),
  "fixture",
].join(".");
await page.route("**/auth/v1/**", (route) =>
  route.fulfill({
    json: {
      access_token: token,
      refresh_token: "fixture",
      expires_in: 3600,
      token_type: "bearer",
      user,
    },
  }),
);
await page.route("**/api/expert/session", (route) => route.fulfill({ json: { ok: true } }));
await page.route("**/api/expert/profile", async (route) => {
  if (route.request().method() === "PUT") Object.assign(profile, route.request().postDataJSON());
  await new Promise((resolve) => setTimeout(resolve, 300));
  return route.fulfill({ json: { profile } });
});
await page.route("**/api/expert/profile-submit", (route) => {
  profile.profile_status = "submitted";
  return route.fulfill({ json: { profile } });
});
await page.route("**/api/expert/portfolio", (route) => route.fulfill({ json: { items: [] } }));
try {
  await page.goto(`${process.env.SCOUT_TEST_URL || "http://localhost:8081"}/expert`);
  await page.getByLabel("Email", { exact: true }).fill(profile.email);
  await page.getByLabel("Password", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Loading your expert profile…")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Make your expertise stand out." })).toBeVisible();
  await page.getByLabel("Headline", { exact: true }).fill("Expert brand designer");
  await expect(page.getByRole("button", { name: "Submit for review" })).toBeDisabled();
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Profile saved.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit for review" })).toBeEnabled();
  expect(profile.headline).toBe("Expert brand designer");
  await page.screenshot({ path: "/tmp/hq360-profile-desktop.png", fullPage: true });
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.getByRole("button", { name: "Submitted", exact: true })).toBeDisabled();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "/tmp/hq360-profile-mobile.png", fullPage: true });
  expect(errors).toEqual([]);
  console.log(
    "PASS: expert login, glass loading, profile editing, unsaved-change guard, save, review submission and mobile layout.",
  );
} finally {
  await browser.close();
}
