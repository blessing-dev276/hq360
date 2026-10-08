import { createFileRoute } from "@tanstack/react-router";

// POST: give a signed-in trainee their trainer. The pick is random and made
// once, atomically, in the database; the reveal animation only shows it.
// Returns every trainer too, so the client can spin through them.
export const Route = createFileRoute("/api/academy/assign")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const a = await import("@/lib/academy/academy.server");
        const viewer = await a.getViewer(request);
        if (!viewer) return a.json({ ok: false, error: "unauthorized" }, 401);
        if (viewer.role !== "trainee") return a.json({ ok: true, trainer: null, pool: [] });
        if (request.headers.get("origin") !== new URL(request.url).origin)
          return a.json({ ok: false, error: "origin" }, 403);
        const fresh = !viewer.trainerId;
        const { data: trainerId, error } = await a.db.rpc("assign_academy_trainer", {
          p_trainee: viewer.id,
        });
        if (error) return a.json({ ok: false, message: "Could not assign a trainer." }, 503);
        const { data: trainers } = await a.db
          .from("profiles")
          .select("id, full_name, email")
          .eq("role", "trainer");
        // Expert trainers share their expert login id: use their photo and headline.
        const ids = (trainers ?? []).map((t) => t.id as string);
        const { data: experts } = ids.length
          ? await a.db
              .from("expert_profiles")
              .select("id, full_name, headline, photo_url")
              .in("id", ids)
          : { data: [] };
        const expert = new Map((experts ?? []).map((e) => [e.id as string, e]));
        const pool = (trainers ?? []).map((t) => {
          const e = expert.get(t.id as string);
          return {
            id: t.id as string,
            name:
              (e?.full_name as string | null) ||
              (t.full_name as string | null) ||
              (t.email as string | null)?.split("@")[0] ||
              "Trainer",
            headline: ((e?.headline as string | null) ?? "") || "HQ360 trainer",
            photo: (e?.photo_url as string | null) ?? null,
          };
        });
        const trainer = pool.find((t) => t.id === trainerId) ?? null;
        return a.json({ ok: true, fresh, trainer, pool });
      },
    },
  },
});
