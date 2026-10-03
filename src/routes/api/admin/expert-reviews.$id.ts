import { createFileRoute } from "@tanstack/react-router";
import { isAdminRequest } from "@/lib/admin-auth.server";

export const Route = createFileRoute("/api/admin/expert-reviews/$id")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        if (!(await isAdminRequest(request)))
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        const body = await request.json().catch(() => null);
        if (!["approve", "reject", "delete"].includes(body?.action))
          return Response.json({ error: "Invalid action" }, { status: 400 });
        const { expertReviews } = await import("@/lib/expert-reviews.server");
        if (body.action === "delete") {
          const { data: removed, error } = await expertReviews()
            .delete()
            .eq("id", params.id)
            .select("expert_id, client_name")
            .maybeSingle();
          if (error)
            return Response.json({ error: "Could not delete this review." }, { status: 503 });
          if (removed) {
            const { notifyExpert } = await import("@/lib/notifications.server");
            await notifyExpert(
              removed.expert_id,
              "review_removed",
              "Client review removed",
              `HQ360 removed the review from ${removed.client_name}.`,
              "portfolio",
            );
          }
          return Response.json({ ok: true });
        }
        const { configuredUsername } = await import("@/lib/admin-auth.server");
        const { error } = await expertReviews()
          .update({
            status: body.action === "approve" ? "approved" : "rejected",
            reviewed_at: new Date().toISOString(),
            reviewed_by: configuredUsername(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", params.id);
        if (error)
          return Response.json({ error: "Could not update this review." }, { status: 503 });
        return Response.json({ ok: true });
      },
    },
  },
});
