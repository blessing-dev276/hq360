import { expect, test } from "bun:test";
import { INDUSTRIES } from "../src/data/industries";
import { INDUSTRY_HEADS } from "../src/data/industry-heads";

test("industry heads match the industry data (run scripts/generate-industry-heads.ts)", () => {
  for (const i of INDUSTRIES) {
    expect(INDUSTRY_HEADS[i.slug]).toEqual({
      slug: i.slug,
      path: i.path,
      name: i.name,
      shortName: i.shortName,
      seo: i.seo,
      faqs: i.faqs,
    });
  }
  expect(Object.keys(INDUSTRY_HEADS).length).toBe(INDUSTRIES.length);
});
