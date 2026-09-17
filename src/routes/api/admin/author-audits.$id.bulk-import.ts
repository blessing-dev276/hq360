import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { isAdminRequest } from "@/lib/admin-auth.server";
import { asAuditDb, type AuditStatus } from "@/lib/author-audit/db";
import { clientDb } from "@/lib/author-audit/client-access.server";
import { buildReportData } from "@/lib/author-audit/report-data";
import { runQualityCheck } from "@/lib/author-audit/quality-check";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const REVIEW_STAGE_ORDER: AuditStatus[] = [
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

const findingSchema = z.object({
  key: z.string().min(1),
  title: z.string().max(300).optional(),
  category: z.string().max(200).optional(),
  observation: z.string().min(1),
  whyItMatters: z.string().optional(),
  recommendation: z.string().optional(),
  status: z.enum([
    "strong",
    "healthy",
    "opportunity_identified",
    "needs_attention",
    "critical_issue",
    "unable_to_verify",
  ]),
  priority: z.enum(["immediate", "high_impact", "medium_priority", "long_term", "optional"]),
  effort: z.enum(["low", "medium", "high"]).optional(),
  potentialImpact: z.enum(["low", "medium", "high"]).optional(),
  sourceUrls: z.array(z.string().max(2000)).max(10).optional(),
  retrievedAt: z.string().optional(),
  capabilitySlug: z.string().max(200).optional(),
});

const strengthSchema = z.object({
  title: z.string().min(1).max(200),
  observation: z.string().min(1),
  evidence: z.string().optional(),
  sourceUrls: z.array(z.string().max(2000)).max(10).optional(),
  retrievedAt: z.string().optional(),
  disposition: z.enum(["preserve", "build_upon", "no_change_needed"]).optional(),
});

const journeySchema = z.object({
  stage: z.enum([
    "discovery",
    "interest",
    "trust",
    "book_information",
    "purchase",
    "follow",
    "owned_audience",
    "next_book",
  ]),
  status: z.enum([
    "strong",
    "functional",
    "friction_identified",
    "opportunity_identified",
    "unable_to_verify",
  ]),
  observation: z.string().min(1),
  evidence: z.string().optional(),
  friction: z.string().optional(),
  recommendation: z.string().optional(),
  sourceUrls: z.array(z.string().max(2000)).max(10).optional(),
  retrievedAt: z.string().optional(),
});

const comparableSchema = z.object({
  author: z.string().min(1).max(200),
  book: z.string().max(300).optional(),
  genreRelationship: z.string().max(500).optional(),
  whyComparable: z.string().min(1).max(2000),
  websiteUrl: z.string().max(2000).optional(),
  retailerUrl: z.string().max(2000).optional(),
  goodreadsUrl: z.string().max(2000).optional(),
  positioningNotes: z.string().max(2000).optional(),
  readerPathwayNotes: z.string().max(2000).optional(),
  newsletterNotes: z.string().max(2000).optional(),
  mediaNotes: z.string().max(2000).optional(),
  contentStrategyNotes: z.string().max(2000).optional(),
  strengthsNotes: z.string().max(2000).optional(),
  differencesNotes: z.string().max(2000).optional(),
  // Required (not just optional) — the publish gate rejects any comparable
  // missing a source or a retrieval date, so catch that at import time.
  sourceUrls: z.array(z.string().max(2000)).min(1).max(10),
  retrievedAt: z.string().min(1),
});

const moveSchema = z.object({
  rank: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  title: z.string().min(1).max(200),
  whatWeFound: z.string().min(1),
  evidence: z.string().optional(),
  whatWeWouldChange: z.string().min(1),
  whyFirst: z.string().min(1),
  enablesNext: z.string().optional(),
  successIndicator: z.string().optional(),
  capabilitySlug: z.string().max(200).optional(),
  // Must resolve to real findings — an unreferenced move is dropped from the
  // client report and the publish gate requires exactly 3.
  basedOnFindingKeys: z.array(z.string()).min(1),
});

const roadmapSchema = z.object({
  week: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  action: z.string().min(1),
  reason: z.string().optional(),
  dependency: z.string().optional(),
  priority: z
    .enum(["immediate", "high_impact", "medium_priority", "long_term", "optional"])
    .optional(),
  capabilitySlug: z.string().max(200).optional(),
  completionIndicator: z.string().optional(),
  sortOrder: z.number().int().optional(),
  basedOnFindingKeys: z.array(z.string()).optional(),
});

const evidenceAssetSchema = z.object({
  storageUrl: z.string().min(1),
  caption: z.string().optional(),
  source: z.string().optional(),
  assetDate: z.string().optional(),
  findingKey: z.string().optional(),
});

const executiveAssessmentSchema = z.object({
  whatIsWorking: z.string(),
  strongestOpportunities: z.string(),
  journeyBreaks: z.string(),
  comparablePatterns: z.string(),
  priorityFirst: z.string(),
  doNotChange: z.string(),
  unknowns: z.string(),
});

const bulkSchema = z.object({
  preparedByStaffName: z.string().max(200).optional(),
  executiveAssessment: executiveAssessmentSchema.optional(),
  findings: z.array(findingSchema).min(1),
  strengths: z.array(strengthSchema).min(1),
  readerJourney: z.array(journeySchema).optional(),
  comparables: z.array(comparableSchema).min(3).max(5),
  moves: z.array(moveSchema).length(3),
  roadmap: z.array(roadmapSchema).optional(),
  evidenceAssets: z.array(evidenceAssetSchema).min(1),
});

/**
 * One-shot import: an admin pastes a single JSON payload covering every
 * section normally filled in across the Verify/Review/Plan/Report stages
 * (findings, strengths, reader journey, comparables, 3 priority moves,
 * roadmap, evidence assets, executive assessment). Everything is inserted
 * pre-approved and client-visible, the audit status is advanced, and — if
 * the result already clears the publish gate — a client version snapshot is
 * drafted automatically, so the only step left in the UI is ticking the QA
 * checklist and clicking Publish.
 *
 * Replaces (deletes then reinserts) the reviewable v2 tables for this audit,
 * so re-running the import with a corrected payload is always safe.
 */
export const Route = createFileRoute("/api/admin/author-audits/$id/bulk-import")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        if (!(await isAdminRequest(request)))
          return json({ ok: false, error: "unauthorized" }, 401);
        if (!UUID.test(params.id)) return json({ ok: false, error: "not_found" }, 404);

        let body: z.infer<typeof bulkSchema>;
        try {
          body = bulkSchema.parse(await request.json());
        } catch (err) {
          return json(
            {
              ok: false,
              error: "invalid",
              details: err instanceof z.ZodError ? err.issues : undefined,
            },
            400,
          );
        }

        const keys = body.findings.map((f) => f.key);
        if (new Set(keys).size !== keys.length) {
          return json({ ok: false, error: "duplicate_finding_keys" }, 400);
        }
        const keySet = new Set(keys);
        for (const move of body.moves) {
          if (!move.basedOnFindingKeys.every((k) => keySet.has(k))) {
            return json(
              { ok: false, error: "unknown_finding_key", area: "moves", move: move.title },
              400,
            );
          }
        }
        for (const item of body.roadmap ?? []) {
          if ((item.basedOnFindingKeys ?? []).some((k) => !keySet.has(k))) {
            return json(
              { ok: false, error: "unknown_finding_key", area: "roadmap", action: item.action },
              400,
            );
          }
        }
        for (const asset of body.evidenceAssets) {
          if (asset.findingKey && !keySet.has(asset.findingKey)) {
            return json(
              { ok: false, error: "unknown_finding_key", area: "evidenceAssets" },
              400,
            );
          }
        }

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = asAuditDb(supabaseAdmin);
          const auditId = params.id;

          // Replace, don't merge — a re-run with a corrected payload should
          // always leave a clean, fully-consistent set of rows.
          for (const table of [
            "audit_evidence_assets",
            "audit_roadmap_items",
            "audit_priority_moves",
            "audit_comparables",
            "audit_reader_journey",
            "audit_strengths",
            "audit_findings",
          ] as const) {
            const { error } = await db.from(table).delete().eq("audit_id", auditId);
            if (error) throw new Error(`Could not clear existing ${table}: ${error.message}`);
          }

          const { data: findingRows, error: findingsError } = await db
            .from("audit_findings")
            .insert(
              body.findings.map((f) => ({
                audit_id: auditId,
                section: f.category ?? f.title ?? "General",
                title: f.title ?? null,
                category: f.category ?? null,
                observation: f.observation,
                why_it_matters: f.whyItMatters ?? null,
                recommendation: f.recommendation ?? null,
                status: f.status,
                priority: f.priority,
                effort: f.effort ?? null,
                potential_impact: f.potentialImpact ?? null,
                source_urls: f.sourceUrls ?? [],
                retrieved_at: f.retrievedAt ?? null,
                capability_slug: f.capabilitySlug ?? null,
                review_status: "approved",
                client_visible: true,
              })),
            )
            .select("id");
          if (findingsError || !findingRows) throw new Error("Could not save findings");
          const findingIdByKey = new Map(body.findings.map((f, i) => [f.key, findingRows[i]!.id]));

          if (body.strengths.length) {
            const { error } = await db.from("audit_strengths").insert(
              body.strengths.map((s) => ({
                audit_id: auditId,
                title: s.title,
                observation: s.observation,
                evidence: s.evidence ?? null,
                source_urls: s.sourceUrls ?? [],
                retrieved_at: s.retrievedAt ?? null,
                disposition: s.disposition ?? null,
                review_status: "approved",
                client_visible: true,
              })),
            );
            if (error) throw new Error("Could not save strengths");
          }

          if (body.readerJourney?.length) {
            const { error } = await db.from("audit_reader_journey").insert(
              body.readerJourney.map((j) => ({
                audit_id: auditId,
                stage: j.stage,
                status: j.status,
                observation: j.observation,
                evidence: j.evidence ?? null,
                friction: j.friction ?? null,
                recommendation: j.recommendation ?? null,
                source_urls: j.sourceUrls ?? [],
                retrieved_at: j.retrievedAt ?? null,
                review_status: "approved",
                client_visible: true,
              })),
            );
            if (error) throw new Error("Could not save the reader journey");
          }

          {
            const { error } = await db.from("audit_comparables").insert(
              body.comparables.map((c) => ({
                audit_id: auditId,
                author: c.author,
                book: c.book ?? null,
                genre_relationship: c.genreRelationship ?? null,
                why_comparable: c.whyComparable,
                website_url: c.websiteUrl ?? null,
                retailer_url: c.retailerUrl ?? null,
                goodreads_url: c.goodreadsUrl ?? null,
                positioning_notes: c.positioningNotes ?? null,
                reader_pathway_notes: c.readerPathwayNotes ?? null,
                newsletter_notes: c.newsletterNotes ?? null,
                media_notes: c.mediaNotes ?? null,
                content_strategy_notes: c.contentStrategyNotes ?? null,
                strengths_notes: c.strengthsNotes ?? null,
                differences_notes: c.differencesNotes ?? null,
                source_urls: c.sourceUrls,
                retrieved_at: c.retrievedAt,
                added_by: "staff",
                review_status: "approved",
                client_visible: true,
              })),
            );
            if (error) throw new Error("Could not save comparables");
          }

          {
            const { error } = await db.from("audit_priority_moves").insert(
              body.moves.map((m) => ({
                audit_id: auditId,
                rank: m.rank,
                title: m.title,
                what_we_found: m.whatWeFound,
                evidence: m.evidence ?? null,
                what_we_would_change: m.whatWeWouldChange,
                why_first: m.whyFirst,
                enables_next: m.enablesNext ?? null,
                success_indicator: m.successIndicator ?? null,
                capability_slug: m.capabilitySlug ?? null,
                based_on_finding_ids: m.basedOnFindingKeys.map((k) => findingIdByKey.get(k)),
                review_status: "approved",
                client_visible: true,
              })),
            );
            if (error) throw new Error("Could not save the 3 priority moves");
          }

          if (body.roadmap?.length) {
            const { error } = await db.from("audit_roadmap_items").insert(
              body.roadmap.map((r, i) => ({
                audit_id: auditId,
                week: r.week,
                action: r.action,
                reason: r.reason ?? null,
                dependency: r.dependency ?? null,
                priority: r.priority ?? null,
                capability_slug: r.capabilitySlug ?? null,
                completion_indicator: r.completionIndicator ?? null,
                sort_order: r.sortOrder ?? i,
                based_on_finding_ids: (r.basedOnFindingKeys ?? []).map((k) =>
                  findingIdByKey.get(k),
                ),
                review_status: "approved",
                client_visible: true,
              })),
            );
            if (error) throw new Error("Could not save the 30-day roadmap");
          }

          {
            const { error } = await db.from("audit_evidence_assets").insert(
              body.evidenceAssets.map((a) => ({
                audit_id: auditId,
                finding_id: a.findingKey ? findingIdByKey.get(a.findingKey) : null,
                storage_url: a.storageUrl,
                caption: a.caption ?? null,
                source: a.source ?? null,
                asset_date: a.assetDate ?? null,
                client_visible: true,
              })),
            );
            if (error) throw new Error("Could not save evidence assets");
          }

          const auditPatch: Record<string, unknown> = {};
          if (body.preparedByStaffName) auditPatch.prepared_by_staff_name = body.preparedByStaffName;
          if (body.executiveAssessment) {
            auditPatch.executive_assessment = body.executiveAssessment;
            auditPatch.executive_assessment_review_status = "approved";
            auditPatch.executive_assessment_client_visible = true;
          }
          const { data: currentAudit } = await db
            .from("author_audits")
            .select("status")
            .eq("id", auditId)
            .single();
          const currentStatus = (currentAudit as { status: AuditStatus } | null)?.status;
          const currentIndex = currentStatus ? REVIEW_STAGE_ORDER.indexOf(currentStatus) : -1;
          const completedIndex = REVIEW_STAGE_ORDER.indexOf("completed");
          if (currentIndex < completedIndex) auditPatch.status = "completed";
          if (Object.keys(auditPatch).length) {
            const { error } = await db.from("author_audits").update(auditPatch).eq("id", auditId);
            if (error) throw new Error("Could not update the audit record");
          }

          const quality = await runQualityCheck(supabaseAdmin, auditId);
          const report = await buildReportData(supabaseAdmin, auditId);
          let versionId: string | null = null;
          if (!("error" in report)) {
            const { data: version, error: versionError } = await clientDb()
              .from("audit_client_versions")
              .insert({ audit_id: auditId, snapshot: report })
              .select("id")
              .single();
            if (!versionError && version) versionId = (version as { id: string }).id;
          }

          return json({
            ok: true,
            findingIds: Object.fromEntries(findingIdByKey),
            quality,
            reportReady: !("error" in report),
            versionId,
          });
        } catch (err) {
          console.error(
            "[admin/author-audits/:id/bulk-import] POST",
            err instanceof Error ? err.message : err,
          );
          return json(
            { ok: false, error: err instanceof Error ? err.message : "unavailable" },
            500,
          );
        }
      },
    },
  },
});
