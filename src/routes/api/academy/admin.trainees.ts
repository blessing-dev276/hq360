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
    },
  },
});
