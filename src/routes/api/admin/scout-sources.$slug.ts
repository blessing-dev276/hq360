import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { isAdminRequest } from "@/lib/admin-auth.server";
import { asScoutDb } from "@/lib/scout/db";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const patchSchema = z.object({
  enabled: z.boolean().optional(),
  collection_limit_per_day: z.number().int().positive().nullable().optional(),
  sync_schedule: z.string().trim().max(120).nullable().optional(),
  terms_notes: z.string().trim().max(2000).nullable().optional(),
});

export const Route = createFileRoute("/api/admin/scout-sources/$slug")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        if (!(await isAdminRequest(request)))
          return json({ ok: false, error: "unauthorized" }, 401);
        let body: z.infer<typeof patchSchema>;
        try {
          body = patchSchema.parse(await request.json());
        } catch {
          return json({ ok: false, error: "invalid" }, 400);
        }
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = asScoutDb(supabaseAdmin);
          const { data: existing } = await db
            .from("scout_sources")
            .select("kind")
            .eq("slug", params.slug)
            .maybeSingle();
          if (!existing) return json({ ok: false, error: "not_found" }, 404);
          // Sources with no authorized programmatic access can't be flipped
          // on from this panel -- enabling one requires shipping an adapter
          // first, not just a config toggle.
          if (body.enabled && (existing as { kind: string }).kind === "unimplemented")
            return json({ ok: false, error: "source_not_implemented" }, 409);

          const { data, error } = await db
            .from("scout_sources")
            .update({ ...body, updated_at: new Date().toISOString() })
            .eq("slug", params.slug)
            .select("*")
            .single();
          if (error || !data) return json({ ok: false, error: "storage" }, 500);
          return json({ ok: true, item: data });
        } catch (err) {
          console.error(
            "[admin/scout-sources.$slug] PATCH",
            err instanceof Error ? err.message : err,
          );
          return json({ ok: false, error: "unavailable" }, 503);
        }
      },
    },
  },
});
