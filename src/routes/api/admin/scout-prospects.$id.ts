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
  status: z
    .enum(["new", "research_needed", "qualified", "contacted", "replied", "interested", "excluded"])
    .optional(),
  excludedReason: z.string().trim().max(500).nullable().optional(),
  researchNotes: z.string().trim().max(5000).nullable().optional(),
  auditId: z.string().uuid().nullable().optional(),
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/api/admin/scout-prospects/$id")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        if (!(await isAdminRequest(request)))
          return json({ ok: false, error: "unauthorized" }, 401);
        if (!UUID.test(params.id)) return json({ ok: false, error: "invalid" }, 400);
        let body: z.infer<typeof patchSchema>;
        try {
          body = patchSchema.parse(await request.json());
        } catch {
          return json({ ok: false, error: "invalid" }, 400);
        }
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = asScoutDb(supabaseAdmin);

          const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
          if (body.status !== undefined) {
            update.status = body.status;
            // "contacted"/"excluded" are the two statuses that must block a
            // future accidental re-add into outreach; every other status
            // leaves do_not_contact untouched so staff can still flip it
            // back off explicitly if a status was set in error.
            if (body.status === "contacted" || body.status === "excluded")
              update.do_not_contact = true;
          }
          if (body.excludedReason !== undefined) update.excluded_reason = body.excludedReason;
          if (body.researchNotes !== undefined) update.research_notes = body.researchNotes;
          if (body.auditId !== undefined) update.audit_id = body.auditId;

          const { data, error } = await db
            .from("scout_prospects")
            .update(update)
            .eq("id", params.id)
            .select("*")
            .single();
          if (error || !data) return json({ ok: false, error: "storage" }, 500);
          return json({ ok: true, item: data });
        } catch (err) {
          console.error(
            "[admin/scout-prospects.$id] PATCH",
            err instanceof Error ? err.message : err,
          );
          return json({ ok: false, error: "unavailable" }, 503);
        }
      },
      DELETE: async ({ request, params }) => {
        if (!(await isAdminRequest(request)))
          return json({ ok: false, error: "unauthorized" }, 401);
        if (!UUID.test(params.id)) return json({ ok: false, error: "invalid" }, 400);
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = asScoutDb(supabaseAdmin);
          const { error } = await db.from("scout_prospects").delete().eq("id", params.id);
          if (error) return json({ ok: false, error: "storage" }, 500);
          return json({ ok: true });
        } catch (err) {
          console.error(
            "[admin/scout-prospects.$id] DELETE",
            err instanceof Error ? err.message : err,
          );
          return json({ ok: false, error: "unavailable" }, 503);
        }
      },
    },
  },
});
