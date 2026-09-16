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
  title: z.string().min(1).max(300).optional(),
  observation: z.string().min(1).max(4000).optional(),
  whyItMatters: z.string().max(2000).nullable().optional(),
  recommendation: z.string().max(2000).nullable().optional(),
  sourceUrls: z.array(z.string().max(2000)).max(10).optional(),
  reviewStatus: z.enum(["ai_research", "needs_verification", "approved", "rejected"]).optional(),
  clientVisible: z.boolean().optional(),
});

/** Staff edits a single finding in place and/or approves it for the client
 * report. A finding only ever reaches the report once clientVisible is set
 * true, which only a human does here. */
export const Route = createFileRoute("/api/admin/author-audits/$id/findings/$findingId")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        if (!(await isAdminRequest(request)))
          return json({ ok: false, error: "unauthorized" }, 401);
        if (!UUID.test(params.id) || !UUID.test(params.findingId))
          return json({ ok: false, error: "not_found" }, 404);
        let body: z.infer<typeof schema>;
        try {
          body = schema.parse(await request.json());
        } catch {
          return json({ ok: false, error: "invalid" }, 400);
        }

        const update: Record<string, unknown> = {};
        if (body.title !== undefined) update.title = body.title;
        if (body.observation !== undefined) update.observation = body.observation;
        if (body.whyItMatters !== undefined) update.why_it_matters = body.whyItMatters;
        if (body.recommendation !== undefined) update.recommendation = body.recommendation;
        if (body.sourceUrls !== undefined) update.source_urls = body.sourceUrls;
        if (body.reviewStatus !== undefined) update.review_status = body.reviewStatus;
        if (body.clientVisible !== undefined) update.client_visible = body.clientVisible;
        if (Object.keys(update).length === 0) return json({ ok: false, error: "empty" }, 400);

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = asAuditDb(supabaseAdmin);
          const { data, error } = await db
            .from("audit_findings")
            .update(update)
            .eq("id", params.findingId)
            .eq("audit_id", params.id)
            .select("*")
            .single();
          if (error || !data) return json({ ok: false, error: "storage" }, 500);
          return json({ ok: true, item: data });
        } catch (err) {
          console.error(
            "[admin/author-audits/:id/findings/:findingId] PATCH",
            err instanceof Error ? err.message : err,
          );
          return json({ ok: false, error: "unavailable" }, 503);
        }
      },
    },
  },
});
