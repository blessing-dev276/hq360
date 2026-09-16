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
  status: z
    .enum([
      "strong",
      "functional",
      "friction_identified",
      "opportunity_identified",
      "unable_to_verify",
    ])
    .optional(),
  observation: z.string().min(1).max(4000).optional(),
  evidence: z.string().max(4000).nullable().optional(),
  friction: z.string().max(2000).nullable().optional(),
  recommendation: z.string().max(2000).nullable().optional(),
});

export const Route = createFileRoute("/api/admin/author-audits/$id/reader-journey/$stepId")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        if (!(await isAdminRequest(request)))
          return json({ ok: false, error: "unauthorized" }, 401);
        if (!UUID.test(params.id) || !UUID.test(params.stepId))
          return json({ ok: false, error: "not_found" }, 404);
        let body: z.infer<typeof schema>;
        try {
          body = schema.parse(await request.json());
        } catch {
          return json({ ok: false, error: "invalid" }, 400);
        }

        const update: Record<string, unknown> = { ...reviewUpdate(body) };
        if (body.status !== undefined) update.status = body.status;
        if (body.observation !== undefined) update.observation = body.observation;
        if (body.evidence !== undefined) update.evidence = body.evidence;
        if (body.friction !== undefined) update.friction = body.friction;
        if (body.recommendation !== undefined) update.recommendation = body.recommendation;
        if (Object.keys(update).length === 0) return json({ ok: false, error: "empty" }, 400);

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = asAuditDb(supabaseAdmin);
          const { data, error } = await db
            .from("audit_reader_journey")
            .update(update)
            .eq("id", params.stepId)
            .eq("audit_id", params.id)
            .select("*")
            .single();
          if (error || !data) return json({ ok: false, error: "storage" }, 500);
          return json({ ok: true, item: data });
        } catch (err) {
          console.error(
            "[admin/author-audits/:id/reader-journey/:stepId] PATCH",
            err instanceof Error ? err.message : err,
          );
          return json({ ok: false, error: "unavailable" }, 503);
        }
      },
    },
  },
});
