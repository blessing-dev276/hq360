import { createFileRoute } from "@tanstack/react-router";
import { isAdminRequest } from "@/lib/admin-auth.server";

export const Route = createFileRoute("/api/admin/expert-portfolio/$id")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        if (!(await isAdminRequest(request)))
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        const body = await request.json().catch(() => null);
        if (!["approve", "reject", "delete", "update"].includes(body?.action))
          return Response.json({ error: "Invalid action" }, { status: 400 });
        const { expertPortfolioItems } = await import("@/lib/expert-auth.server");

        if (body.action === "update") {
          const { adminPortfolioSchema, portfolioRow } = await import("@/lib/expert-admin.server");
          const parsed = adminPortfolioSchema.safeParse(body?.item);
          if (!parsed.success)
            return Response.json(
              { error: parsed.error.issues[0]?.message || "Check the item details." },
              { status: 400 },
            );
          // Admin edits stay live; editing detaches it from the site original.
          const { error } = await expertPortfolioItems()
            .update({
              ...portfolioRow(parsed.data),
              source_portfolio_item_id: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", params.id);
          if (error) return Response.json({ error: "Could not save this item." }, { status: 503 });
          return Response.json({ ok: true });
        }

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
