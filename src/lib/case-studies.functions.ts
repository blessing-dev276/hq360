import { createServerFn } from "@tanstack/react-start";
import { optionalSlug } from "@/lib/slug-input";
import { CASE_STUDIES, type CaseStudy } from "@/data/work";
import { toCaseStudyShape } from "@/lib/case-study-view";

export const loadCaseStudies = createServerFn({ method: "GET" })
  .inputValidator(optionalSlug(160))
  .handler(async ({ data }) => {
    const { readPublishedCaseStudies } = await import("./case-studies.server");
    try {
      const rows = await readPublishedCaseStudies(data.slug);
      // A successful empty query means unpublished or missing, not a DB outage.
      return { available: true, studies: rows.map((row) => toCaseStudyShape(row) as CaseStudy) };
    } catch {
      return {
        available: false,
        studies: CASE_STUDIES.filter((study) => !data.slug || study.slug === data.slug),
      };
    }
  });
