import { createFileRoute } from "@tanstack/react-router";

// GET /api/academy/progress?tz=<getTimezoneOffset()>  -> ladder, rank, streak,
// today's missions, certificate and unread trainer feedback.
export const Route = createFileRoute("/api/academy/progress")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const a = await import("@/lib/academy/academy.server");
        const viewer = await a.getViewer(request);
        if (!viewer) return a.json({ ok: false, error: "unauthorized" }, 401);
        const tz = Number(new URL(request.url).searchParams.get("tz") ?? 0);
        const offset = Number.isFinite(tz) ? Math.max(-840, Math.min(840, Math.round(tz))) : 0;
        const [progress, { count }] = await Promise.all([
          a.progressFor(viewer, offset),
          a.db
            .from("sessions")
            .select("id", { count: "exact", head: true })
            .eq("user_id", viewer.id)
            .eq("feedback_unread", true),
        ]);
        return a.json({ ok: true, progress, unreadFeedback: count ?? 0, name: viewer.name });
      },
    },
  },
});
