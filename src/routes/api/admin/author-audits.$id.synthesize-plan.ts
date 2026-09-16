import { createFileRoute } from "@tanstack/react-router";
import { isAdminRequest } from "@/lib/admin-auth.server";
import {
  asAuditDb,
  type Author,
  type AuditFindingStatus,
  type Book,
  type Priority,
  type ReaderJourneyStage,
  type ReaderJourneyStatus,
} from "@/lib/author-audit/db";
import { synthesizeStrategicPlan } from "@/lib/author-audit/synthesize";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Phase B: builds the executive assessment, the 3 moves, and the 30-day
 * roadmap from ONLY the findings/strengths/reader-journey/comparables staff
 * have already approved (client_visible: true, review_status: "approved").
 * This has to run after Phase A review, not alongside it — the whole point
 * is that the strategic layer is built from what HQ360 actually stands
 * behind, not raw AI output. Everything this writes is itself unreviewed
 * (client_visible: false) until staff approve it too. */
export const Route = createFileRoute("/api/admin/author-audits/$id/synthesize-plan")({
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
          const record = audit as unknown as { authors: Author; books: Book };

          const [
            { data: findings },
            { data: strengths },
            { data: journey },
            { data: comparables },
          ] = await Promise.all([
            db
              .from("audit_findings")
              .select("*")
              .eq("audit_id", params.id)
              .eq("client_visible", true)
              .eq("review_status", "approved"),
            db
              .from("audit_strengths")
              .select("*")
              .eq("audit_id", params.id)
              .eq("client_visible", true)
              .eq("review_status", "approved"),
            db
              .from("audit_reader_journey")
              .select("*")
              .eq("audit_id", params.id)
              .eq("client_visible", true)
              .eq("review_status", "approved"),
            db
              .from("audit_comparables")
              .select("*")
              .eq("audit_id", params.id)
              .eq("client_visible", true)
              .eq("review_status", "approved"),
          ]);

          type FindingRow = {
            id: string;
            title: string | null;
            category: string | null;
            observation: string;
            why_it_matters: string | null;
            recommendation: string | null;
            status: AuditFindingStatus;
            priority: Priority;
          };
          const findingRows = (findings ?? []) as FindingRow[];

          if (findingRows.length === 0)
            return json(
              {
                ok: false,
                error:
                  "No approved findings yet — approve at least one before generating the strategic plan.",
              },
              400,
            );

          type StrengthRow = { title: string; observation: string };
          type JourneyRow = {
            stage: ReaderJourneyStage;
            status: ReaderJourneyStatus;
            observation: string;
            friction: string | null;
          };
          type ComparableRow = {
            author: string;
            book: string | null;
            why_comparable: string;
            reader_pathway_notes: string | null;
            newsletter_notes: string | null;
            positioning_notes: string | null;
          };

          const result = await synthesizeStrategicPlan({
            audit: { authorName: record.authors.name, bookTitle: record.books.title },
            approvedFindings: findingRows.map((f) => ({
              id: f.id,
              title: f.title ?? f.category ?? "Finding",
              category: f.category ?? "",
              observation: f.observation,
              why_it_matters: f.why_it_matters,
              recommendation: f.recommendation,
              status: f.status,
              priority: f.priority,
            })),
            approvedStrengths: ((strengths as StrengthRow[] | null) ?? []).map((s) => ({
              title: s.title,
              observation: s.observation,
            })),
            approvedJourney: ((journey as JourneyRow[] | null) ?? []).map((j) => ({
              stage: j.stage,
              status: j.status,
              observation: j.observation,
              friction: j.friction,
            })),
            approvedComparables: ((comparables as ComparableRow[] | null) ?? []).map((c) => ({
              author: c.author,
              book: c.book,
              why_comparable: c.why_comparable,
              reader_pathway_notes: c.reader_pathway_notes,
              newsletter_notes: c.newsletter_notes,
              positioning_notes: c.positioning_notes,
            })),
          });

          await db
            .from("author_audits")
            .update({
              executive_assessment: result.executiveAssessment,
              executive_assessment_review_status: "ai_research",
              executive_assessment_client_visible: false,
            })
            .eq("id", params.id);

          // Replace any prior draft plan rather than accumulating duplicates
          // across re-runs.
          await db.from("audit_priority_moves").delete().eq("audit_id", params.id);
          await db.from("audit_roadmap_items").delete().eq("audit_id", params.id);

          if (result.moves.length > 0) {
            await db.from("audit_priority_moves").insert(
              result.moves.map((m) => ({
                audit_id: params.id,
                rank: m.rank,
                title: m.title,
                what_we_found: m.whatWeFound,
                evidence: m.evidence,
                what_we_would_change: m.whatWeWouldChange,
                why_first: m.whyFirst,
                enables_next: m.enablesNext,
                success_indicator: m.successIndicator,
                capability_slug: m.capabilitySlug,
                based_on_finding_ids: m.basedOnFindingIds,
                review_status: "ai_research",
                client_visible: false,
              })),
            );
          }

          if (result.roadmap.length > 0) {
            await db.from("audit_roadmap_items").insert(
              result.roadmap.map((r, i) => ({
                audit_id: params.id,
                week: r.week,
                action: r.action,
                reason: r.reason,
                dependency: r.dependency,
                priority: r.priority,
                capability_slug: r.capabilitySlug,
                completion_indicator: r.completionIndicator,
                sort_order: i,
                based_on_finding_ids: r.basedOnFindingIds,
                review_status: "ai_research",
                client_visible: false,
              })),
            );
          }

          return json({
            ok: true,
            moveCount: result.moves.length,
            roadmapCount: result.roadmap.length,
          });
        } catch (err) {
          console.error(
            "[admin/author-audits/:id/synthesize-plan] POST",
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
