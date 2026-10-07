import { createFileRoute } from "@tanstack/react-router";

// GET /api/academy/sessions          -> the viewer's own chats
// GET /api/academy/sessions?id=...   -> one chat (own, or any for the trainer)
// GET /api/academy/sessions?user=... -> a trainee's chats (trainer only)
export const Route = createFileRoute("/api/academy/sessions")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const a = await import("@/lib/academy/academy.server");
        const url = new URL(request.url);
        const id = url.searchParams.get("id");
        const user = url.searchParams.get("user");

        if (user) {
          if (!(await a.isTrainerRequest(request)))
            return a.json({ ok: false, error: "forbidden" }, 403);
          const { data } = await a.db
            .from("sessions")
            .select("*")
            .eq("user_id", user)
            .order("created_at", { ascending: false });
          return a.json({
            ok: true,
            sessions: (data ?? []).map((r) => a.clientSession(r as never)),
          });
        }

        const viewer = await a.getViewer(request);
        if (!viewer) return a.json({ ok: false, error: "unauthorized" }, 401);
        if (id) {
          const row = await a.loadOwnSession(id, viewer);
          if (!row) return a.json({ ok: false, error: "not_found" }, 404);
          return a.json({ ok: true, session: a.clientSession(row) });
        }
        const { data } = await a.db
          .from("sessions")
          .select("*")
          .eq("user_id", viewer.id)
          .order("created_at", { ascending: false });
        return a.json({
          ok: true,
          sessions: (data ?? []).map((r) => a.clientSession(r as never)),
        });
      },
    },
  },
});
