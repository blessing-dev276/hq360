import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// POST { sessionId, text }  -> the trainee's assigned trainer (or admin) adds a note
// POST { sessionId, seen }  -> the trainee marks their trainer's notes as read
export const Route = createFileRoute("/api/academy/feedback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const a = await import("@/lib/academy/academy.server");
        if (request.headers.get("origin") !== new URL(request.url).origin)
          return a.json({ ok: false, error: "origin" }, 403);
        const parsed = z
          .union([
            z.object({
              sessionId: z.string().min(1).max(100),
              text: z.string().trim().min(1).max(2000),
            }),
            z.object({ sessionId: z.string().min(1).max(100), seen: z.literal(true) }),
          ])
          .safeParse(await request.json().catch(() => null));
        if (!parsed.success) return a.json({ ok: false, message: "Write a note first." }, 400);
        const body = parsed.data;
        const { data } = await a.db
          .from("sessions")
          .select("*")
          .eq("id", body.sessionId)
          .maybeSingle();
        const row = data as import("@/lib/academy/academy.server").SessionRow | null;
        if (!row) return a.json({ ok: false, error: "not_found" }, 404);

        if ("seen" in body) {
          const viewer = await a.getViewer(request);
          if (!viewer || viewer.id !== row.user_id)
            return a.json({ ok: false, error: "forbidden" }, 403);
          await a.db.from("sessions").update({ feedback_unread: false }).eq("id", row.id);
          return a.json({ ok: true });
        }

        const scope = await a.trainerScope(request);
        if (!scope || (!scope.all && !(await a.isAssignedTo(scope.trainerId, row.user_id))))
          return a.json({ ok: false, message: "Only this trainee's trainer can add notes." }, 403);
        const viewer = await a.getViewer(request);
        const note = {
          by: viewer?.name || viewer?.email?.split("@")[0] || "HQ360",
          byId: viewer?.id ?? "admin",
          text: body.text,
          at: new Date().toISOString(),
        };
        const notes = [...(row.trainer_feedback ?? []), note].slice(-50);
        const { error } = await a.db
          .from("sessions")
          .update({ trainer_feedback: notes, feedback_unread: true })
          .eq("id", row.id);
        if (error) return a.json({ ok: false, message: "Could not save the note." }, 503);
        return a.json({ ok: true, trainerFeedback: notes });
      },
    },
  },
});
