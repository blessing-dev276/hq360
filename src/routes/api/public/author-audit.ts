import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { asAuditDb } from "@/lib/author-audit/db";

const schema = z.object({
  authorName: z.string().trim().min(1).max(160),
  bookTitle: z.string().trim().min(1).max(300),
  email: z.string().trim().email().max(320),
  amazonUrlOrAsin: z.string().trim().max(2_000).optional().or(z.literal("")),
  websiteUrl: z.string().trim().max(2_000).optional().or(z.literal("")),
  goodreadsUrl: z.string().trim().max(2_000).optional().or(z.literal("")),
  consent: z.literal(true),
  // Honeypot — see the comment in growth-audit.ts's schema for why this
  // isn't length-capped.
  company_url: z.string().optional(),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/author-audit")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: z.infer<typeof schema>;
        try {
          body = schema.parse(await request.json());
        } catch {
          return json({ ok: false, error: "invalid" }, 400);
        }
        if (body.company_url) return json({ ok: true });
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = asAuditDb(supabaseAdmin);

          // A dropped connection between client and server (common on mobile
          // networks) can make a successful submission look failed to the
          // visitor, who then resubmits — that shouldn't create a second
          // lead. Treat an identical submission (same email/author/book)
          // in the last 5 minutes as the same request.
          const dedupeWindow = new Date(Date.now() - 5 * 60 * 1000).toISOString();
          const { data: recent } = await db
            .from("author_audit_leads")
            .select("id")
            .eq("email", body.email.toLowerCase())
            .eq("author_name", body.authorName)
            .eq("book_title", body.bookTitle)
            .gte("created_at", dedupeWindow)
            .limit(1)
            .maybeSingle();
          if (recent) return json({ ok: true, id: (recent as { id: string }).id }, 200);

          const { data, error } = await db
            .from("author_audit_leads")
            .insert({
              author_name: body.authorName,
              book_title: body.bookTitle,
              email: body.email.toLowerCase(),
              amazon_url_or_asin: body.amazonUrlOrAsin || null,
              website_url: body.websiteUrl || null,
              goodreads_url: body.goodreadsUrl || null,
              consented_at: new Date().toISOString(),
              source_path: "/tools/author-visibility-audit",
            })
            .select("id")
            .single();
          if (error || !data) {
            console.error("[author-audit] lead insert failed", error?.message);
            return json({ ok: false, error: "storage" }, 500);
          }

          try {
            const { sendLeadEmail } = await import("@/lib/email.server");
            const result = await sendLeadEmail({
              subject: `New Author Visibility Audit request — ${body.authorName}`,
              replyTo: body.email,
              text: [
                "New Author Visibility Audit request. Open it from /admin > Audits.",
                "",
                `Author: ${body.authorName}`,
                `Book: ${body.bookTitle}`,
                `Email: ${body.email}`,
                `Amazon: ${body.amazonUrlOrAsin || "N/A"}`,
                `Website: ${body.websiteUrl || "N/A"}`,
                `Goodreads: ${body.goodreadsUrl || "N/A"}`,
              ].join("\n"),
            });
            if (!result.sent)
              console.warn("[author-audit] notification email not sent", result.error);
          } catch (err) {
            console.error(
              "[author-audit] notification email failed",
              err instanceof Error ? err.message : err,
            );
          }

          return json({ ok: true, id: data.id }, 201);
        } catch (error) {
          console.error(
            "[author-audit] request failed",
            error instanceof Error ? error.message : error,
          );
          return json({ ok: false, error: "unavailable" }, 503);
        }
      },
    },
  },
});
