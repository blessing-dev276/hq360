import { createFileRoute } from "@tanstack/react-router";

/** Experts assigned as Academy trainers: public profile details only. */
export const Route = createFileRoute("/api/academy/trainers")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const a = await import("@/lib/academy/academy.server");
        const viewer = await a.getViewer(request);
        if (!viewer) return a.json({ ok: false, error: "unauthorized" }, 401);
        // A trainee sees only the trainer they were assigned.
        let query = a.db
          .from("expert_profiles")
          .select("id, full_name, headline, photo_url, slug, is_public, is_founder")
          .eq("academy_trainer", true)
          .eq("status", "approved")
          .order("is_founder", { ascending: false });
        if (viewer.trainerId) query = query.eq("id", viewer.trainerId);
        let { data } = await query;
        if (viewer.trainerId && !data?.length) {
          // Assigned trainer without an expert profile: use their Academy name.
          const { data: p } = await a.db
            .from("profiles")
            .select("full_name, email")
            .eq("id", viewer.trainerId)
            .maybeSingle();
          if (p)
            data = [
              {
                full_name: (p.full_name as string | null) || (p.email as string).split("@")[0],
                headline: "Your HQ360 trainer",
                photo_url: null,
                slug: null,
                is_public: false,
              },
            ] as never;
        }
        const trainers = (
          (data ?? []) as {
            full_name: string | null;
            headline: string | null;
            photo_url: string | null;
            slug: string | null;
            is_public: boolean;
          }[]
        ).map((t) => ({
          name: t.full_name || "HQ360 Trainer",
          headline: t.headline || "",
          photo: t.photo_url || null,
          profileUrl: t.is_public && t.slug ? `/experts/${t.slug}` : null,
        }));
        return a.json({ ok: true, trainers });
      },
    },
  },
});
