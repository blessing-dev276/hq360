import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { isAdminRequest } from "@/lib/admin-auth.server";
import { asAuditDb } from "@/lib/author-audit/db";
import { reviewSchema, reviewUpdate } from "@/lib/author-audit/review";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const schema = reviewSchema.extend({
  author: z.string().min(1).max(200).optional(),
  book: z.string().max(300).nullable().optional(),
  whyComparable: z.string().min(1).max(2000).optional(),
  websiteUrl: z.string().max(2000).nullable().optional(),
  retailerUrl: z.string().max(2000).nullable().optional(),
  goodreadsUrl: z.string().max(2000).nullable().optional(),
  positioningNotes: z.string().max(2000).nullable().optional(),
  readerPathwayNotes: z.string().max(2000).nullable().optional(),
  newsletterNotes: z.string().max(2000).nullable().optional(),
  mediaNotes: z.string().max(2000).nullable().optional(),
  contentStrategyNotes: z.string().max(2000).nullable().optional(),
  strengthsNotes: z.string().max(2000).nullable().optional(),
  differencesNotes: z.string().max(2000).nullable().optional(),
});

export const Route = createFileRoute("/api/admin/author-audits/$id/comparables/$comparableId")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        if (!(await isAdminRequest(request)))
          return json({ ok: false, error: "unauthorized" }, 401);
        if (!UUID.test(params.id) || !UUID.test(params.comparableId))
          return json({ ok: false, error: "not_found" }, 404);
        let body: z.infer<typeof schema>;
        try {
          body = schema.parse(await request.json());
        } catch {
          return json({ ok: false, error: "invalid" }, 400);
        }

        const update: Record<string, unknown> = { ...reviewUpdate(body) };
        if (body.author !== undefined) update.author = body.author;
        if (body.book !== undefined) update.book = body.book;
        if (body.whyComparable !== undefined) update.why_comparable = body.whyComparable;
        if (body.websiteUrl !== undefined) update.website_url = body.websiteUrl;
        if (body.retailerUrl !== undefined) update.retailer_url = body.retailerUrl;
        if (body.goodreadsUrl !== undefined) update.goodreads_url = body.goodreadsUrl;
        if (body.positioningNotes !== undefined) update.positioning_notes = body.positioningNotes;
        if (body.readerPathwayNotes !== undefined)
          update.reader_pathway_notes = body.readerPathwayNotes;
        if (body.newsletterNotes !== undefined) update.newsletter_notes = body.newsletterNotes;
        if (body.mediaNotes !== undefined) update.media_notes = body.mediaNotes;
        if (body.contentStrategyNotes !== undefined)
          update.content_strategy_notes = body.contentStrategyNotes;
        if (body.strengthsNotes !== undefined) update.strengths_notes = body.strengthsNotes;
        if (body.differencesNotes !== undefined) update.differences_notes = body.differencesNotes;
        if (Object.keys(update).length === 0) return json({ ok: false, error: "empty" }, 400);

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = asAuditDb(supabaseAdmin);
          const { data, error } = await db
            .from("audit_comparables")
            .update(update)
            .eq("id", params.comparableId)
            .eq("audit_id", params.id)
            .select("*")
            .single();
          if (error || !data) return json({ ok: false, error: "storage" }, 500);
          return json({ ok: true, item: data });
        } catch (err) {
          console.error(
            "[admin/author-audits/:id/comparables/:comparableId] PATCH",
            err instanceof Error ? err.message : err,
          );
          return json({ ok: false, error: "unavailable" }, 503);
        }
      },
      DELETE: async ({ request, params }) => {
        if (!(await isAdminRequest(request)))
          return json({ ok: false, error: "unauthorized" }, 401);
        if (!UUID.test(params.id) || !UUID.test(params.comparableId))
          return json({ ok: false, error: "not_found" }, 404);
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = asAuditDb(supabaseAdmin);
          const { error } = await db
            .from("audit_comparables")
            .delete()
            .eq("id", params.comparableId)
            .eq("audit_id", params.id);
          if (error) return json({ ok: false, error: "storage" }, 500);
          return json({ ok: true });
        } catch (err) {
          console.error(
            "[admin/author-audits/:id/comparables/:comparableId] DELETE",
            err instanceof Error ? err.message : err,
          );
          return json({ ok: false, error: "unavailable" }, 503);
        }
      },
    },
  },
});
