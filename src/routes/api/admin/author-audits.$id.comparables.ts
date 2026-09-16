import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { isAdminRequest } from "@/lib/admin-auth.server";
import { asAuditDb } from "@/lib/author-audit/db";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Comparables are staff-entered only — see the migration note: without a
 * real search/discovery tool wired in, "auto-discovering" a comparable
 * author would mean inventing one, which the audit's no-fabrication rule
 * forbids. `added_by` stays "staff" here; "auto" is reserved for when a
 * real source is connected. */
const createSchema = z.object({
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
  sourceUrls: z.array(z.string().max(2000)).max(10).optional(),
});

export const Route = createFileRoute("/api/admin/author-audits/$id/comparables")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        if (!(await isAdminRequest(request)))
          return json({ ok: false, error: "unauthorized" }, 401);
        if (!UUID.test(params.id)) return json({ ok: false, error: "not_found" }, 404);
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = asAuditDb(supabaseAdmin);
          const { data, error } = await db
            .from("audit_comparables")
            .select("*")
            .eq("audit_id", params.id)
            .order("created_at", { ascending: true });
          if (error) return json({ ok: false, error: "storage" }, 500);
          return json({ ok: true, items: data ?? [] });
        } catch (err) {
          console.error(
            "[admin/author-audits/:id/comparables] GET",
            err instanceof Error ? err.message : err,
          );
          return json({ ok: false, error: "unavailable" }, 503);
        }
      },
      POST: async ({ request, params }) => {
        if (!(await isAdminRequest(request)))
          return json({ ok: false, error: "unauthorized" }, 401);
        if (!UUID.test(params.id)) return json({ ok: false, error: "not_found" }, 404);
        let body: z.infer<typeof createSchema>;
        try {
          body = createSchema.parse(await request.json());
        } catch {
          return json({ ok: false, error: "invalid" }, 400);
        }
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = asAuditDb(supabaseAdmin);
          const { data, error } = await db
            .from("audit_comparables")
            .insert({
              audit_id: params.id,
              author: body.author,
              book: body.book || null,
              genre_relationship: body.genreRelationship || null,
              why_comparable: body.whyComparable,
              website_url: body.websiteUrl || null,
              retailer_url: body.retailerUrl || null,
              goodreads_url: body.goodreadsUrl || null,
              positioning_notes: body.positioningNotes || null,
              reader_pathway_notes: body.readerPathwayNotes || null,
              newsletter_notes: body.newsletterNotes || null,
              media_notes: body.mediaNotes || null,
              content_strategy_notes: body.contentStrategyNotes || null,
              strengths_notes: body.strengthsNotes || null,
              differences_notes: body.differencesNotes || null,
              source_urls: body.sourceUrls ?? [],
              retrieved_at: new Date().toISOString(),
              added_by: "staff",
              review_status: "needs_verification",
              client_visible: false,
            })
            .select("*")
            .single();
          if (error || !data) return json({ ok: false, error: "storage" }, 500);
          return json({ ok: true, item: data }, 201);
        } catch (err) {
          console.error(
            "[admin/author-audits/:id/comparables] POST",
            err instanceof Error ? err.message : err,
          );
          return json({ ok: false, error: "unavailable" }, 503);
        }
      },
    },
  },
});
