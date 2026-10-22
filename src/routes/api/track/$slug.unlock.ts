import { createFileRoute } from "@tanstack/react-router";

/** Passcode check. Five wrong tries lock the page for that visitor for 15 minutes. */
export const Route = createFileRoute("/api/track/$slug/unlock")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const { unlockTracker, json } = await import("@/lib/trackers/access.server");
        try {
          return await unlockTracker(request, params.slug);
        } catch {
          return json({ error: "Could not check the passcode. Please try again." }, 503);
        }
      },
    },
  },
});
