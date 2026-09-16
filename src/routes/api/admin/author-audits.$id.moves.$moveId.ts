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
  whatWeFound: z.string().min(1).max(2000).optional(),
  whatWeWouldChange: z.string().min(1).max(2000).optional(),
  whyFirst: z.string().min(1).max(2000).optional(),
  enablesNext: z.string().max(2000).nullable().optional(),
  successIndicator: z.string().max(500).nullable().optional(),
});

export const Route = createFileRoute("/api/admin/author-audits/$id/moves/$moveId")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        if (!(await isAdminRequest(request)))
          return json({ ok: false, error: "unauthorized" }, 401);
        if (!UUID.test(params.id) || !UUID.test(params.moveId))
          return json({ ok: false, error: "not_found" }, 404);
        let body: z.infer<typeof schema>;
        try {
          body = schema.parse(await request.json());
        } catch {
          return json({ ok: false, error: "invalid" }, 400);
        }

        const update: Record<string, unknown> = { ...reviewUpdate(body) };
        if (body.title !== undefined) update.title = body.title;
        if (body.whatWeFound !== undefined) update.what_we_found = body.whatWeFound;
        if (body.whatWeWouldChange !== undefined)
          update.what_we_would_change = body.whatWeWouldChange;
        if (body.whyFirst !== undefined) update.why_first = body.whyFirst;
        if (body.enablesNext !== undefined) update.enables_next = body.enablesNext;
        if (body.successIndicator !== undefined) update.success_indicator = body.successIndicator;
        if (Object.keys(update).length === 0) return json({ ok: false, error: "empty" }, 400);

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = asAuditDb(supabaseAdmin);
          const { data, error } = await db
            .from("audit_priority_moves")
            .update(update)
            .eq("id", params.moveId)
            .eq("audit_id", params.id)
            .select("*")
            .single();
          if (error || !data) return json({ ok: false, error: "storage" }, 500);
          return json({ ok: true, item: data });
        } catch (err) {
          console.error(
            "[admin/author-audits/:id/moves/:moveId] PATCH",
            err instanceof Error ? err.message : err,
          );
          return json({ ok: false, error: "unavailable" }, 503);
        }
      },
    },
  },
});
