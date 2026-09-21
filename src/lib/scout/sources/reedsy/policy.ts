/** Inspected public HTML and robots on 2026-09-21; no crawl permitted by terms for this use. */
export const reedsyPolicy = {
  slug: "reedsy_discovery",
  accessStatus: "manual_only",
  homepage: "https://reedsy.com/discovery",
  robots: "https://reedsy.com/robots.txt",
  terms: "https://reedsy.com/about/tou",
  checkedAt: "2026-09-21",
  reason: "Permission required for scraping Reedsy content for this scouting use.",
  // Never interpret the absence of a public API, or a JS-rendered listing, as a prohibition.
  // Here the controlling restriction is the published terms, despite permissive robots.
} as const;
