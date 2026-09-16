import { createFileRoute } from "@tanstack/react-router";
import { isAdminRequest } from "@/lib/admin-auth.server";
import { asAuditDb, type Author, type AuditSource, type Book } from "@/lib/author-audit/db";
import { synthesizeAudit } from "@/lib/author-audit/synthesize";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Sends everything gathered so far (automated sources + manual
 * verifications) to Claude for structured, evidence-only synthesis, then
 * writes the result as audit_evidence / audit_findings / service_opportunities
 * rows — all starting unreviewed (review_status: "ai_research",
 * client_visible: false) until staff approve them individually. */
export const Route = createFileRoute("/api/admin/author-audits/$id/synthesize")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        if (!(await isAdminRequest(request)))
          return json({ ok: false, error: "unauthorized" }, 401);
        if (!UUID.test(params.id)) return json({ ok: false, error: "not_found" }, 404);
        if (!process.env.ANTHROPIC_API_KEY)
          return json({ ok: false, error: "ANTHROPIC_API_KEY not set" }, 503);

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = asAuditDb(supabaseAdmin);

          const { data: audit } = await db
            .from("author_audits")
            .select("*, authors(*), books(*)")
            .eq("id", params.id)
            .single();
          if (!audit) return json({ ok: false, error: "not_found" }, 404);
          const record = audit as unknown as {
            authors: Author;
            books: Book;
            input_snapshot: Record<string, unknown>;
          };

          const [{ data: sources }, { data: verifications }] = await Promise.all([
            db.from("audit_sources").select("*").eq("audit_id", params.id),
            db.from("audit_manual_verifications").select("*").eq("audit_id", params.id),
          ]);

          const sourceRows = (sources ?? []) as AuditSource[];
          const verificationRows = (verifications ?? []) as {
            field_key: string;
            value: string | null;
            verification_status: string;
          }[];

          if (sourceRows.length === 0 && verificationRows.length === 0)
            return json({ ok: false, error: "no_evidence" }, 400);

          const result = await synthesizeAudit({
            audit: {
              authorName: record.authors.name,
              bookTitle: record.books.title,
              websiteUrl: record.authors.website_url,
            },
            sources: sourceRows.map((s) => ({
              provider: s.provider,
              sourceType: s.source_type,
              url: s.url,
              status: s.status,
              data: s.raw_data,
              error: s.error_message,
            })),
            manualVerifications: verificationRows.map((v) => ({
              fieldKey: v.field_key,
              value: v.value,
              verificationStatus: v.verification_status,
            })),
          });

          const { data: insertedEvidence, error: evidenceErr } = await db
            .from("audit_evidence")
            .insert(
              result.evidence.map((e) => ({
                audit_id: params.id,
                section: e.section,
                claim: e.claim,
                excerpt: e.excerpt,
                url: e.url,
                verification_status: e.verificationStatus,
                confidence: e.confidence,
                client_safe:
                  e.verificationStatus === "verified" || e.verificationStatus === "likely",
              })),
            )
            .select("id");
          if (evidenceErr) return json({ ok: false, error: "storage" }, 500);
          const evidenceIds = (insertedEvidence ?? []).map((e) => (e as { id: string }).id);

          for (const finding of result.findings) {
            const { data: insertedFinding, error: findingErr } = await db
              .from("audit_findings")
              .insert({
                audit_id: params.id,
                section: finding.section,
                observation: finding.observation,
                why_it_matters: finding.whyItMatters,
                recommendation: finding.recommendation,
                status: finding.status,
                priority: finding.priority,
                effort: finding.effort,
                potential_impact: finding.potentialImpact,
                review_status: "ai_research",
                client_visible: false,
              })
              .select("id")
              .single();
            if (findingErr || !insertedFinding) continue;
            const findingId = (insertedFinding as { id: string }).id;

            if (finding.serviceOpportunity) {
              await db.from("service_opportunities").insert({
                audit_id: params.id,
                finding_id: findingId,
                capability_slug: finding.serviceOpportunity.capabilitySlug,
                rationale: finding.serviceOpportunity.rationale,
                status: "suggested",
                internal_only: true,
              });
            }
          }

          await db
            .from("author_audits")
            .update({
              status: "ready_for_review",
              input_snapshot: {
                ...record.input_snapshot,
                executiveSummary: result.executiveSummary,
                strengths: result.strengths,
              },
            })
            .eq("id", params.id);

          return json({
            ok: true,
            evidenceCount: evidenceIds.length,
            findingCount: result.findings.length,
            executiveSummary: result.executiveSummary,
            strengths: result.strengths,
          });
        } catch (err) {
          console.error(
            "[admin/author-audits/:id/synthesize] POST",
            err instanceof Error ? err.message : err,
          );
          return json(
            { ok: false, error: err instanceof Error ? err.message : "unavailable" },
            503,
          );
        }
      },
    },
  },
});
