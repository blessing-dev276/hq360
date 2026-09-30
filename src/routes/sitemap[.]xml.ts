import { createFileRoute } from "@tanstack/react-router";
import { renderSitemap } from "@/lib/sitemap";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { readPublishedCaseStudies } = await import("@/lib/case-studies.server");
          const studies = await readPublishedCaseStudies();
          return new Response(
            renderSitemap(
              studies
                .filter(
                  (study) =>
                    study.status === "verified" &&
                    !/illustrative/i.test(`${study.client} ${study.outcome}`),
                )
                .map((study) => `/work/${study.slug}`),
            ),
            {
              headers: {
                "content-type": "application/xml; charset=utf-8",
                "cache-control": "public, max-age=0, s-maxage=300, stale-while-revalidate=3600",
              },
            },
          );
        } catch {
          // Do not publish an incomplete sitemap during a temporary database outage.
          return new Response("Sitemap temporarily unavailable", {
            status: 503,
            headers: { "cache-control": "no-store", "retry-after": "300" },
          });
        }
      },
    },
  },
});
