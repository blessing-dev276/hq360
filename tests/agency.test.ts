import { expect, test } from "bun:test";
import {
  buildAgencyProof,
  filterAgencyProof,
  selectAgencyProof,
  type PortfolioProof,
} from "../src/lib/agency-work";
import {
  contextForPath,
  inquiryHref,
  inquirySourcePath,
  readInquiryContext,
} from "../src/lib/inquiry-context";
import { STATIC_SITEMAP_PATHS } from "../src/lib/sitemap";
import { CASE_STUDIES } from "../src/data/work";
import { AUDIENCES, CORE_SERVICES } from "../src/data/agency";
const item = (
  title: string,
  capability_slug: string,
  industry_slug = "authors",
): PortfolioProof => ({
  id: title,
  title,
  capability_slug,
  industry_slug,
  description: null,
  media_type: "image",
  media_url: `https://example.com/${encodeURIComponent(title)}.png`,
  thumbnail_url: null,
  external_link: null,
});
test("inquiry links preserve valid origins and reject external or unknown context", () => {
  const context = {
    audience: "cleaning-businesses",
    service: "automation-crm",
    from: "/cleaning-businesses",
  };
  expect(
    readInquiryContext(
      Object.fromEntries(new URL(inquiryHref(context), "https://example.com").searchParams),
    ),
  ).toEqual(context);
  expect(
    readInquiryContext({ audience: "invented", service: "invented", from: "//external.test" }),
  ).toEqual({});
  expect(readInquiryContext({ from: "/contact?injected=value" })).toEqual({});
  expect(inquirySourcePath(context.from, context.service)).toBe(
    "/cleaning-businesses?service=automation-crm",
  );
  expect(contextForPath("/services/book-writing-editing").audience).toBe("authors");
});
test("proof excludes illustrative projects despite incorrect published status", () => {
  const misleading = CASE_STUDIES.filter((item) => item.status === "sample").map((item) => ({
    ...item,
    status: "verified" as const,
  }));
  expect(buildAgencyProof([], misleading)).toEqual([]);
});
test("work classification and deduplication do not manufacture CRM or translation proof", () => {
  const items = buildAgencyProof(
    [
      item("Goodreads Listopia — Author", "crm-automation"),
      item("Goodreads Listopia Author", "crm-automation"),
      item("Book interior formatting & layout", "writing-translation"),
      item("Creator website", "websites-funnels", "creators"),
    ],
    [],
  );
  expect(items).toHaveLength(3);
  expect(filterAgencyProof(items, "automation-crm")).toHaveLength(0);
  expect(filterAgencyProof(items, "translation-localization")).toHaveLength(0);
  expect(filterAgencyProof(items, "website-development", "ugc-creators")).toHaveLength(1);
  expect(selectAgencyProof(items, 4)).toHaveLength(3);
});
test("sitemap contains canonical services and audiences but no replaced URLs", () => {
  for (const service of CORE_SERVICES)
    expect(STATIC_SITEMAP_PATHS).toContain(`/services/${service.slug}`);
  for (const audience of AUDIENCES) expect(STATIC_SITEMAP_PATHS).toContain(`/${audience.slug}`);
  for (const retired of [
    "/creators",
    "/local-business",
    "/services/websites-funnels",
    "/services/crm-automation",
    "/services/writing-translation",
  ])
    expect(STATIC_SITEMAP_PATHS).not.toContain(retired);
});
