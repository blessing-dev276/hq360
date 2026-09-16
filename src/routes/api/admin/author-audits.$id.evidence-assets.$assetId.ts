import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { isAdminRequest } from "@/lib/admin-auth.server";
import { asAuditDb } from "@/lib/author-audit/db";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const schema = z.object({
  caption: z.string().max(500).nullable().optional(),
  source: z.string().max(300).nullable().optional(),
  clientVisible: z.boolean().optional(),
});

export const Route = createFileRoute("/api/admin/author-audits/$id/evidence-assets/$assetId")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        if (!(await isAdminRequest(request)))
          return json({ ok: false, error: "unauthorized" }, 401);
        if (!UUID.test(params.id) || !UUID.test(params.assetId))
          return json({ ok: false, error: "not_found" }, 404);
        let body: z.infer<typeof schema>;
        try {
          body = schema.parse(await request.json());
        } catch {
          return json({ ok: false, error: "invalid" }, 400);
        }
        const update: Record<string, unknown> = {};
        if (body.caption !== undefined) update.caption = body.caption;
        if (body.source !== undefined) update.source = body.source;
        if (body.clientVisible !== undefined) update.client_visible = body.clientVisible;
        if (Object.keys(update).length === 0) return json({ ok: false, error: "empty" }, 400);

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = asAuditDb(supabaseAdmin);
          const { data, error } = await db
            .from("audit_evidence_assets")
            .update(update)
            .eq("id", params.assetId)
            .eq("audit_id", params.id)
            .select("*")
            .single();
          if (error || !data) return json({ ok: false, error: "storage" }, 500);
          return json({ ok: true, item: data });
        } catch (err) {
          console.error(
            "[admin/author-audits/:id/evidence-assets/:assetId] PATCH",
            err instanceof Error ? err.message : err,
          );
          return json({ ok: false, error: "unavailable" }, 503);
        }
      },
      DELETE: async ({ request, params }) => {
        if (!(await isAdminRequest(request)))
          return json({ ok: false, error: "unauthorized" }, 401);
        if (!UUID.test(params.id) || !UUID.test(params.assetId))
          return json({ ok: false, error: "not_found" }, 404);
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = asAuditDb(supabaseAdmin);
          const { error } = await db
            .from("audit_evidence_assets")
            .delete()
            .eq("id", params.assetId)
            .eq("audit_id", params.id);
          if (error) return json({ ok: false, error: "storage" }, 500);
          return json({ ok: true });
        } catch (err) {
          console.error(
            "[admin/author-audits/:id/evidence-assets/:assetId] DELETE",
            err instanceof Error ? err.message : err,
          );
          return json({ ok: false, error: "unavailable" }, 503);
        }
      },
    },
  },
});
