import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

const createSchema = z
  .object({
    clientName: z.string().trim().min(1).max(120),
    clientEmail: z.string().trim().email().max(254).or(z.literal("")),
    projectTitle: z.string().trim().max(200),
    packageName: z.string().trim().max(120),
    passcode: z.string().trim().max(64).optional(),
    templateId: z.string().uuid().optional(),
    // Admin only: which expert owns the new tracker.
    expertId: z.string().uuid().optional(),
  })
  .strict();

/** Client trackers: list (with views this week) and create. Experts see their
 *  own; admin (x-hq360-actor: admin) sees every expert's. */
export const Route = createFileRoute("/api/expert/trackers")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { trackerActor } = await import("@/lib/trackers/actor.server");
        const actor = await trackerActor(request, false);
        if (actor instanceof Response) return actor;
        const { listTrackers, listTemplates, TrackerError } = await import("@/lib/trackers/service.server");
        try {
          const [trackers, templates] = await Promise.all([listTrackers(actor), listTemplates(actor)]);
          return json({ trackers, templates, admin: actor.role === "admin" });
        } catch (error) {
          return json({ error: error instanceof TrackerError ? error.message : "Could not load trackers." }, 503);
        }
      },
      POST: async ({ request }) => {
        const { trackerActor } = await import("@/lib/trackers/actor.server");
        const actor = await trackerActor(request, true);
        if (actor instanceof Response) return actor;
        const parsed = createSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ error: "Add the client's name and a valid email." }, 400);
        const { createTracker, TrackerError } = await import("@/lib/trackers/service.server");
        const { validPasscode } = await import("@/lib/trackers/security.server");
        if (parsed.data.passcode && !validPasscode(parsed.data.passcode))
          return json({ error: "A passcode needs 6 to 64 letters and numbers." }, 400);
        // Experts always own what they create; only admin chooses an owner.
        const input = actor.role === "admin" ? parsed.data : { ...parsed.data, expertId: undefined };
        if (actor.role === "admin" && input.expertId) {
          const { expertProfiles } = await import("@/lib/expert-auth.server");
          const { data } = await expertProfiles().select("status").eq("id", input.expertId).maybeSingle();
          if ((data as { status?: string } | null)?.status !== "approved")
            return json({ error: "Choose an approved expert." }, 400);
        }
        try {
          const created = await createTracker(actor, input);
          return json(created, 201);
        } catch (error) {
          if (error instanceof TrackerError) return json({ error: error.message }, error.status);
          return json({ error: "Could not create the tracker." }, 503);
        }
      },
    },
  },
});
