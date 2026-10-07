import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const schema = z.object({ sessionId: z.string().min(1).max(100), text: z.string().min(1) });

// Runs the scout message through the rule based Author Engine. The client shows
// "Typing..." for `delayMs` before revealing the reply, so it feels human.
export const Route = createFileRoute("/api/academy/reply")({
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
        const text = body.text.trim();
        if (text.length > a.MAX_MESSAGE_CHARS)
          return a.json(
            { ok: false, error: "too_long", message: "Keep it under 1,500 characters." },
            400,
          );

        const row = await a.loadOwnSession(body.sessionId, viewer);
        if (!row || row.user_id !== viewer.id)
          return a.json({ ok: false, error: "not_found" }, 404);
        if (row.ended) return a.json({ ok: false, error: "ended" }, 409);

        try {
          const { row: next, delayMs } = await a.handleScoutMessage(row, text);
          return a.json({ ok: true, session: a.clientSession(next), delayMs });
        } catch (err) {
          console.error("[academy/reply]", err instanceof Error ? err.message : err);
          return a.json(
            { ok: false, error: "engine", message: "Could not send. Press Send again to retry." },
            500,
          );
        }
      },
    },
  },
});
