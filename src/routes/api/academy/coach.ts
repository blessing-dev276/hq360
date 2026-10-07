import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const schema = z.object({ sessionId: z.string().min(1).max(100) });

export const Route = createFileRoute("/api/academy/coach")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const a = await import("@/lib/academy/academy.server");
        const viewer = await a.getViewer(request);
        if (!viewer) return a.json({ ok: false, error: "unauthorized" }, 401);
        let body: z.infer<typeof schema>;
        try {
          body = schema.parse(await request.json());
        } catch {
          return a.json({ ok: false, error: "invalid" }, 400);
        }
        const row = await a.loadOwnSession(body.sessionId, viewer);
        if (!row || row.user_id !== viewer.id)
          return a.json({ ok: false, error: "not_found" }, 404);
        if (row.ended) return a.json({ ok: true, session: a.clientSession(row) });
        if (!row.messages.some((m) => m.role === "scout"))
          return a.json(
            { ok: false, error: "empty", message: "Send at least one message first." },
            400,
          );
        const coaching = await a.getCoaching(row);
        const { error } = await a.db
          .from("sessions")
          .update({ coaching, ended: true })
          .eq("id", row.id);
        if (error) return a.json({ ok: false, error: "storage" }, 500);
        return a.json({ ok: true, session: a.clientSession({ ...row, coaching, ended: true }) });
      },
    },
  },
});
