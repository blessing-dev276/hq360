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
  })
  .strict();

/** Client trackers: list (with views this week) and create. */
export const Route = createFileRoute("/api/expert/trackers")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { isExpertRequest } = await import("@/lib/expert-auth.server");
        const expertId = await isExpertRequest(request, { profileWrite: true });
        if (!expertId) return json({ error: "Unauthorized" }, 401);
        const { listTrackers, listTemplates, TrackerError } = await import("@/lib/trackers/service.server");
        try {
          const [trackers, templates] = await Promise.all([listTrackers(expertId), listTemplates(expertId)]);
          return json({ trackers, templates });
        } catch (error) {
          return json({ error: error instanceof TrackerError ? error.message : "Could not load trackers." }, 503);
        }
      },
      POST: async ({ request }) => {
        const { isExpertRequest } = await import("@/lib/expert-auth.server");
        const expertId = await isExpertRequest(request, { profileWrite: true });
        if (!expertId) return json({ error: "Unauthorized" }, 401);
        if (request.headers.get("origin") !== new URL(request.url).origin)
          return json({ error: "Invalid origin" }, 403);
        const parsed = createSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ error: "Add the client's name and a valid email." }, 400);
        const { createTracker, TrackerError } = await import("@/lib/trackers/service.server");
        const { validPasscode } = await import("@/lib/trackers/security.server");
        if (parsed.data.passcode && !validPasscode(parsed.data.passcode))
          return json({ error: "A passcode needs 6 to 64 letters and numbers." }, 400);
        try {
          const created = await createTracker(expertId, parsed.data);
          return json(created, 201);
        } catch (error) {
          if (error instanceof TrackerError) return json({ error: error.message }, error.status);
          return json({ error: "Could not create the tracker." }, 503);
        }
      },
    },
  },
});
