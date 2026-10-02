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

/** Approved experts who opted in to a public profile. Never exposes email or review state. */
export const Route = createFileRoute("/api/public/experts")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { expertProfiles } = await import("@/lib/expert-auth.server");
          const { data, error } = await expertProfiles()
            .select(
              "slug, full_name, headline, summary, bio, photo_url, specialties, location, website_url, linkedin_url",
            )
            .eq("status", "approved")
            .eq("is_public", true)
            .order("reviewed_at", { ascending: true })
            .limit(200);
          if (error) return json({ ok: false }, 503);
          return json({ ok: true, experts: data ?? [] });
        } catch {
          return json({ ok: false }, 503);
        }
      },
    },
  },
});
