import { createFileRoute } from "@tanstack/react-router";

/** Client tracking page data: locked state, or the published page once unlocked. */
export const Route = createFileRoute("/api/track/$slug")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { trackerPage, json } = await import("@/lib/trackers/access.server");
        try {
          return await trackerPage(request, params.slug);
        } catch {
          return json({ error: "This page is not available right now." }, 503);
        }
      },
    },
  },
});
