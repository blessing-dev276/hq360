import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { isAdminRequest } from "@/lib/admin-auth.server";
import { caseStudyFields, normalizeMedia, serializeCaseStudy } from "@/lib/case-study-shape";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const patchSchema = z
  .object({
    slug: caseStudyFields.slug.optional(),
    status: caseStudyFields.status.optional(),
    title: caseStudyFields.title.optional(),
    client: caseStudyFields.client,
    industry: caseStudyFields.industry,
    capabilities: caseStudyFields.capabilities.optional(),
    summary: caseStudyFields.summary,
    challenge: caseStudyFields.challenge,
    approach: caseStudyFields.approach.optional(),
    deliverables: caseStudyFields.deliverables.optional(),
    outcome: caseStudyFields.outcome,
    metrics: caseStudyFields.metrics.optional(),
    testimonial: caseStudyFields.testimonial.optional(),
    media: caseStudyFields.media.optional(),
    published: z.boolean().optional(),
  })
  .partial();

export const Route = createFileRoute("/api/admin/case-studies/$id")({
  server: {
    handlers: {
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

        const update: TablesUpdate<"case_studies"> = {};
        if (body.slug !== undefined) update.slug = body.slug;
        if (body.status !== undefined) update.status = body.status;
        if (body.title !== undefined) update.title = body.title;
        if (body.client !== undefined) update.client = body.client || "";
        if (body.industry !== undefined) update.industry = body.industry || "";
        if (body.capabilities !== undefined) update.capabilities = body.capabilities;
        if (body.summary !== undefined) update.summary = body.summary || "";
        if (body.challenge !== undefined) update.challenge = body.challenge || "";
        if (body.approach !== undefined) update.approach = body.approach;
        if (body.deliverables !== undefined) update.deliverables = body.deliverables;
        if (body.outcome !== undefined) update.outcome = body.outcome || "";
        if (body.metrics !== undefined) update.metrics = body.metrics;
        if (body.testimonial !== undefined) update.testimonial = body.testimonial;
        if (body.media !== undefined) update.media = normalizeMedia(body.media);
        if (body.published !== undefined) update.published = body.published;

        if (Object.keys(update).length === 0) return json({ ok: false, error: "empty" }, 400);

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data, error } = await supabaseAdmin
            .from("case_studies")
            .update(update)
            .eq("id", params.id)
            .select("*")
            .single();
          if (error || !data) {
            const duplicate = error?.code === "23505";
            return json(
              { ok: false, error: duplicate ? "duplicate_slug" : "storage" },
              duplicate ? 409 : 500,
            );
          }
          return json({ ok: true, item: serializeCaseStudy(data) });
        } catch (err) {
          console.error("[admin/case-studies/:id] PATCH", err instanceof Error ? err.message : err);
          return json({ ok: false, error: "unavailable" }, 503);
        }
      },
      DELETE: async ({ request, params }) => {
        if (!(await isAdminRequest(request)))
          return json({ ok: false, error: "unauthorized" }, 401);
        if (!UUID.test(params.id)) return json({ ok: false, error: "not_found" }, 404);
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error } = await supabaseAdmin.from("case_studies").delete().eq("id", params.id);
          if (error) return json({ ok: false, error: "storage" }, 500);
          return json({ ok: true });
        } catch (err) {
          console.error(
            "[admin/case-studies/:id] DELETE",
            err instanceof Error ? err.message : err,
          );
          return json({ ok: false, error: "unavailable" }, 503);
        }
      },
    },
  },
});
