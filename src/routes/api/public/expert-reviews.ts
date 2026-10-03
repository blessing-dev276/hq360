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

/** Approved, screenshot-backed client reviews for one public expert profile. */
export const Route = createFileRoute("/api/public/expert-reviews")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const slug = new URL(request.url).searchParams.get("slug")?.trim();
        if (!slug) return json({ ok: false }, 400);
        try {
          const { expertProfiles } = await import("@/lib/expert-auth.server");
          const { expertReviews } = await import("@/lib/expert-reviews.server");
          const { data: expert } = await expertProfiles()
            .select("id")
            .eq("slug", slug)
            .eq("is_public", true)
            .eq("status", "approved")
            .maybeSingle();
          if (!expert) return json({ ok: true, items: [] });
          const { data, error } = await expertReviews()
            .select("id, client_name, platform, rating, review_text, review_date, screenshot_url")
            .eq("expert_id", expert.id)
            .eq("status", "approved")
            .order("sort_order", { ascending: true })
            .order("review_date", { ascending: false, nullsFirst: false });
          if (error) return json({ ok: false }, 503);
          return json({ ok: true, items: data ?? [] });
        } catch {
          return json({ ok: false }, 503);
        }
      },
    },
  },
});
