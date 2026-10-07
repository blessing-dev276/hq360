import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/academy/demos/$id")({
  server: {
    handlers: {
      DELETE: async ({ request, params }) => {
        const a = await import("@/lib/academy/academy.server");
        const viewer = await a.getViewer(request);
        if (!viewer) return a.json({ ok: false, error: "unauthorized" }, 401);
        if (viewer.role !== "trainer") return a.json({ ok: false, error: "forbidden" }, 403);
        const { error } = await a.db.from("demos").delete().eq("id", params.id);
        if (error) return a.json({ ok: false, error: "storage" }, 500);
        return a.json({ ok: true });
      },
    },
  },
});
