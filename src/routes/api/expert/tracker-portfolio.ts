import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve"), id: z.string().uuid() }),
  z.object({ action: z.literal("autoPublish"), value: z.boolean() }),
  z.object({ action: z.literal("deleteTemplate"), id: z.string().uuid() }),
]);

/** Auto portfolio drafts from client trackers (one click approval), the auto
 *  publish setting, and template removal. */
export const Route = createFileRoute("/api/expert/tracker-portfolio")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { isExpertRequest } = await import("@/lib/expert-auth.server");
        const expertId = await isExpertRequest(request, { profileWrite: true });
        if (!expertId) return json({ error: "Unauthorized" }, 401);
        try {
          const p = await import("@/lib/trackers/portfolio.server");
          return json(await p.portfolioDrafts(expertId));
        } catch {
          return json({ error: "Could not load portfolio entries." }, 503);
        }
      },
      POST: async ({ request }) => {
        const { isExpertRequest } = await import("@/lib/expert-auth.server");
        const expertId = await isExpertRequest(request, { profileWrite: true });
        if (!expertId) return json({ error: "Unauthorized" }, 401);
        if (request.headers.get("origin") !== new URL(request.url).origin)
          return json({ error: "Invalid origin" }, 403);
        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ error: "Invalid request." }, 400);
        const { TrackerError, deleteTemplate } = await import("@/lib/trackers/service.server");
        try {
          const p = await import("@/lib/trackers/portfolio.server");
          if (parsed.data.action === "approve") await p.approvePortfolioEntry(expertId, parsed.data.id);
          else if (parsed.data.action === "autoPublish") await p.setAutoPublish(expertId, parsed.data.value);
          else await deleteTemplate(expertId, parsed.data.id);
          return json({ ok: true });
        } catch (error) {
          if (error instanceof TrackerError) return json({ error: error.message }, error.status);
          return json({ error: "Could not save." }, 503);
        }
      },
    },
  },
});
