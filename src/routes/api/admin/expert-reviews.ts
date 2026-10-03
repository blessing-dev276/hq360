import { createFileRoute } from "@tanstack/react-router";
import { isAdminRequest } from "@/lib/admin-auth.server";
import { REVIEW_FIELDS } from "@/lib/expert-reviews";

export const Route = createFileRoute("/api/admin/expert-reviews")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isAdminRequest(request)))
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        const { expertReviews } = await import("@/lib/expert-reviews.server");
        const { data, error } = await expertReviews()
          .select(`${REVIEW_FIELDS}, expert_id`)
          .order("created_at", { ascending: false });
        if (error) return Response.json({ error: "Could not load reviews." }, { status: 503 });
        return Response.json({ items: data ?? [] });
      },
    },
  },
});
