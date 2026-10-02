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
 * Public read of published team members, ordered for display. Returns an empty
 * list when nothing matches; uncached failures preserve the static UI roster
 * and let the visitor retry the managed content.
 */
export const Route = createFileRoute("/api/public/team")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { teamMembersUntyped } = await import("@/lib/expert-auth.server");
          const { data, error } = await teamMembersUntyped()
            .select(
              "id, name, title, image_url, blurb, claimed:expert_profiles!claimed_by_expert_id(slug, is_public, status)",
            )
            .eq("published", true)
            .order("sort_order", { ascending: true })
            .order("created_at", { ascending: true })
            .limit(60);
          if (error) return json({ ok: false }, 503);
          type Claimed = { slug: string; is_public: boolean; status: string } | null;
          // A team member claimed by a public expert profile (e.g. the founder)
          // is shown with that profile's content; expose only its slug.
          const members = (data ?? []).map(({ claimed, ...m }) => {
            const c = (Array.isArray(claimed) ? claimed[0] : claimed) as Claimed;
            return {
              ...m,
              expert_slug: c && c.is_public && c.status === "approved" ? c.slug : null,
            };
          });
          return json({ ok: true, members });
        } catch {
          return json({ ok: false }, 503);
        }
      },
    },
  },
});
