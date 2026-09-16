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

const executiveAssessmentSchema = z.object({
  whatIsWorking: z.string().max(2000),
  strongestOpportunities: z.string().max(2000),
  journeyBreaks: z.string().max(2000),
  comparablePatterns: z.string().max(2000),
  priorityFirst: z.string().max(2000),
  doNotChange: z.string().max(2000),
  unknowns: z.string().max(2000),
});

const patchSchema = z.object({
  status: z.enum(STATUSES as [AuditStatus, ...AuditStatus[]]).optional(),
  preparedByStaffName: z.string().max(160).nullable().optional(),
  executiveAssessment: executiveAssessmentSchema.optional(),
  executiveAssessmentReviewStatus: z
    .enum(["ai_research", "needs_verification", "approved", "rejected"])
    .optional(),
  executiveAssessmentClientVisible: z.boolean().optional(),
});

export const Route = createFileRoute("/api/admin/author-audits/$id")({
  server: {
    handlers: {
      DELETE: async ({ request, params }) => {
        if (!(await isAdminRequest(request)))
          return json({ ok: false, error: "unauthorized" }, 401);
        if (!UUID.test(params.id)) return json({ ok: false, error: "not_found" }, 404);
        const origin = request.headers.get("origin");
        if (origin && origin !== new URL(request.url).origin)
          return json({ ok: false, error: "forbidden" }, 403);
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          // Related research and review records cascade; shared authors/books remain.
          const { data, error } = await asAuditDb(supabaseAdmin)
            .from("author_audits")
            .delete()
            .eq("id", params.id)
            .select("id")
            .maybeSingle();
          if (error) return json({ ok: false, error: "delete_failed" }, 500);
          if (!data) return json({ ok: false, error: "not_found" }, 404);
          return json({ ok: true });
        } catch {
          return json({ ok: false, error: "unavailable" }, 503);
        }
      },
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

          const [
            sources,
            evidence,
            findings,
            verifications,
            notes,
            opportunities,
            strengths,
            readerJourney,
            comparables,
            moves,
            roadmap,
            evidenceAssets,
            reports,
          ] = await Promise.all([
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
            db
              .from("audit_strengths")
              .select("*")
              .eq("audit_id", params.id)
              .order("created_at", { ascending: true }),
            db.from("audit_reader_journey").select("*").eq("audit_id", params.id),
            db
              .from("audit_comparables")
              .select("*")
              .eq("audit_id", params.id)
              .order("created_at", { ascending: true }),
            db
              .from("audit_priority_moves")
              .select("*")
              .eq("audit_id", params.id)
              .order("rank", { ascending: true }),
            db
              .from("audit_roadmap_items")
              .select("*")
              .eq("audit_id", params.id)
              .order("week", { ascending: true })
              .order("sort_order", { ascending: true }),
            db
              .from("audit_evidence_assets")
              .select("*")
              .eq("audit_id", params.id)
              .order("created_at", { ascending: false }),
            db
              .from("audit_reports")
              .select("*")
              .eq("audit_id", params.id)
              .order("generated_at", { ascending: false }),
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
            strengths: strengths.data ?? [],
            readerJourney: readerJourney.data ?? [],
            comparables: comparables.data ?? [],
            moves: moves.data ?? [],
            roadmap: roadmap.data ?? [],
            evidenceAssets: evidenceAssets.data ?? [],
            reports: reports.data ?? [],
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
        if (Object.keys(body).length === 0) return json({ ok: false, error: "empty" }, 400);
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = asAuditDb(supabaseAdmin);
          const update: Record<string, unknown> = {};
          if (body.status) {
            update.status = body.status;
            if (body.status === "completed")
              update.client_report_approved_at = new Date().toISOString();
          }
          if (body.preparedByStaffName !== undefined)
            update.prepared_by_staff_name = body.preparedByStaffName;
          if (body.executiveAssessment !== undefined)
            update.executive_assessment = body.executiveAssessment;
          if (body.executiveAssessmentReviewStatus !== undefined)
            update.executive_assessment_review_status = body.executiveAssessmentReviewStatus;
          if (body.executiveAssessmentClientVisible !== undefined)
            update.executive_assessment_client_visible = body.executiveAssessmentClientVisible;

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
