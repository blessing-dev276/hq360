import { createFileRoute } from "@tanstack/react-router";

/** Files on an unlocked page, handed out as short lived signed links. */
export const Route = createFileRoute("/api/track/$slug/file/$fileId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { trackerFile, json } = await import("@/lib/trackers/access.server");
        try {
          return await trackerFile(request, params.slug, params.fileId);
        } catch {
          return json({ error: "This file is not available right now." }, 503);
        }
      },
    },
  },
});
