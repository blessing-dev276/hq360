import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const schema = z.object({ sessionId: z.string().min(1).max(100) });

export const Route = createFileRoute("/api/academy/demos")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const a = await import("@/lib/academy/academy.server");
        const viewer = await a.getViewer(request);
        if (!viewer) return a.json({ ok: false, error: "unauthorized" }, 401);
        const { data } = await a.db
          .from("demos")
          .select("*")
          .order("shared_at", { ascending: false });
        return a.json({ ok: true, demos: data ?? [] });
      },
      POST: async ({ request }) => {
        const a = await import("@/lib/academy/academy.server");
        const viewer = await a.getViewer(request);
        if (!viewer) return a.json({ ok: false, error: "unauthorized" }, 401);
        if (viewer.role !== "trainer") return a.json({ ok: false, error: "forbidden" }, 403);
        let body: z.infer<typeof schema>;
        try {
          body = schema.parse(await request.json());
        } catch {
          return a.json({ ok: false, error: "invalid" }, 400);
        }
        const row = await a.loadOwnSession(body.sessionId, viewer);
        if (!row) return a.json({ ok: false, error: "not_found" }, 404);
        if (!row.ended)
          return a.json(
            { ok: false, error: "not_ended", message: "Get coaching before sharing." },
            409,
          );
        const { error } = await a.db.from("demos").upsert({
          id: row.id,
          session: a.clientSession(row),
          shared_by: viewer.id,
        });
        if (error) return a.json({ ok: false, error: "storage" }, 500);
        return a.json({ ok: true });
      },
    },
  },
});
