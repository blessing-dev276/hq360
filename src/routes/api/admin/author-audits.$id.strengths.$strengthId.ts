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
  title: z.string().min(1).max(300).optional(),
  observation: z.string().min(1).max(4000).optional(),
  evidence: z.string().max(4000).nullable().optional(),
  disposition: z.enum(["preserve", "build_upon", "no_change_needed"]).nullable().optional(),
});

export const Route = createFileRoute("/api/admin/author-audits/$id/strengths/$strengthId")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        if (!(await isAdminRequest(request)))
          return json({ ok: false, error: "unauthorized" }, 401);
        if (!UUID.test(params.id) || !UUID.test(params.strengthId))
          return json({ ok: false, error: "not_found" }, 404);
        let body: z.infer<typeof schema>;
        try {
          body = schema.parse(await request.json());
        } catch {
          return json({ ok: false, error: "invalid" }, 400);
        }

        const update: Record<string, unknown> = { ...reviewUpdate(body) };
        if (body.title !== undefined) update.title = body.title;
        if (body.observation !== undefined) update.observation = body.observation;
        if (body.evidence !== undefined) update.evidence = body.evidence;
        if (body.disposition !== undefined) update.disposition = body.disposition;
        if (Object.keys(update).length === 0) return json({ ok: false, error: "empty" }, 400);

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = asAuditDb(supabaseAdmin);
          const { data, error } = await db
            .from("audit_strengths")
            .update(update)
            .eq("id", params.strengthId)
            .eq("audit_id", params.id)
            .select("*")
            .single();
          if (error || !data) return json({ ok: false, error: "storage" }, 500);
          return json({ ok: true, item: data });
        } catch (err) {
          console.error(
            "[admin/author-audits/:id/strengths/:strengthId] PATCH",
            err instanceof Error ? err.message : err,
          );
          return json({ ok: false, error: "unavailable" }, 503);
        }
      },
      DELETE: async ({ request, params }) => {
        if (!(await isAdminRequest(request)))
          return json({ ok: false, error: "unauthorized" }, 401);
        if (!UUID.test(params.id) || !UUID.test(params.strengthId))
          return json({ ok: false, error: "not_found" }, 404);
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = asAuditDb(supabaseAdmin);
          const { error } = await db
            .from("audit_strengths")
            .delete()
            .eq("id", params.strengthId)
            .eq("audit_id", params.id);
          if (error) return json({ ok: false, error: "storage" }, 500);
          return json({ ok: true });
        } catch (err) {
          console.error(
            "[admin/author-audits/:id/strengths/:strengthId] DELETE",
            err instanceof Error ? err.message : err,
          );
          return json({ ok: false, error: "unavailable" }, 503);
        }
      },
    },
  },
});
