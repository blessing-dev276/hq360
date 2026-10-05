import { z } from "zod";
import { createFileRoute } from "@tanstack/react-router";
import { resolveScoutAccess } from "@/lib/scout/owner.server";
import { asScoutDb, type ScoutBatch } from "@/lib/scout/db";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const Route = createFileRoute("/api/admin/scout-batches")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const access = await resolveScoutAccess(request);
        if (!access) return json({ ok: false, error: "unauthorized" }, 401);
        const parsed = z
          .object({
            label: z.string().trim().min(1).max(200),
            source: z.enum(["reedsy_discovery", "readers_favorite"]),
            genre: z.string().trim().max(120).optional(),
            requestedMax: z.number().int().min(1).max(100),
          })
          .safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ ok: false, error: "invalid" }, 400);
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data, error } = await asScoutDb(supabaseAdmin)
            .from("scout_batches")
            .insert({
              owner: access.owner,
              label: parsed.data.label,
              sources: [parsed.data.source],
              genre: parsed.data.genre ?? null,
              requested_max: parsed.data.requestedMax,
              item_count: 0,
            })
            .select("*")
            .single();
          if (error) return json({ ok: false, error: "storage" }, 500);
          return json({ ok: true, item: data }, 201);
        } catch {
          return json({ ok: false, error: "unavailable" }, 503);
        }
      },
      GET: async ({ request }) => {
        const access = await resolveScoutAccess(request);
        if (!access) return json({ ok: false, error: "unauthorized" }, 401);
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = asScoutDb(supabaseAdmin);
          const { data, error } = await db
            .from("scout_batches")
            .select("*, scout_batch_books(count)")
            .eq("owner", access.owner)
            .order("created_at", { ascending: false });
          if (error) return json({ ok: false, error: "storage" }, 500);
          return json({
            ok: true,
            items: (data ?? []).map(
              (row: ScoutBatch & { scout_batch_books?: { count: number }[] }) => ({
                ...row,
                item_count: row.scout_batch_books?.[0]?.count ?? row.item_count,
              }),
            ),
          });
        } catch (err) {
          console.error("[admin/scout-batches] GET", err instanceof Error ? err.message : err);
          return json({ ok: false, error: "unavailable" }, 503);
        }
      },
    },
  },
});
