import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const schema = z.object({
  authorName: z.string().trim().min(1).max(160),
  bookTitle: z.string().trim().min(1).max(300),
  email: z.string().trim().email().max(320),
  amazonUrlOrAsin: z.string().trim().max(2_000).optional().or(z.literal("")),
  websiteUrl: z.string().trim().max(2_000).optional().or(z.literal("")),
  goodreadsUrl: z.string().trim().max(2_000).optional().or(z.literal("")),
  consent: z.literal(true),
  company_url: z.string().max(0).optional(),
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
          const db = supabaseAdmin as never as { from: (table: string) => any };
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
