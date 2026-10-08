import { createFileRoute } from "@tanstack/react-router";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control":
        status === 200 ? "public, max-age=0, s-maxage=30, stale-while-revalidate=120" : "no-store",
    },
  });
}

type Expert = {
  id: string;
  full_name: string | null;
  slug: string | null;
  photo_url: string | null;
};
type Item = {
  id: string;
  expert_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  external_link: string | null;
  service_slugs: string[];
  audience_slugs: string[];
  source: unknown;
};

/**
 * Everything approved that public experts have added, for the website:
 * portfolio items (tagged by service and audience), client video testimonials
 * (tagged by service) and client reviews. Only approved, public experts.
 */
export const Route = createFileRoute("/api/public/expert-proof")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { expertProfiles, expertPortfolioItems } = await import("@/lib/expert-auth.server");
          const { expertTestimonials } = await import("@/lib/expert-testimonials.server");
          const { expertReviews } = await import("@/lib/expert-reviews.server");
          const { data: experts, error } = await expertProfiles()
            .select("id, full_name, slug, photo_url")
            .eq("is_public", true)
            .eq("status", "approved");
          if (error) return json({ ok: false }, 503);
          const list = (experts ?? []) as Expert[];
          if (!list.length) return json({ ok: true, portfolio: [], videos: [], reviews: [] });
          const ids = list.map((e) => e.id);
          const byId = new Map(
            list.map((e) => [
              e.id,
              { name: e.full_name || "HQ360 expert", slug: e.slug, photo: e.photo_url },
            ]),
          );
          const [items, videos, reviews] = await Promise.all([
            expertPortfolioItems()
              .select(
                "id, expert_id, title, description, image_url, external_link, service_slugs, audience_slugs, source:portfolio_items(title, description, media_url, thumbnail_url, external_link)",
              )
              .in("expert_id", ids)
              .eq("status", "approved")
              .order("sort_order", { ascending: true }),
            expertTestimonials()
              .select("id, expert_id, client_name, client_role, quote, video_url, service_slug")
              .in("expert_id", ids)
              .eq("status", "approved")
              .order("sort_order", { ascending: true }),
            expertReviews()
              .select(
                "id, expert_id, client_name, platform, rating, review_text, review_date, screenshot_url",
              )
              .in("expert_id", ids)
              .eq("status", "approved")
              .order("review_date", { ascending: false, nullsFirst: false }),
          ]);
          type Source = {
            title: string;
            description: string | null;
            media_url: string | null;
            thumbnail_url: string | null;
            external_link: string | null;
          } | null;
          const portfolio = ((items.data ?? []) as Item[]).map(({ source, ...item }) => {
            // Items assigned from the site portfolio show its current content.
            const s = (Array.isArray(source) ? source[0] : source) as Source;
            return {
              id: item.id,
              title: s?.title || item.title,
              description: s?.description || item.description,
              image_url: s?.thumbnail_url || s?.media_url || item.image_url,
              external_link: s?.external_link || item.external_link,
              services: item.service_slugs ?? [],
              audiences: item.audience_slugs ?? [],
              expert: byId.get(item.expert_id)!,
              expertId: item.expert_id,
            };
          });
          // Services and audiences each expert has shown work in, so reviews
          // (which aren't tagged) appear on the pages for that kind of work.
          const tags = new Map<string, { services: Set<string>; audiences: Set<string> }>();
          const tagsOf = (id: string) => {
            if (!tags.has(id)) tags.set(id, { services: new Set(), audiences: new Set() });
            return tags.get(id)!;
          };
          for (const p of portfolio) {
            p.services.forEach((s) => tagsOf(p.expertId).services.add(s));
            p.audiences.forEach((a) => tagsOf(p.expertId).audiences.add(a));
          }
          const videoRows = (videos.data ?? []) as {
            id: string;
            expert_id: string;
            client_name: string;
            client_role: string | null;
            quote: string | null;
            video_url: string;
            service_slug: string | null;
          }[];
          for (const v of videoRows)
            if (v.service_slug) tagsOf(v.expert_id).services.add(v.service_slug);
          const expertTags = (id: string) => ({
            services: [...(tags.get(id)?.services ?? [])],
            audiences: [...(tags.get(id)?.audiences ?? [])],
          });
          return json({
            ok: true,
            portfolio: portfolio.map(({ expertId: _id, ...p }) => p),
            videos: videoRows.map((v) => ({
              id: v.id,
              client: v.client_name,
              role: v.client_role,
              quote: v.quote,
              video: v.video_url,
              services: v.service_slug ? [v.service_slug] : [],
              audiences: expertTags(v.expert_id).audiences,
              expert: byId.get(v.expert_id)!,
            })),
            reviews: (
              (reviews.data ?? []) as {
                id: string;
                expert_id: string;
                client_name: string;
                platform: string;
                rating: number | null;
                review_text: string;
                review_date: string | null;
                screenshot_url: string;
              }[]
            ).map((r) => ({
              id: r.id,
              client: r.client_name,
              platform: r.platform,
              rating: r.rating,
              text: r.review_text,
              date: r.review_date,
              screenshot: r.screenshot_url,
              ...expertTags(r.expert_id),
              expert: byId.get(r.expert_id)!,
            })),
          });
        } catch {
          return json({ ok: false }, 503);
        }
      },
    },
  },
});
