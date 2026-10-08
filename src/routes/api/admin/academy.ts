import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Admin control of Author Scout Academy people (admin passphrase only).
// GET    -> everyone with role, trainer, practice stats
// PATCH  -> { id, role } or { id, trainerId } (reassign; null = redraw on next sign in)
// DELETE -> ?id=  remove the person and all their Academy data. Academy-only
//           accounts are deleted entirely (they can sign up again); an expert
//           trainer keeps their expert account and loses only Academy data.
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

async function context(request: Request) {
  const { isAdminRequest } = await import("@/lib/admin-auth.server");
  if (!(await isAdminRequest(request))) return null;
  const { db } = await import("@/lib/academy/academy.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return { db, supabaseAdmin };
}

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  created_at: string;
  trainer_id: string | null;
  trainer_assigned_at: string | null;
};
type SessionLite = {
  user_id: string;
  ended: boolean;
  created_at: string;
  coaching: { overall?: number } | null;
};

export const Route = createFileRoute("/api/admin/academy")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const c = await context(request);
        if (!c) return json({ error: "Unauthorized" }, 401);
        const [{ data: profiles, error }, { data: sessions }, { data: experts }] =
          await Promise.all([
            c.db
              .from("profiles")
              .select("id, full_name, email, role, created_at, trainer_id, trainer_assigned_at")
              .order("created_at", { ascending: false }),
            c.db.from("sessions").select("user_id, ended, created_at, coaching"),
            c.db.from("expert_profiles").select("id"),
          ]);
        if (error) return json({ error: "Could not load the Academy." }, 503);
        const rows = (profiles ?? []) as ProfileRow[];
        const all = (sessions ?? []) as SessionLite[];
        const expertIds = new Set((experts ?? []).map((e) => e.id as string));
        const nameOf = new Map(rows.map((p) => [p.id, p.full_name || p.email || "Unnamed"]));
        const people = rows.map((p) => {
          const mine = all.filter((s) => s.user_id === p.id);
          const scored = mine.filter((s) => s.ended && s.coaching?.overall != null);
          return {
            id: p.id,
            name: p.full_name,
            email: p.email,
            role: p.role === "trainer" ? "trainer" : "trainee",
            joinedAt: p.created_at,
            expert: expertIds.has(p.id),
            trainerId: p.trainer_id,
            trainerName: p.trainer_id ? (nameOf.get(p.trainer_id) ?? null) : null,
            assignedAt: p.trainer_assigned_at,
            trainees: rows.filter((r) => r.trainer_id === p.id).length,
            sessions: mine.length,
            lastActive: mine.reduce<string | null>(
              (latest, s) => (!latest || s.created_at > latest ? s.created_at : latest),
              null,
            ),
            averageScore: scored.length
              ? Math.round(
                  scored.reduce((n, s) => n + (s.coaching?.overall ?? 0), 0) / scored.length,
                )
              : null,
          };
        });
        return json({ ok: true, people });
      },

      PATCH: async ({ request }) => {
        const c = await context(request);
        if (!c) return json({ error: "Unauthorized" }, 401);
        const parsed = z
          .union([
            z.object({ id: z.string().uuid(), role: z.enum(["trainer", "trainee"]) }).strict(),
            z.object({ id: z.string().uuid(), trainerId: z.string().uuid().nullable() }).strict(),
          ])
          .safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ error: "Invalid request." }, 400);
        const body = parsed.data;
        if ("role" in body) {
          const { error } = await c.db
            .from("profiles")
            .update(
              // A trainer has no trainer of their own.
              body.role === "trainer"
                ? { role: "trainer", trainer_id: null, trainer_assigned_at: null }
                : { role: "trainee" },
            )
            .eq("id", body.id);
          if (error) return json({ error: "Could not change the role." }, 503);
          if (body.role === "trainee") {
            // Their trainees will be redrawn on next sign in; an expert loses the badge.
            await c.db.from("profiles").update({ trainer_id: null }).eq("trainer_id", body.id);
            await c.db.from("expert_profiles").update({ academy_trainer: false }).eq("id", body.id);
          }
          return json({ ok: true });
        }
        if (body.trainerId) {
          if (body.trainerId === body.id) return json({ error: "Pick a different trainer." }, 400);
          const { data: t } = await c.db
            .from("profiles")
            .select("role")
            .eq("id", body.trainerId)
            .maybeSingle();
          if (t?.role !== "trainer") return json({ error: "That person is not a trainer." }, 400);
        }
        const { error } = await c.db
          .from("profiles")
          .update({
            trainer_id: body.trainerId,
            trainer_assigned_at: body.trainerId ? new Date().toISOString() : null,
          })
          .eq("id", body.id)
          .eq("role", "trainee");
        return error ? json({ error: "Could not reassign." }, 503) : json({ ok: true });
      },

      DELETE: async ({ request }) => {
        const c = await context(request);
        if (!c) return json({ error: "Unauthorized" }, 401);
        if (request.headers.get("origin") !== new URL(request.url).origin)
          return json({ error: "Invalid origin" }, 403);
        const id = new URL(request.url).searchParams.get("id") ?? "";
        if (!z.string().uuid().safeParse(id).success) return json({ error: "Invalid id." }, 400);
        const { data: expert } = await c.db
          .from("expert_profiles")
          .select("id")
          .eq("id", id)
          .maybeSingle();
        // Their trainees get a fresh random trainer on next sign in.
        await c.db.from("profiles").update({ trainer_id: null }).eq("trainer_id", id);
        if (expert) {
          // Same login as their expert account: remove only Academy data.
          // Chats, keys and the profile cascade from the profile row.
          await c.db.from("expert_profiles").update({ academy_trainer: false }).eq("id", id);
          const { error } = await c.db.from("profiles").delete().eq("id", id);
          return error
            ? json({ error: "Could not remove their Academy data." }, 503)
            : json({ ok: true, removed: "academy" });
        }
        // Academy-only account: delete the login; everything else cascades.
        const { error } = await c.supabaseAdmin.auth.admin.deleteUser(id);
        if (error && !/not found/i.test(error.message))
          return json({ error: "Could not delete this account." }, 503);
        if (error) await c.db.from("profiles").delete().eq("id", id);
        return json({ ok: true, removed: "account" });
      },
    },
  },
});
