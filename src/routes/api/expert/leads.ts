import { createFileRoute } from "@tanstack/react-router";

/** An expert's own Leads & Projects: only leads they own, ever. */
async function handle(request: Request) {
  const { isExpertRequest } = await import("@/lib/expert-auth.server");
  const expertId = await isExpertRequest(request);
  if (!expertId) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { handleLeads } = await import("@/lib/sales-leads.server");
  return handleLeads(request, { kind: "expert", expertId });
}
export const Route = createFileRoute("/api/expert/leads")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
      PATCH: ({ request }) => handle(request),
    },
  },
});
