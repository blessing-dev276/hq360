import { createFileRoute } from "@tanstack/react-router";
import { isAdminRequest } from "@/lib/admin-auth.server";

export const Route = createFileRoute("/api/admin/expert-testimonials/$id")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        if (!(await isAdminRequest(request)))
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        const body = await request.json().catch(() => null);
        if (!["approve", "reject", "delete"].includes(body?.action))
          return Response.json({ error: "Invalid action" }, { status: 400 });
        const { expertTestimonials } = await import("@/lib/expert-testimonials.server");
        if (body.action === "delete") {
          const { error } = await expertTestimonials().delete().eq("id", params.id);
          if (error)
            return Response.json({ error: "Could not delete this video." }, { status: 503 });
          return Response.json({ ok: true });
        }
        const { configuredUsername } = await import("@/lib/admin-auth.server");
        const { error } = await expertTestimonials()
          .update({
            status: body.action === "approve" ? "approved" : "rejected",
            reviewed_at: new Date().toISOString(),
            reviewed_by: configuredUsername(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", params.id);
        if (error) return Response.json({ error: "Could not update this video." }, { status: 503 });
        return Response.json({ ok: true });
      },
    },
  },
});
