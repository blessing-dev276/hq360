import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { isAdminRequest } from "@/lib/admin-auth.server";
import { asAuditDb } from "@/lib/author-audit/db";
import { VERIFICATION_FIELDS } from "@/lib/author-audit/verification-fields";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FIELD_KEYS = VERIFICATION_FIELDS.map((f) => f.key);

const entrySchema = z.object({
  fieldKey: z.enum(FIELD_KEYS as [string, ...string[]]),
  value: z.string().max(2000).nullable(),
  verificationStatus: z.enum(["verified", "unverified", "not_applicable"]),
  sourceUrl: z.string().max(2000).nullable().optional(),
  staffNote: z.string().max(2000).nullable().optional(),
});

const schema = z.object({ entries: z.array(entrySchema).min(1).max(50) });

/** Upserts staff-entered fields (Amazon/Goodreads/social figures the tool
 * can't fetch automatically) — one row per field_key per audit. */
export const Route = createFileRoute("/api/admin/author-audits/$id/verifications")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        if (!(await isAdminRequest(request)))
          return json({ ok: false, error: "unauthorized" }, 401);
        if (!UUID.test(params.id)) return json({ ok: false, error: "not_found" }, 404);
        let body: z.infer<typeof schema>;
        try {
          body = schema.parse(await request.json());
        } catch {
          return json({ ok: false, error: "invalid" }, 400);
        }
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = asAuditDb(supabaseAdmin);

          const rows = body.entries.map((e) => ({
            audit_id: params.id,
            field_key: e.fieldKey,
            value: e.value,
            verification_status: e.verificationStatus,
            source_url: e.sourceUrl || null,
            staff_note: e.staffNote || null,
            verified_at: e.verificationStatus === "verified" ? new Date().toISOString() : null,
          }));

          const { error } = await db
            .from("audit_manual_verifications")
            .upsert(rows, { onConflict: "audit_id,field_key" });
          if (error) return json({ ok: false, error: "storage" }, 500);

          return json({ ok: true });
        } catch (err) {
          console.error(
            "[admin/author-audits/:id/verifications] POST",
            err instanceof Error ? err.message : err,
          );
          return json({ ok: false, error: "unavailable" }, 503);
        }
      },
    },
  },
});
