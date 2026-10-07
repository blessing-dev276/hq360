import { createFileRoute } from "@tanstack/react-router";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control":
        status === 200 ? "public, max-age=0, s-maxage=10, stale-while-revalidate=59" : "no-store",
    },
  });
}

/** Approved video testimonials for one public, approved expert profile. */
export const Route = createFileRoute("/api/public/expert-testimonials")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const slug = new URL(request.url).searchParams.get("slug")?.trim();
        if (!slug) return json({ ok: false }, 400);
        try {
          const { expertProfiles } = await import("@/lib/expert-auth.server");
          const { expertTestimonials } = await import("@/lib/expert-testimonials.server");
          const { data: expert } = await expertProfiles()
            .select("id")
            .eq("slug", slug)
            .eq("is_public", true)
            .eq("status", "approved")
            .maybeSingle();
          if (!expert) return json({ ok: true, items: [] });
          const { data, error } = await expertTestimonials()
            .select("id, client_name, client_role, quote, video_url, service_slug")
            .eq("expert_id", expert.id)
            .eq("status", "approved")
            .order("sort_order", { ascending: true })
            .order("created_at", { ascending: false });
          if (error) return json({ ok: false }, 503);
          return json({ ok: true, items: data ?? [] });
        } catch {
          return json({ ok: false }, 503);
        }
      },
    },
  },
});
