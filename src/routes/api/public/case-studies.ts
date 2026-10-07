import { createFileRoute } from "@tanstack/react-router";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control":
        status === 200 ? "public, max-age=0, s-maxage=10, stale-while-revalidate=59" : "no-store",
    },
  });
}

/**
 * Public read of published case studies. Optional `?slug=` returns a single
 * study (still inside `items`). Uncached failures let the UI fall back to the
 * bundled roster and offer a retry.
 */
export const Route = createFileRoute("/api/public/case-studies")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const slug = new URL(request.url).searchParams.get("slug") ?? "";
        try {
          const { readPublishedCaseStudies } = await import("@/lib/case-studies.server");
          return json({ ok: true, items: await readPublishedCaseStudies(slug || undefined) });
        } catch {
          return json({ ok: false }, 503);
        }
      },
    },
  },
});
