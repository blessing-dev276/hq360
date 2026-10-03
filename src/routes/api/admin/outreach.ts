import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { isAdminRequest } from "@/lib/admin-auth.server";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

const sendSchema = z.object({
  to_email: z.string().trim().toLowerCase().email().max(254),
  to_name: z.string().trim().max(160).default(""),
  subject: z.string().trim().min(3).max(200),
  body: z.string().trim().min(20).max(5000),
  template: z.enum(["letter", "card"]),
  prospect_id: z.string().uuid().nullable().optional(),
  confirm_repeat: z.boolean().optional(),
});

const REPEAT_DAYS = 30;

export const Route = createFileRoute("/api/admin/outreach")({
  server: {
    handlers: {
      /** Sender status, today's usage, recent sends and Scout prospects with an email. */
      GET: async ({ request }) => {
        if (!(await isAdminRequest(request))) return json({ error: "Unauthorized" }, 401);
        const { outreachConfig, outreachMessages } = await import("@/lib/outreach.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const config = outreachConfig();
        const startOfDay = new Date();
        startOfDay.setUTCHours(0, 0, 0, 0);
        const [history, today, prospects] = await Promise.all([
          outreachMessages()
            .select("id, created_at, to_email, to_name, subject, template, status, error")
            .order("created_at", { ascending: false })
            .limit(100),
          outreachMessages()
            .select("id", { count: "exact", head: true })
            .eq("status", "sent")
            .gte("created_at", startOfDay.toISOString()),
          (supabaseAdmin as unknown as import("@supabase/supabase-js").SupabaseClient)
            .from("scout_prospects")
            .select(
              "id, status, scout_authors(name, contact_email, outreach_suppressed), scout_discovered_books(title)",
            )
            .eq("owner", "hq360")
            .eq("do_not_contact", false)
            .neq("status", "excluded")
            .order("created_at", { ascending: false })
            .limit(500),
        ]);
        type ProspectRow = {
          id: string;
          status: string;
          scout_authors: {
            name: string;
            contact_email: string | null;
            outreach_suppressed?: boolean;
          } | null;
          scout_discovered_books: { title: string } | null;
        };
        const recipients = ((prospects.data ?? []) as unknown as ProspectRow[])
          .filter((p) => p.scout_authors?.contact_email && !p.scout_authors.outreach_suppressed)
          .map((p) => ({
            prospect_id: p.id,
            name: p.scout_authors!.name,
            email: p.scout_authors!.contact_email!.toLowerCase(),
            book: p.scout_discovered_books?.title ?? null,
            status: p.status,
          }));
        return json({
          config: {
            configured: config.configured,
            from: config.from,
            senderName: config.senderName,
            senderTitle: config.senderTitle,
            address: config.address,
            siteOrigin: config.siteOrigin,
            dailyLimit: config.dailyLimit,
            sentToday: today.count ?? 0,
          },
          history: history.data ?? [],
          recipients,
        });
      },

      POST: async ({ request }) => {
        if (!(await isAdminRequest(request))) return json({ error: "Unauthorized" }, 401);
        if (request.headers.get("origin") !== new URL(request.url).origin)
          return json({ error: "Invalid origin" }, 403);
        const parsed = sendSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success)
          return json({ error: parsed.error.issues[0]?.message || "Check the message." }, 400);
        const input = parsed.data;
        const { outreachConfig, outreachMessages, outreachSuppressions, unsubscribeUrls } =
          await import("@/lib/outreach.server");
        const config = outreachConfig();
        if (!config.configured)
          return json(
            {
              error:
                "Outreach sender isn't set up yet. Add OUTREACH_EMAIL_FROM (a verified mail.hq360.space address) in the host settings.",
            },
            503,
          );

        // 1. Never email anyone who unsubscribed or was blocked.
        const { data: suppressed } = await outreachSuppressions()
          .select("email, reason")
          .eq("email", input.to_email)
          .maybeSingle();
        if (suppressed)
          return json({ error: `${input.to_email} has unsubscribed. They can't be emailed.` }, 409);

        // 2. Respect Scout's do-not-contact / suppressed authors for this address.
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const db = supabaseAdmin as unknown as import("@supabase/supabase-js").SupabaseClient;
        const { data: authors } = await db
          .from("scout_authors")
          .select("id, outreach_suppressed, scout_prospects(do_not_contact, status)")
          // Case-insensitive exact match; escape LIKE wildcards common in emails (_).
          .ilike("contact_email", input.to_email.replace(/[\\%_]/g, "\\$&"));
        type AuthorRow = {
          outreach_suppressed?: boolean;
          scout_prospects: { do_not_contact: boolean; status: string }[] | null;
        };
        const blocked = ((authors ?? []) as AuthorRow[]).some(
          (a) =>
            a.outreach_suppressed ||
            (a.scout_prospects ?? []).some((p) => p.do_not_contact && p.status === "excluded"),
        );
        if (blocked) return json({ error: "This author is marked do-not-contact in Scout." }, 409);

        // 3. Daily cap protects the sending domain's reputation.
        const startOfDay = new Date();
        startOfDay.setUTCHours(0, 0, 0, 0);
        const { count } = await outreachMessages()
          .select("id", { count: "exact", head: true })
          .eq("status", "sent")
          .gte("created_at", startOfDay.toISOString());
        if ((count ?? 0) >= config.dailyLimit)
          return json(
            {
              error: `Daily limit of ${config.dailyLimit} outreach emails reached. Sending more today risks spam filtering; continue tomorrow.`,
            },
            429,
          );

        // 4. Don't follow up too soon unless the admin confirms it.
        const since = new Date(Date.now() - REPEAT_DAYS * 86400_000).toISOString();
        const { data: recent } = await outreachMessages()
          .select("created_at, subject")
          .eq("to_email", input.to_email)
          .eq("status", "sent")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (recent && !input.confirm_repeat)
          return json(
            {
              error: `You emailed ${input.to_email} on ${new Date(recent.created_at).toLocaleDateString("en-GB")} (“${recent.subject}”). Send again anyway?`,
              code: "repeat",
            },
            409,
          );

        const { renderOutreach } = await import("@/lib/outreach");
        const { leadInboxAddress, sendEmail } = await import("@/lib/email.server");
        const urls = unsubscribeUrls(input.to_email, config.siteOrigin);
        const replyTo = config.replyTo || leadInboxAddress();
        const email = renderOutreach({
          template: input.template,
          toName: input.to_name,
          subject: input.subject,
          body: input.body,
          senderName: config.senderName,
          senderTitle: config.senderTitle,
          siteOrigin: config.siteOrigin,
          unsubscribeUrl: urls.page,
          address: config.address || undefined,
        });
        const result = await sendEmail({
          from: config.from,
          to: input.to_email,
          replyTo,
          subject: email.subject,
          text: email.text,
          html: email.html,
          headers: {
            // Gmail/Yahoo bulk-sender rules: one-click unsubscribe headers.
            "List-Unsubscribe": `<${urls.oneClick}>, <mailto:${replyTo}?subject=unsubscribe>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        });
        const { configuredUsername } = await import("@/lib/admin-auth.server");
        await outreachMessages().insert({
          sent_by: configuredUsername(),
          to_email: input.to_email,
          to_name: input.to_name || null,
          subject: email.subject,
          body: input.body,
          template: input.template,
          scout_prospect_id: input.prospect_id ?? null,
          status: result.sent ? "sent" : "failed",
          provider_id: result.id ?? null,
          error: result.sent ? null : (result.error ?? "Unknown error").slice(0, 500),
        });
        if (!result.sent)
          return json(
            { error: "The email could not be sent. Check the outreach sender settings in Resend." },
            502,
          );
        return json({ ok: true });
      },
    },
  },
});
