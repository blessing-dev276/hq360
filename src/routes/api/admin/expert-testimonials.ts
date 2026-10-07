import { createFileRoute } from "@tanstack/react-router";
import { isAdminRequest } from "@/lib/admin-auth.server";
import { TESTIMONIAL_FIELDS } from "@/lib/expert-testimonials";

export const Route = createFileRoute("/api/admin/expert-testimonials")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isAdminRequest(request)))
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        const { expertTestimonials } = await import("@/lib/expert-testimonials.server");
        const { data, error } = await expertTestimonials()
          .select(`${TESTIMONIAL_FIELDS}, expert_id`)
          .order("created_at", { ascending: false });
        if (error) return Response.json({ error: "Could not load testimonials." }, { status: 503 });
        return Response.json({ items: data ?? [] });
      },
    },
  },
});
