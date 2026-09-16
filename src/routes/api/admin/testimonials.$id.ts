import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { isAdminRequest } from "@/lib/admin-auth.server";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  quote: z.string().max(2000).nullable().optional(),
  mediaType: z.enum(["image", "video"]).optional(),
  mediaUrl: z.string().min(1).max(2000).optional(),
  thumbnailUrl: z.string().max(2000).nullable().optional(),
  industrySlug: z.string().max(120).nullable().optional(),
  capabilitySlug: z.string().max(120).nullable().optional(),
  published: z.boolean().optional(),
});

export const Route = createFileRoute("/api/admin/testimonials/$id")({
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
        const update: TablesUpdate<"testimonials"> = {};
        if (body.title !== undefined) update.title = body.title;
        if (body.quote !== undefined) update.quote = body.quote || null;
        if (body.mediaType !== undefined) update.media_type = body.mediaType;
        if (body.mediaUrl !== undefined) update.media_url = body.mediaUrl;
        if (body.thumbnailUrl !== undefined) update.thumbnail_url = body.thumbnailUrl || null;
        if (body.industrySlug !== undefined) update.industry_slug = body.industrySlug || null;
        if (body.capabilitySlug !== undefined) update.capability_slug = body.capabilitySlug || null;
        if (body.published !== undefined) update.published = body.published;

        if (Object.keys(update).length === 0) return json({ ok: false, error: "empty" }, 400);

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data, error } = await supabaseAdmin
            .from("testimonials")
            .update(update)
            .eq("id", params.id)
            .select("*")
            .single();
          if (error || !data) return json({ ok: false, error: "storage" }, 500);
          return json({ ok: true, item: data });
        } catch (err) {
          console.error("[admin/testimonials/:id] PATCH", err instanceof Error ? err.message : err);
          return json({ ok: false, error: "unavailable" }, 503);
        }
      },
      DELETE: async ({ request, params }) => {
        if (!(await isAdminRequest(request)))
          return json({ ok: false, error: "unauthorized" }, 401);
        if (!UUID.test(params.id)) return json({ ok: false, error: "not_found" }, 404);
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error } = await supabaseAdmin.from("testimonials").delete().eq("id", params.id);
          if (error) return json({ ok: false, error: "storage" }, 500);
          return json({ ok: true });
        } catch (err) {
          console.error(
            "[admin/testimonials/:id] DELETE",
            err instanceof Error ? err.message : err,
          );
          return json({ ok: false, error: "unavailable" }, 503);
        }
      },
    },
  },
});
