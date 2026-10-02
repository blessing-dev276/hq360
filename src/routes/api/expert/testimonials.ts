import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { TESTIMONIAL_FIELDS, expertVideoPrefix } from "@/lib/expert-testimonials";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

const schema = z.object({
  client_name: z.string().trim().min(2).max(120),
  client_role: z.string().trim().max(120),
  quote: z.string().trim().max(500),
  video_url: z.string().trim().min(1).max(500),
  service_slug: z.string().trim().max(60),
});

export const Route = createFileRoute("/api/expert/testimonials")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { isExpertRequest } = await import("@/lib/expert-auth.server");
        const { expertTestimonials } = await import("@/lib/expert-testimonials.server");
        const expertId = await isExpertRequest(request);
        if (!expertId) return json({ error: "Unauthorized" }, 401);
        const { data, error } = await expertTestimonials()
          .select(TESTIMONIAL_FIELDS)
          .eq("expert_id", expertId)
          .order("created_at", { ascending: false });
        if (error) return json({ error: "Could not load your testimonials." }, 503);
        return json({ items: data ?? [] });
      },
      POST: async ({ request }) => {
        const { isExpertRequest } = await import("@/lib/expert-auth.server");
        const { expertTestimonials } = await import("@/lib/expert-testimonials.server");
        const expertId = await isExpertRequest(request);
        if (!expertId) return json({ error: "Unauthorized" }, 401);
        if (request.headers.get("origin") !== new URL(request.url).origin)
          return json({ error: "Invalid origin" }, 403);
        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success)
          return json({ error: parsed.error.issues[0]?.message || "Check your details." }, 400);
        const input = parsed.data;
        if (!input.video_url.startsWith(expertVideoPrefix(expertId)))
          return json({ error: "Upload the video using the upload button." }, 400);
        const { CORE_SERVICES } = await import("@/data/agency");
        if (input.service_slug && !CORE_SERVICES.some((s) => s.slug === input.service_slug))
          return json({ error: "Choose a service from the list." }, 400);
        const { data, error } = await expertTestimonials()
          .insert({
            expert_id: expertId,
            client_name: input.client_name,
            client_role: input.client_role || null,
            quote: input.quote || null,
            video_url: input.video_url,
            service_slug: input.service_slug || null,
            status: "pending",
          })
          .select(TESTIMONIAL_FIELDS)
          .maybeSingle();
        if (error || !data) return json({ error: "Could not save this testimonial." }, 503);
        return json({ item: data });
      },
    },
  },
});
