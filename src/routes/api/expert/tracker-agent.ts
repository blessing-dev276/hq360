import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

const chatSchema = z
  .object({
    model: z.string().max(80),
    messages: z
      .array(
        z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(20000) }).strict(),
      )
      .min(1)
      .max(60),
    images: z.array(z.string().max(7_500_000)).max(4).optional(),
  })
  .strict();

/** Client tracking assistant (Auto mode): chat that creates and edits trackers. */
export const Route = createFileRoute("/api/expert/tracker-agent")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { trackerActor } = await import("@/lib/trackers/actor.server");
        const actor = await trackerActor(request, true);
        if (actor instanceof Response) return actor;
        const parsed = chatSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ error: "Invalid message." }, 400);
        const { chat } = await import("@/lib/trackers/agent.server");
        const { TrackerError } = await import("@/lib/trackers/service.server");
        try {
          return json(
            await chat(actor, parsed.data.messages, parsed.data.model, parsed.data.images ?? []),
          );
        } catch (error) {
          if (error instanceof TrackerError) return json({ error: error.message }, error.status);
          return json({ error: "The assistant is unavailable. Please try again." }, 503);
        }
      },
    },
  },
});
