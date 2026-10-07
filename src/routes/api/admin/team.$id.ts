import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { isAdminRequest } from "@/lib/admin-auth.server";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  title: z.string().min(1).max(160).optional(),
  imageUrl: z.string().max(2000).nullable().optional(),
  blurb: z.string().max(400).nullable().optional(),
  published: z.boolean().optional(),
});

export const Route = createFileRoute("/api/admin/team/$id")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        if (!(await isAdminRequest(request)))
          return json({ ok: false, error: "unauthorized" }, 401);
        if (!UUID.test(params.id)) return json({ ok: false, error: "not_found" }, 404);
        let body: z.infer<typeof patchSchema>;
        try {
          body = patchSchema.parse(await request.json());
        } catch {
          return json({ ok: false, error: "invalid" }, 400);
        }
        const update: TablesUpdate<"team_members"> = {};
        if (body.name !== undefined) update.name = body.name;
        if (body.title !== undefined) update.title = body.title;
        if (body.imageUrl !== undefined) update.image_url = body.imageUrl || null;
        if (body.blurb !== undefined) update.blurb = body.blurb || null;
        if (body.published !== undefined) update.published = body.published;

        if (Object.keys(update).length === 0) return json({ ok: false, error: "empty" }, 400);

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data, error } = await supabaseAdmin
            .from("team_members")
            .update(update)
            .eq("id", params.id)
            .select("*")
            .single();
          if (error || !data) return json({ ok: false, error: "storage" }, 500);
          return json({ ok: true, member: data });
        } catch (err) {
          console.error("[admin/team/:id] PATCH", err instanceof Error ? err.message : err);
          return json({ ok: false, error: "unavailable" }, 503);
        }
      },
      DELETE: async ({ request, params }) => {
        if (!(await isAdminRequest(request)))
          return json({ ok: false, error: "unauthorized" }, 401);
        if (!UUID.test(params.id)) return json({ ok: false, error: "not_found" }, 404);
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error } = await supabaseAdmin.from("team_members").delete().eq("id", params.id);
          if (error) return json({ ok: false, error: "storage" }, 500);
          return json({ ok: true });
        } catch (err) {
          console.error("[admin/team/:id] DELETE", err instanceof Error ? err.message : err);
          return json({ ok: false, error: "unavailable" }, 503);
        }
      },
    },
  },
});
