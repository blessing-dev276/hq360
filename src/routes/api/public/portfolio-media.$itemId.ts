import { createFileRoute } from "@tanstack/react-router";

/** Image or video for an auto portfolio entry. Consent is re-checked on every
 *  request, so withdrawing it stops the media at once (no public copies exist). */
export const Route = createFileRoute("/api/public/portfolio-media/$itemId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!/^[0-9a-f-]{36}$/.test(params.itemId)) return new Response(null, { status: 404 });
        try {
          const { portfolioMediaUrl } = await import("@/lib/trackers/portfolio.server");
          const url = await portfolioMediaUrl(params.itemId);
          if (!url) return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
          return new Response(null, {
            status: 302,
            headers: { Location: url, "Cache-Control": "private, max-age=300" },
          });
        } catch {
          return new Response(null, { status: 503 });
        }
      },
    },
  },
});
