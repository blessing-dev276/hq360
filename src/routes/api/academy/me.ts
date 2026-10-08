import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/academy/me")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { getViewer, json } = await import("@/lib/academy/academy.server");
        const viewer = await getViewer(request);
        if (!viewer) return json({ ok: false, error: "unauthorized" }, 401);
        let trainer: { id: string; name: string } | null = null;
        if (viewer.trainerId) {
          const { db } = await import("@/lib/academy/academy.server");
          const { data } = await db
            .from("profiles")
            .select("id, full_name, email, role")
            .eq("id", viewer.trainerId)
            .maybeSingle();
          if (data?.role === "trainer")
            trainer = {
              id: data.id as string,
              name: (data.full_name as string | null) || (data.email as string).split("@")[0]!,
            };
        }
        // A trainer who stepped down counts as none: the trainee gets a new draw.
        return json({
          ok: true,
          viewer: { ...viewer, trainerId: trainer ? viewer.trainerId : null, trainer },
        });
      },
    },
  },
});
