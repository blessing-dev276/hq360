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
            "id, expert_id, title, description, image_url, external_link, service_slugs, audience_slugs, status, created_at, reviewed_at, expert_profiles(full_name, email, slug)",
          )
          .order("created_at", { ascending: false });
        if (error)
          return Response.json({ error: "Could not load portfolio items." }, { status: 503 });
        return Response.json({ items: data ?? [] });
      },
    },
  },
});
