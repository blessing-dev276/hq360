import { createFileRoute } from "@tanstack/react-router";
import { isAdminRequest } from "@/lib/admin-auth.server";
export const Route = createFileRoute("/api/admin/experts/$id")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        if (!(await isAdminRequest(request)))
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        const body = await request.json().catch(() => null);
        if (!["approve", "reject"].includes(body?.action))
          return Response.json({ error: "Invalid action" }, { status: 400 });
        const { expertProfiles } = await import("@/lib/expert-auth.server");
        const { configuredUsername } = await import("@/lib/admin-auth.server");
        const { error } = await expertProfiles()
          .update({
            status: body.action === "approve" ? "approved" : "rejected",
            reviewed_at: new Date().toISOString(),
            reviewed_by: configuredUsername(),
          })
          .eq("id", params.id);
        if (error) return Response.json({ error: "Could not update expert." }, { status: 503 });
        return Response.json({ ok: true });
      },
    },
  },
});
