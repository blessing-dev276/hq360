import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/academy/me")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { getViewer, json } = await import("@/lib/academy/academy.server");
        const viewer = await getViewer(request);
        if (!viewer) return json({ ok: false, error: "unauthorized" }, 401);
        return json({ ok: true, viewer });
      },
    },
  },
});
