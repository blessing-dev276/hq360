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
              "id, title, description, image_url, external_link, service_slugs, audience_slugs",
            )
            .eq("expert_id", expert.id)
            .eq("status", "approved")
            .order("sort_order", { ascending: true })
            .order("created_at", { ascending: true });
          if (error) return json({ ok: false }, 503);
          return json({ ok: true, items: data ?? [] });
        } catch {
          return json({ ok: false }, 503);
        }
      },
    },
  },
});
