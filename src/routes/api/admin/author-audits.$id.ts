import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { isAdminRequest } from "@/lib/admin-auth.server";
import { asAuditDb, type AuditStatus } from "@/lib/author-audit/db";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STATUSES: AuditStatus[] = [
  "draft",
  "researching",
  "needs_verification",
  "ready_for_review",
  "completed",
  "report_sent",
  "follow_up",
  "converted",
  "archived",
];

const patchSchema = z.object({
  status: z.enum(STATUSES as [AuditStatus, ...AuditStatus[]]).optional(),
});

export const Route = createFileRoute("/api/admin/author-audits/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        if (!(await isAdminRequest(request)))
          return json({ ok: false, error: "unauthorized" }, 401);
        if (!UUID.test(params.id)) return json({ ok: false, error: "not_found" }, 404);
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = asAuditDb(supabaseAdmin);

          const { data: audit, error } = await db
            .from("author_audits")
            .select("*, authors(*), books(*), author_audit_leads(*)")
            .eq("id", params.id)
            .single();
          if (error || !audit) return json({ ok: false, error: "not_found" }, 404);

          const [sources, evidence, findings, verifications, notes, opportunities] =
            await Promise.all([
              db
                .from("audit_sources")
                .select("*")
                .eq("audit_id", params.id)
                .order("created_at", { ascending: true }),
              db
                .from("audit_evidence")
                .select("*")
                .eq("audit_id", params.id)
                .order("created_at", { ascending: true }),
              db
                .from("audit_findings")
                .select("*")
                .eq("audit_id", params.id)
                .order("created_at", { ascending: true }),
              db.from("audit_manual_verifications").select("*").eq("audit_id", params.id),
              db
                .from("audit_staff_notes")
                .select("*")
                .eq("audit_id", params.id)
                .order("created_at", { ascending: false }),
              db.from("service_opportunities").select("*").eq("audit_id", params.id),
            ]);

          return json({
            ok: true,
            audit,
            sources: sources.data ?? [],
            evidence: evidence.data ?? [],
            findings: findings.data ?? [],
            verifications: verifications.data ?? [],
            notes: notes.data ?? [],
            opportunities: opportunities.data ?? [],
          });
        } catch (err) {
          console.error("[admin/author-audits/:id] GET", err instanceof Error ? err.message : err);
          return json({ ok: false, error: "unavailable" }, 503);
        }
      },
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
        if (!body.status) return json({ ok: false, error: "empty" }, 400);
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = asAuditDb(supabaseAdmin);
          const update: Record<string, unknown> = { status: body.status };
          if (body.status === "completed")
            update.client_report_approved_at = new Date().toISOString();
          const { data, error } = await db
            .from("author_audits")
            .update(update)
            .eq("id", params.id)
            .select("*")
            .single();
          if (error || !data) return json({ ok: false, error: "storage" }, 500);
          return json({ ok: true, item: data });
        } catch (err) {
          console.error(
            "[admin/author-audits/:id] PATCH",
            err instanceof Error ? err.message : err,
          );
          return json({ ok: false, error: "unavailable" }, 503);
        }
      },
    },
  },
});
