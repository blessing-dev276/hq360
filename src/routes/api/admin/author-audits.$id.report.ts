import { createFileRoute } from "@tanstack/react-router";
import { isAdminRequest } from "@/lib/admin-auth.server";
import {
  asAuditDb,
  type Author,
  type AuditEvidence,
  type AuditFinding,
  type Book,
} from "@/lib/author-audit/db";
import { renderAuditPdf } from "@/lib/author-audit/pdf-report";
import { renderAuditImage } from "@/lib/author-audit/image-report";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function errorJson(error: string, status: number) {
  return new Response(JSON.stringify({ ok: false, error }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Generates the client-facing report from only the findings/evidence staff
 * have explicitly approved (client_visible / client_safe). Nothing an
 * author sees here skipped human review. */
export const Route = createFileRoute("/api/admin/author-audits/$id/report")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        if (!(await isAdminRequest(request))) return errorJson("unauthorized", 401);
        if (!UUID.test(params.id)) return errorJson("not_found", 404);
        const url = new URL(request.url);
        const format = url.searchParams.get("format") === "image" ? "image" : "pdf";

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = asAuditDb(supabaseAdmin);

          const { data: audit } = await db
            .from("author_audits")
            .select("*, authors(*), books(*)")
            .eq("id", params.id)
            .single();
          if (!audit) return errorJson("not_found", 404);
          const record = audit as unknown as {
            authors: Author;
            books: Book;
            input_snapshot: { executiveSummary?: string; strengths?: string[] };
          };

          const [{ data: findings }, { data: evidence }] = await Promise.all([
            db
              .from("audit_findings")
              .select("*")
              .eq("audit_id", params.id)
              .eq("client_visible", true),
            db.from("audit_evidence").select("*").eq("audit_id", params.id).eq("client_safe", true),
          ]);

          const findingRows = (findings ?? []) as AuditFinding[];
          const evidenceRows = (evidence ?? []) as AuditEvidence[];

          if (findingRows.length === 0)
            return errorJson("No findings are approved for the client report yet", 400);

          const executiveSummary =
            record.input_snapshot.executiveSummary ??
            "This audit reflects only what could be verified from the evidence gathered.";
          const strengths = record.input_snapshot.strengths ?? [];

          if (format === "image") {
            const png = await renderAuditImage({
              authorName: record.authors.name,
              bookTitle: record.books.title,
              strengths,
              findings: findingRows,
            });
            return new Response(new Uint8Array(png), {
              headers: {
                "content-type": "image/png",
                "content-disposition": `inline; filename="hq360-audit-${record.books.normalized_title.replace(/\s+/g, "-")}.png"`,
              },
            });
          }

          const pdf = await renderAuditPdf({
            authorName: record.authors.name,
            bookTitle: record.books.title,
            preparedDate: new Date().toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            }),
            executiveSummary,
            strengths,
            findings: findingRows,
            evidence: evidenceRows,
          });
          return new Response(new Uint8Array(pdf), {
            headers: {
              "content-type": "application/pdf",
              "content-disposition": `inline; filename="hq360-audit-${record.books.normalized_title.replace(/\s+/g, "-")}.pdf"`,
            },
          });
        } catch (err) {
          console.error(
            "[admin/author-audits/:id/report] GET",
            err instanceof Error ? err.message : err,
          );
          return errorJson("unavailable", 503);
        }
      },
    },
  },
});
