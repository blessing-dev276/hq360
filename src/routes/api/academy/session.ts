import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const schema = z.object({ mode: z.enum(["cold", "no"]) });

export const Route = createFileRoute("/api/academy/session")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const a = await import("@/lib/academy/academy.server");
        const data = await import("@/lib/academy/practice-data.server");
        const viewer = await a.getViewer(request);
        if (!viewer) return a.json({ ok: false, error: "unauthorized" }, 401);
        let body: z.infer<typeof schema>;
        try {
          body = schema.parse(await request.json());
        } catch {
          return a.json({ ok: false, error: "invalid" }, 400);
        }
        const { startingTrust, stageOf } = await import("@/lib/academy/engine.server");
        const persona = data.pick(data.AUTHORS);
        const mood = data.pick(data.MOODS);
        const challenge = data.pick(data.TEST_STYLES).id;
        const trust = startingTrust(challenge, body.mode, mood);
        const messages: import("@/lib/academy/academy.server").Msg[] =
          body.mode === "no"
            ? [
                { role: "sys", text: "You already sent a first pitch. This is the author's reply." },
                { role: "author", text: persona.no },
              ]
            : [];
        const { data: row, error } = await a.db
          .from("sessions")
          .insert({
            id: crypto.randomUUID(),
            user_id: viewer.id,
            persona: persona.id,
            mood,
            challenge,
            mode: body.mode,
            messages,
            trust,
            stage: stageOf(trust),
            trust_history: [trust],
          })
          .select("*")
          .single();
        if (error || !row) return a.json({ ok: false, error: "storage" }, 500);
        return a.json({ ok: true, session: a.clientSession(row as never) });
      },
    },
  },
});
