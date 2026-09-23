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
const bodySchema = z.object({
  candidateUrl: z.string().trim().min(1).max(2000),
  contactEmail: z.string().trim().email().max(320).optional(),
  contactFormUrl: z.string().trim().max(2000).optional(),
});

/**
 * A human looked at what scout-authors.$id.find-contact turned up and is
 * saying "yes, this is genuinely this author's site/email" -- the one step
 * that endpoint deliberately doesn't take on its own.
 */
export const Route = createFileRoute("/api/admin/scout-authors/$id/confirm-contact")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        if (!(await isAdminRequest(request)))
          return json({ ok: false, error: "unauthorized" }, 401);
        if (!UUID.test(params.id)) return json({ ok: false, error: "invalid" }, 400);
        let body: z.infer<typeof bodySchema>;
        try {
          body = bodySchema.parse(await request.json());
        } catch {
          return json({ ok: false, error: "invalid" }, 400);
        }
        if (!body.contactEmail && !body.contactFormUrl)
          return json({ ok: false, error: "nothing_to_confirm" }, 400);

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = asScoutDb(supabaseAdmin);

          const { data: updated, error: updateErr } = await db
            .from("scout_authors")
            .update({
              website_url: body.candidateUrl,
              website_verification_status: "verified",
              ...(body.contactEmail
                ? { contact_email: body.contactEmail, contact_verification_status: "verified" }
                : {}),
              ...(body.contactFormUrl ? { contact_form_url: body.contactFormUrl } : {}),
              updated_at: new Date().toISOString(),
            })
            .eq("id", params.id)
            .select("*")
            .single();
          if (updateErr || !updated) return json({ ok: false, error: "storage" }, 500);

          await db.from("scout_research_notes").insert({
            scout_author_id: params.id,
            note: `Contact info confirmed by staff: ${body.contactEmail ?? body.contactFormUrl}.`,
            source_url: body.candidateUrl,
            verification_status: "verified",
            retrieved_at: new Date().toISOString(),
            added_by: "scout_confirm_contact",
          });

          return json({ ok: true, item: updated });
        } catch (error) {
          console.error("[admin/scout-authors.$id.confirm-contact] POST", error);
          return json({ ok: false, error: "unavailable" }, 503);
        }
      },
    },
  },
});
