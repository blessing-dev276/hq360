import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const schema = z.object({ sessionId: z.string().min(1).max(100) });

export const Route = createFileRoute("/api/academy/hint")({
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
        return a.json({ ok: true, hint: await a.getHint(row) });
      },
    },
  },
});
