import { createFileRoute } from "@tanstack/react-router";

const SUBS = ["personalisation", "value", "objection", "tone", "close"] as const;

type SessionLite = {
  user_id: string;
  ended: boolean;
  created_at: string;
  coaching: { overall?: number; scores?: Record<string, number> } | null;
};

// Trainer overview. Works with a trainer login or the /admin passphrase cookie.
export const Route = createFileRoute("/api/academy/admin/trainees")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const a = await import("@/lib/academy/academy.server");
        if (!(await a.isTrainerRequest(request)))
          return a.json({ ok: false, error: "forbidden" }, 403);

        const [{ data: profiles }, { data: sessionData }] = await Promise.all([
          a.db.from("profiles").select("id, full_name, email, role, created_at"),
          a.db.from("sessions").select("user_id, coaching, ended, created_at"),
        ]);
        const sessions = (sessionData ?? []) as SessionLite[];

        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const trainees = (profiles ?? []).map((p) => {
          const mine = sessions.filter((s) => s.user_id === p.id);
          const scored = mine.filter((s) => s.ended && s.coaching);
          const averageScore = scored.length
            ? Math.round(scored.reduce((n, s) => n + (s.coaching?.overall ?? 0), 0) / scored.length)
            : null;
          let weakest: string | null = null;
          if (scored.length) {
            const means = SUBS.map((k) => ({
              k,
              v: scored.reduce((n, s) => n + (s.coaching?.scores?.[k] ?? 0), 0) / scored.length,
            }));
            weakest = means.sort((x, y) => x.v - y.v)[0]!.k;
          }
          return {
            id: p.id as string,
            name: p.full_name as string | null,
            email: p.email as string | null,
            role: p.role as string,
            sessionsThisWeek: mine.filter((s) => new Date(s.created_at).getTime() >= weekAgo)
              .length,
            totalSessions: mine.length,
            averageScore,
            weakest,
          };
        });
        return a.json({ ok: true, trainees });
      },
      /** Make someone a trainer, or back to a trainee. */
      PATCH: async ({ request }) => {
        const a = await import("@/lib/academy/academy.server");
        if (!(await a.isTrainerRequest(request)))
          return a.json({ ok: false, error: "forbidden" }, 403);
        const body = (await request.json().catch(() => null)) as {
          id?: unknown;
          role?: unknown;
        } | null;
        const id = typeof body?.id === "string" ? body.id : "";
        const role = body?.role === "trainer" || body?.role === "trainee" ? body.role : null;
        if (!/^[0-9a-f-]{36}$/.test(id) || !role)
          return a.json({ ok: false, message: "Invalid request." }, 400);
        const viewer = await a.getViewer(request);
        if (viewer?.id === id && role === "trainee")
          return a.json({ ok: false, message: "You can't remove your own trainer access." }, 400);
        const { data, error } = await a.db
          .from("profiles")
          .update({ role })
          .eq("id", id)
          .select("id, role")
          .maybeSingle();
        if (error) return a.json({ ok: false, message: "Could not update the role." }, 503);
        if (!data) return a.json({ ok: false, message: "Person not found." }, 404);
        return a.json({ ok: true, id, role });
      },
    },
  },
});
