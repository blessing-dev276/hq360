import { createFileRoute } from "@tanstack/react-router";
import { isAdminRequest } from "@/lib/admin-auth.server";

export const Route = createFileRoute("/api/admin/expert-portfolio")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isAdminRequest(request)))
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        const { expertPortfolioItems } = await import("@/lib/expert-auth.server");
        const { data, error } = await expertPortfolioItems()
          .select(
            "id, expert_id, title, description, image_url, external_link, service_slugs, audience_slugs, status, created_at, reviewed_at, source_portfolio_item_id, expert_profiles(full_name, email, slug)",
          )
          .order("created_at", { ascending: false });
        if (error)
          return Response.json({ error: "Could not load portfolio items." }, { status: 503 });
        return Response.json({ items: data ?? [] });
      },
      /** Admin adds a portfolio item to any expert; it's live straight away. */
      POST: async ({ request }) => {
        if (!(await isAdminRequest(request)))
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        const body = await request.json().catch(() => null);
        const { adminPortfolioSchema, portfolioRow } = await import("@/lib/expert-admin.server");
        const parsed = adminPortfolioSchema.safeParse(body?.item);
        if (!parsed.success || typeof body?.expert_id !== "string")
          return Response.json(
            { error: parsed.error?.issues[0]?.message || "Check the item details." },
            { status: 400 },
          );
        const { expertPortfolioItems } = await import("@/lib/expert-auth.server");
        const { configuredUsername } = await import("@/lib/admin-auth.server");
        const { error } = await expertPortfolioItems().insert({
          expert_id: body.expert_id,
          ...portfolioRow(parsed.data),
          status: "approved",
          reviewed_at: new Date().toISOString(),
          reviewed_by: configuredUsername(),
        });
        if (error) return Response.json({ error: "Could not add this item." }, { status: 503 });
        return Response.json({ ok: true });
      },
    },
  },
});
