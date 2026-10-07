import { createFileRoute } from "@tanstack/react-router";
import { isAdminRequest } from "@/lib/admin-auth.server";

async function handle(request: Request) {
  if (!(await isAdminRequest(request)))
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const { handleLeads } = await import("@/lib/sales-leads.server");
  return handleLeads(request, { kind: "admin" });
}
export const Route = createFileRoute("/api/admin/leads")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
      PATCH: ({ request }) => handle(request),
    },
  },
});
