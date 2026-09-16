import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { isAdminRequest } from "@/lib/admin-auth.server";
import { asAuditDb } from "@/lib/author-audit/db";
import { reviewSchema, reviewUpdate } from "@/lib/author-audit/review";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const schema = reviewSchema.extend({
  action: z.string().min(1).max(500).optional(),
  reason: z.string().max(1000).nullable().optional(),
  completionIndicator: z.string().max(500).nullable().optional(),
});

export const Route = createFileRoute("/api/admin/author-audits/$id/roadmap/$itemId")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        if (!(await isAdminRequest(request)))
          return json({ ok: false, error: "unauthorized" }, 401);
        if (!UUID.test(params.id) || !UUID.test(params.itemId))
          return json({ ok: false, error: "not_found" }, 404);
        let body: z.infer<typeof schema>;
        try {
          body = schema.parse(await request.json());
        } catch {
          return json({ ok: false, error: "invalid" }, 400);
        }

        const update: Record<string, unknown> = { ...reviewUpdate(body) };
        if (body.action !== undefined) update.action = body.action;
        if (body.reason !== undefined) update.reason = body.reason;
        if (body.completionIndicator !== undefined)
          update.completion_indicator = body.completionIndicator;
        if (Object.keys(update).length === 0) return json({ ok: false, error: "empty" }, 400);

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = asAuditDb(supabaseAdmin);
          const { data, error } = await db
            .from("audit_roadmap_items")
            .update(update)
            .eq("id", params.itemId)
            .eq("audit_id", params.id)
            .select("*")
            .single();
          if (error || !data) return json({ ok: false, error: "storage" }, 500);
          return json({ ok: true, item: data });
        } catch (err) {
          console.error(
            "[admin/author-audits/:id/roadmap/:itemId] PATCH",
            err instanceof Error ? err.message : err,
          );
          return json({ ok: false, error: "unavailable" }, 503);
        }
      },
    },
  },
});
