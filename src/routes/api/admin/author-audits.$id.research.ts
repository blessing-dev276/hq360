import { createFileRoute } from "@tanstack/react-router";
import { isAdminRequest } from "@/lib/admin-auth.server";
import { asAuditDb, type Author, type Book } from "@/lib/author-audit/db";
import { runFreeResearch } from "@/lib/author-audit/research";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Runs the free automated research providers (Google Books, Open Library,
 * a direct website fetch) and stores each as an audit_sources row. Amazon
 * and Goodreads have no usable free API, so those stay manual-verification
 * entries — see /admin > Audits > Manual verification. */
export const Route = createFileRoute("/api/admin/author-audits/$id/research")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        if (!(await isAdminRequest(request)))
          return json({ ok: false, error: "unauthorized" }, 401);
        if (!UUID.test(params.id)) return json({ ok: false, error: "not_found" }, 404);
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = asAuditDb(supabaseAdmin);

          const { data: audit } = await db
            .from("author_audits")
            .select("*, authors(*), books(*)")
            .eq("id", params.id)
            .single();
          if (!audit) return json({ ok: false, error: "not_found" }, 404);
          const record = audit as unknown as {
            id: string;
            input_snapshot: Record<string, unknown>;
            authors: Author;
            books: Book;
          };

          await db
            .from("author_audits")
            .update({ status: "researching", research_started_at: new Date().toISOString() })
            .eq("id", params.id);

          const website =
            (record.input_snapshot.websiteUrl as string | undefined) ||
            record.authors.website_url ||
            undefined;

          const sources = await runFreeResearch({
            author: record.authors.name,
            title: record.books.title,
            ...(website ? { website } : {}),
            ...(record.books.amazon_url ? { amazonUrlOrAsin: record.books.amazon_url } : {}),
          });

          const rows = sources.map((s) => ({
            audit_id: params.id,
            provider: s.provider,
            source_type: s.sourceType,
            url: s.url ?? null,
            retrieved_at: s.retrievedAt,
            status: s.status,
            raw_data: s.data,
            error_message: s.error ?? null,
          }));
          const { error: insertErr } = await db.from("audit_sources").insert(rows);
          if (insertErr) return json({ ok: false, error: "storage" }, 500);

          await db
            .from("author_audits")
            .update({
              status: "needs_verification",
              research_completed_at: new Date().toISOString(),
            })
            .eq("id", params.id);

          return json({ ok: true, sources: rows });
        } catch (err) {
          console.error(
            "[admin/author-audits/:id/research] POST",
            err instanceof Error ? err.message : err,
          );
          return json({ ok: false, error: "unavailable" }, 503);
        }
      },
    },
  },
});
