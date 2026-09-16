import { createFileRoute } from "@tanstack/react-router";
import { isAdminRequest } from "@/lib/admin-auth.server";
import { asAuditDb } from "@/lib/author-audit/db";
import { buildReportData } from "@/lib/author-audit/report-data";
import { runQualityCheck } from "@/lib/author-audit/quality-check";
import { renderAuditPdf } from "@/lib/author-audit/pdf-report";
import { renderAuditImage } from "@/lib/author-audit/image-report";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function errorJson(body: unknown, status: number) {
  return new Response(
    JSON.stringify({ ok: false, ...(typeof body === "object" ? body : { error: body }) }),
    {
      status,
      headers: { "content-type": "application/json" },
    },
  );
}

/** Generates the client-facing report from only the findings/evidence/etc
 * staff have explicitly approved (client_visible + review_status:
 * "approved" — enforced once, in buildReportData). `mode=preview` renders
 * without the quality gate or persistence, so staff can see exactly what
 * an author would receive before committing to a version. Anything else
 * runs the quality gate first and, on success, stores a new version in
 * audit_reports and marks prior versions of that format outdated. */
export const Route = createFileRoute("/api/admin/author-audits/$id/report")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        if (!(await isAdminRequest(request))) return errorJson("unauthorized", 401);
        if (!UUID.test(params.id)) return errorJson("not_found", 404);
        const url = new URL(request.url);
        const format = url.searchParams.get("format") === "image" ? "image" : "pdf";
        const isPreview = url.searchParams.get("mode") === "preview";

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          if (!isPreview) {
            const quality = await runQualityCheck(supabaseAdmin, params.id);
            if (!quality.passed) {
              return errorJson(
                {
                  error: "quality_check_failed",
                  issues: quality.issues,
                  warnings: quality.warnings,
                },
                409,
              );
            }
          }

          const data = await buildReportData(supabaseAdmin, params.id);
          if ("error" in data) {
            return errorJson(
              data.error === "no_approved_findings"
                ? "No findings are approved for the client report yet."
                : data.error,
              400,
            );
          }

          const bytes =
            format === "image" ? await renderAuditImage(data) : await renderAuditPdf(data);
          const contentType = format === "image" ? "image/png" : "application/pdf";
          const ext = format === "image" ? "png" : "pdf";
          const filenameSlug = data.book.normalized_title.replace(/\s+/g, "-");

          if (!isPreview) {
            const db = asAuditDb(supabaseAdmin);
            const { data: existing } = await db
              .from("audit_reports")
              .select("id, version")
              .eq("audit_id", params.id)
              .eq("format", format)
              .order("version", { ascending: false })
              .limit(1);
            const priorVersion = (existing as { id: string; version: number }[] | null)?.[0];
            const version = (priorVersion?.version ?? 0) + 1;
            const path = `${params.id}/${format}-v${version}.${ext}`;

            const { error: uploadErr } = await supabaseAdmin.storage
              .from("audit-reports")
              .upload(path, bytes, { contentType, upsert: true });
            if (!uploadErr) {
              const { data: pub } = supabaseAdmin.storage.from("audit-reports").getPublicUrl(path);
              if (priorVersion) {
                await db
                  .from("audit_reports")
                  .update({ outdated: true })
                  .eq("audit_id", params.id)
                  .eq("format", format);
              }
              const { data: auditRow } = await db
                .from("author_audits")
                .select("prepared_by_staff_name")
                .eq("id", params.id)
                .single();
              await db.from("audit_reports").insert({
                audit_id: params.id,
                format,
                version,
                generated_by: (auditRow as { prepared_by_staff_name: string | null } | null)
                  ?.prepared_by_staff_name,
                storage_url: pub.publicUrl,
                approval_state: "draft",
                outdated: false,
              });
            } else {
              console.error("[admin/author-audits/:id/report] upload failed", uploadErr.message);
            }
          }

          return new Response(new Uint8Array(bytes), {
            headers: {
              "content-type": contentType,
              "content-disposition": `inline; filename="hq360-audit-${filenameSlug}.${ext}"`,
            },
          });
        } catch (err) {
          const detail = err instanceof Error ? err.message : String(err);
          console.error("[admin/author-audits/:id/report] GET", detail);
          // Temporarily surface the real error to the (admin-only) caller —
          // this route was returning a generic "unavailable" in production
          // while working locally, so the actual cause needs to be visible
          // to diagnose. Safe here since this route already requires admin
          // auth; not something to leave on a public route.
          return errorJson({ error: "unavailable", detail }, 503);
        }
      },
    },
  },
});
