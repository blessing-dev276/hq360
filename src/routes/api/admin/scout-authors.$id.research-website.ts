import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { isAdminRequest } from "@/lib/admin-auth.server";
import { asScoutDb, type ScoutAuthor } from "@/lib/scout/db";
import { researchAuthorWebsite } from "@/lib/scout/adapters/website-research";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bodySchema = z.object({ websiteUrl: z.string().trim().min(1).max(2000).optional() });

export const Route = createFileRoute("/api/admin/scout-authors/$id/research-website")({
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

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = asScoutDb(supabaseAdmin);

          const { data: authorRow } = await db
            .from("scout_authors")
            .select("*")
            .eq("id", params.id)
            .maybeSingle();
          if (!authorRow) return json({ ok: false, error: "not_found" }, 404);
          const author = authorRow as ScoutAuthor;

          const targetUrl = body.websiteUrl || author.website_url;
          if (!targetUrl) return json({ ok: false, error: "no_website_url" }, 400);

          const result = await researchAuthorWebsite(targetUrl);

          const authorUpdate: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
            website_url: targetUrl,
            website_verification_status: result.status === "retrieved" ? "verified" : "unverified",
          };
          if (result.contactEmail && !author.contact_email) {
            authorUpdate.contact_email = result.contactEmail;
            authorUpdate.contact_verification_status = "verified";
          }
          if (result.contactFormUrl && !author.contact_form_url) {
            authorUpdate.contact_form_url = result.contactFormUrl;
          }
          if (result.metaDescription && !author.bio) {
            authorUpdate.bio = result.metaDescription;
            authorUpdate.bio_source_url = result.url;
          }

          const { data: updated, error: updateErr } = await db
            .from("scout_authors")
            .update(authorUpdate)
            .eq("id", author.id)
            .select("*")
            .single();
          if (updateErr || !updated) return json({ ok: false, error: "storage" }, 500);

          await db.from("scout_research_notes").insert({
            scout_author_id: author.id,
            note:
              result.status === "retrieved"
                ? `Website research: title="${result.title ?? "?"}", newsletter ${
                    result.newsletterVisible ? "visible" : "not detected"
                  }, contact ${result.contactEmail ? "email found" : result.contactFormUrl ? "form found" : "not found"}.`
                : `Website research failed: ${result.error ?? "unknown error"}.`,
            source_url: result.url,
            verification_status: result.status === "retrieved" ? "verified" : "unverified",
            retrieved_at: result.retrievedAt,
            added_by: "scout_website_research",
          });

          return json({ ok: true, item: updated, research: result });
        } catch (err) {
          console.error(
            "[admin/scout-authors.$id.research-website] POST",
            err instanceof Error ? err.message : err,
          );
          return json({ ok: false, error: "unavailable" }, 503);
        }
      },
    },
  },
});
