import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { isAdminRequest } from "@/lib/admin-auth.server";
import { asScoutDb } from "@/lib/scout/db";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Country and publishing type aren't exposed by Google Books/Open Library,
// so they're staff-entered facts -- recorded here as unverified until
// research (e.g. the author's own website) confirms them.
const patchSchema = z.object({
  country: z.string().trim().max(80).nullable().optional(),
  publishingType: z.enum(["traditional", "independent", "hybrid", "unknown"]).optional(),
  websiteUrl: z.string().trim().max(2000).nullable().optional(),
  contactEmail: z.string().trim().max(320).nullable().optional(),
  contactFormUrl: z.string().trim().max(2000).nullable().optional(),
});

export const Route = createFileRoute("/api/admin/scout-authors/$id")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        if (!(await isAdminRequest(request)))
          return json({ ok: false, error: "unauthorized" }, 401);
        if (!UUID.test(params.id)) return json({ ok: false, error: "invalid" }, 400);
        let body: z.infer<typeof patchSchema>;
        try {
          body = patchSchema.parse(await request.json());
        } catch {
          return json({ ok: false, error: "invalid" }, 400);
        }
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = asScoutDb(supabaseAdmin);

          const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
          if (body.country !== undefined) update.country = body.country;
          if (body.publishingType !== undefined) update.publishing_type = body.publishingType;
          if (body.websiteUrl !== undefined) {
            update.website_url = body.websiteUrl;
            update.website_verification_status = "unverified";
          }
          if (body.contactEmail !== undefined) {
            update.contact_email = body.contactEmail;
            update.contact_verification_status = "unverified";
          }
          if (body.contactFormUrl !== undefined) update.contact_form_url = body.contactFormUrl;

          const { data, error } = await db
            .from("scout_authors")
            .update(update)
            .eq("id", params.id)
            .select("*")
            .single();
          if (error || !data) return json({ ok: false, error: "storage" }, 500);
          return json({ ok: true, item: data });
        } catch (err) {
          console.error(
            "[admin/scout-authors.$id] PATCH",
            err instanceof Error ? err.message : err,
          );
          return json({ ok: false, error: "unavailable" }, 503);
        }
      },
    },
  },
});
