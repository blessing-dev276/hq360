import { createFileRoute } from "@tanstack/react-router";
import { isAdminRequest } from "@/lib/admin-auth.server";

export const Route = createFileRoute("/api/admin/expert-portfolio/$id")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        if (!(await isAdminRequest(request)))
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        const body = await request.json().catch(() => null);
        if (!["approve", "reject", "delete"].includes(body?.action))
          return Response.json({ error: "Invalid action" }, { status: 400 });
        const { expertPortfolioItems } = await import("@/lib/expert-auth.server");

        if (body.action === "delete") {
          const { error } = await expertPortfolioItems().delete().eq("id", params.id);
          if (error)
            return Response.json({ error: "Could not delete this item." }, { status: 503 });
          return Response.json({ ok: true });
        }

        const { error } = await expertPortfolioItems()
          .update({
            status: body.action === "approve" ? "approved" : "rejected",
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", params.id);
        if (error) return Response.json({ error: "Could not update this item." }, { status: 503 });
        return Response.json({ ok: true });
      },
    },
  },
});
