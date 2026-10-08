import { createFileRoute } from "@tanstack/react-router";

/** Experts assigned as Academy trainers: public profile details only. */
export const Route = createFileRoute("/api/academy/trainers")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const a = await import("@/lib/academy/academy.server");
        if (!(await a.getViewer(request))) return a.json({ ok: false, error: "unauthorized" }, 401);
        const { data } = await a.db
          .from("expert_profiles")
          .select("id, full_name, headline, photo_url, slug, is_public, is_founder")
          .eq("academy_trainer", true)
          .eq("status", "approved")
          .order("is_founder", { ascending: false });
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
