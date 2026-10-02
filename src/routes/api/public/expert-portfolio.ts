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

/** Approved portfolio items for one public, approved expert profile. */
export const Route = createFileRoute("/api/public/expert-portfolio")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const slug = new URL(request.url).searchParams.get("slug")?.trim();
        if (!slug) return json({ ok: false }, 400);
        try {
          const { expertProfiles, expertPortfolioItems } = await import("@/lib/expert-auth.server");
          const { data: expert } = await expertProfiles()
            .select("id")
            .eq("slug", slug)
            .eq("is_public", true)
            .eq("status", "approved")
            .maybeSingle();
          if (!expert) return json({ ok: true, items: [] });
          const { data, error } = await expertPortfolioItems()
            .select(
              "id, title, description, image_url, external_link, service_slugs, audience_slugs, source:portfolio_items(title, description, media_url, thumbnail_url, external_link)",
            )
            .eq("expert_id", expert.id)
            .eq("status", "approved")
            .order("sort_order", { ascending: true })
            .order("created_at", { ascending: true });
          if (error) return json({ ok: false }, 503);
          type Source = {
            title: string;
            description: string | null;
            media_url: string | null;
            thumbnail_url: string | null;
            external_link: string | null;
          } | null;
          // Items assigned from the site portfolio show its current content.
          const items = (data ?? []).map(({ source, ...item }) => {
            // Many-to-one embed: an object at runtime, typed loosely as an array.
            const s = (Array.isArray(source) ? source[0] : source) as unknown as Source;
            if (!s) return item;
            return {
              ...item,
              title: s.title || item.title,
              description: s.description || item.description,
              image_url: s.thumbnail_url || s.media_url || item.image_url,
              external_link: s.external_link || item.external_link,
            };
          });
          return json({ ok: true, items });
        } catch {
          return json({ ok: false }, 503);
        }
      },
    },
  },
});
