import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Bulk nudge: { targets: [{ id, keys }], note }. Each expert only gets the
// nudges that apply to their access; one notification (and email) per nudge.
export const Route = createFileRoute("/api/admin/experts/nudge")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { isAdminRequest } = await import("@/lib/admin-auth.server");
        if (!(await isAdminRequest(request)))
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        if (request.headers.get("origin") !== new URL(request.url).origin)
          return Response.json({ error: "Invalid origin" }, { status: 403 });
        const parsed = z
          .object({
            targets: z
              .array(z.object({ id: z.string().uuid(), keys: z.array(z.string()).max(20) }))
              .min(1)
              .max(200),
            note: z.string().max(500).default(""),
          })
          .safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 });
        const { NUDGES, nudgeBody, nudgeAvailableFor } = await import("@/lib/expert-nudges");
        const { expertProfiles } = await import("@/lib/expert-auth.server");
        const ids = parsed.data.targets.map((t) => t.id);
        const { data: experts } = await expertProfiles()
          .select("id, status, is_guest, permissions, academy_trainer")
          .in("id", ids);
        const byId = new Map(
          (
            (experts ?? []) as {
              id: string;
              status: string;
              is_guest: boolean | null;
              permissions: string[] | null;
              academy_trainer: boolean | null;
            }[]
          ).map((e) => [e.id, e]),
        );
        const rows = parsed.data.targets.flatMap((t) => {
          const expert = byId.get(t.id);
          if (!expert || expert.status !== "approved") return [];
          return NUDGES.filter((n) => t.keys.includes(n.key) && nudgeAvailableFor(n, expert)).map(
            (n) => ({
              audience: "expert",
              expert_id: t.id,
              kind: "nudge",
              title: n.title,
              body: nudgeBody(n, parsed.data.note),
              tab: n.tab,
            }),
          );
        });
        if (!rows.length)
          return Response.json(
            { error: "None of the chosen nudges apply to these experts." },
            { status: 400 },
          );
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await (
          supabaseAdmin as unknown as import("@supabase/supabase-js").SupabaseClient
        )
          .from("notifications")
          .insert(rows);
        if (error) return Response.json({ error: "Could not send the nudges." }, { status: 503 });
        return Response.json({
          ok: true,
          sent: rows.length,
          people: new Set(rows.map((r) => r.expert_id)).size,
        });
      },
    },
  },
});
