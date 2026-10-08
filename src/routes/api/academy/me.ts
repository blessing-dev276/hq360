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
            .select("id, full_name, email")
            .eq("id", viewer.trainerId)
            .maybeSingle();
          if (data)
            trainer = {
              id: data.id as string,
              name: (data.full_name as string | null) || (data.email as string).split("@")[0]!,
            };
        }
        return json({ ok: true, viewer: { ...viewer, trainer } });
      },
    },
  },
});
