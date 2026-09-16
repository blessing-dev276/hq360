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

/**
 * Public read of published testimonials, filtered by industry and/or
 * capability. Distinct from portfolio_items: a testimonial is proof of
 * reputation (a review screenshot), not a delivered work sample.
 */
export const Route = createFileRoute("/api/public/testimonials")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const industry = url.searchParams.get("industry") ?? "";
        const capability = url.searchParams.get("capability") ?? "";
        const mediaType = url.searchParams.get("mediaType") ?? "";

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          let query = supabaseAdmin
            .from("testimonials")
            .select(
              "id, title, quote, media_type, media_url, thumbnail_url, industry_slug, capability_slug",
            )
            .eq("published", true);

          if (industry) query = query.eq("industry_slug", industry);
          if (capability) query = query.eq("capability_slug", capability);
          if (mediaType) query = query.eq("media_type", mediaType);

          const { data, error } = await query
            .order("sort_order", { ascending: true })
            .order("created_at", { ascending: false })
            .limit(60);

          if (error) return json({ ok: false }, 503);
          return json({ ok: true, items: data ?? [] });
        } catch {
          return json({ ok: false }, 503);
        }
      },
    },
  },
});
