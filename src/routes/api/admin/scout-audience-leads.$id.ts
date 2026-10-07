import { createFileRoute } from "@tanstack/react-router";
import { canSeeAudienceLead, resolveScoutAccess } from "@/lib/scout/owner.server";
import { asScoutDb } from "@/lib/scout/db";
import {
  publicResultUrl,
  serpSearch,
  indexedEmail,
  emailSearchScope,
} from "@/lib/scout/audience-search.server";
import { z } from "zod";
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
export const Route = createFileRoute("/api/admin/scout-audience-leads/$id")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const access = await resolveScoutAccess(request);
        if (!access) return json({ ok: false, error: "unauthorized" }, 401);
        const parsed = z
          .object({ action: z.enum(["find-email", "verify-email", "shortlist"]) })
          .safeParse(await request.json().catch(() => null));
        if (!z.string().uuid().safeParse(params.id).success || !parsed.success)
          return json({ ok: false, message: "Invalid request." }, 400);
        if (access.role !== "admin" && parsed.data.action !== "shortlist")
          return json({ ok: false, message: "Only admins can find or verify emails." }, 403);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const db = asScoutDb(supabaseAdmin);
        const { data: lead, error } = await db
          .from("scout_audience_leads")
          .select("*")
          .eq("id", params.id)
          .maybeSingle();
        if (error) return json({ ok: false, message: "Could not load this lead." }, 503);
        if (!lead || !(await canSeeAudienceLead(db, access.owner, params.id)))
          return json({ ok: false, message: "Lead not found." }, 404);
        const withShortlist = async (item: Record<string, unknown>) => {
          const { data: entry } = await db
            .from("scout_audience_shortlist")
            .select("lead_id")
            .eq("owner", access.owner)
            .eq("lead_id", params.id)
            .maybeSingle();
          return { ...item, shortlisted: Boolean(entry) };
        };
        if (parsed.data.action === "shortlist") {
          // Shortlists are per workspace, not a flag on the shared lead.
          const { error: shortlistError } = await db
            .from("scout_audience_shortlist")
            .upsert({ owner: access.owner, lead_id: params.id }, { ignoreDuplicates: true });
          if (shortlistError)
            return json({ ok: false, message: "Could not save this lead. Retry." }, 503);
          return json({ ok: true, item: await withShortlist(lead) });
        }
        let updates: Record<string, unknown>;
        if (parsed.data.action === "verify-email") {
          if (!lead.contact_email)
            return json({ ok: false, message: "Find an email before verifying it." }, 400);
          updates = { contact_status: "verified" };
        } else {
          if (lead.contact_email)
            return json({
              ok: true,
              item: await withShortlist(lead),
              message: "An email is already saved.",
            });
          const website = publicResultUrl(lead.website_url);
          if (!website)
            return json({
              ok: true,
              item: await withShortlist(lead),
              message: "No website is listed for this lead. No email search was run.",
            });
          try {
            const scope = emailSearchScope(website);
            if (!scope)
              return json({
                ok: true,
                item: await withShortlist(lead),
                message:
                  "This is a directory homepage. Open the listing to identify a specific business website.",
              });
            const body = await serpSearch(
              { engine: "google", q: scope.query, hl: "en" },
              AbortSignal.any([request.signal, AbortSignal.timeout(20000)]),
            );
            const found = indexedEmail(body, website);
            if (!found)
              return json({
                ok: true,
                item: await withShortlist(lead),
                message: "No publicly indexed email was found on this website.",
              });
            updates = {
              contact_email: found.email,
              contact_source_url: found.sourceUrl,
              contact_status: "unverified",
            };
          } catch {
            return json(
              {
                ok: false,
                message: "Email search could not complete. Check the search connection or retry.",
              },
              503,
            );
          }
        }
        let update = db
          .from("scout_audience_leads")
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq("id", params.id);
        // A concurrent finder or verification must never be overwritten by an older search.
        if (parsed.data.action === "find-email") update = update.is("contact_email", null);
        const { error: updateError } = await update;
        if (updateError)
          return json({ ok: false, message: "Could not save this lead. Retry." }, 503);
        const { data: item, error: readError } = await db
          .from("scout_audience_leads")
          .select("*")
          .eq("id", params.id)
          .single();
        if (readError)
          return json({ ok: false, message: "Lead saved. Reopen the batch to refresh." }, 503);
        return json({ ok: true, item: await withShortlist(item) });
      },
    },
  },
});
