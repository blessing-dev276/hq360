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
 * Public read of published portfolio items, filtered by industry and/or
 * capability. Empty collections are valid; temporary backend failures are not
 * cached and allow the UI to offer a retry without silently losing the section.
 */
export const Route = createFileRoute("/api/public/portfolio")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const industry = url.searchParams.get("industry") ?? "";
        const capability = url.searchParams.get("capability") ?? "";

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          let query = supabaseAdmin
            .from("portfolio_items")
            .select(
              "id, title, description, media_type, media_url, thumbnail_url, capability_slug, industry_slug, external_link",
            )
            .eq("published", true);

          if (industry) query = query.eq("industry_slug", industry);
          if (capability) query = query.eq("capability_slug", capability);

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
