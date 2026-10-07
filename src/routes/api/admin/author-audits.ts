import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { isAdminOrExpertRequest } from "@/lib/expert-auth.server";
import { asAuditDb, type Author, type Book } from "@/lib/author-audit/db";
import { normalized } from "@/lib/author-audit/research";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const createSchema = z.object({
  bookUrl: z.string().trim().max(2000).url().or(z.literal("")).optional(),
  notes: z.string().trim().max(10000).optional(),
  leadId: z.string().uuid().optional(),
  authorName: z.string().trim().min(1).max(160).optional(),
  bookTitle: z.string().trim().min(1).max(300).optional(),
  websiteUrl: z.string().trim().max(2000).optional(),
  amazonUrlOrAsin: z.string().trim().max(2000).optional(),
  goodreadsUrl: z.string().trim().max(2000).optional(),
});

export const Route = createFileRoute("/api/admin/author-audits")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isAdminOrExpertRequest(request)))
          return json({ ok: false, error: "unauthorized" }, 401);
        const { auditActor } = await import("@/lib/author-audit/workflow-access.server");
        const actor = await auditActor(request);
        if (!actor) return json({ ok: false, error: "unauthorized" }, 401);
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = asAuditDb(supabaseAdmin);
          let query = db
            .from("author_audits")
            .select("*, authors(name), books(title)")
            .order("created_at", { ascending: false });
          if (!actor.admin) {
            const { clientDb } = await import("@/lib/author-audit/client-access.server");
            const assigned = await clientDb()
              .from("audit_assignments")
              .select("audit_id")
              .eq("expert_id", actor.id);
            if (assigned.error) throw assigned.error;
            query = query.in(
              "id",
              (assigned.data ?? []).map((a) => a.audit_id),
            );
          }
          const { data, error } = await query;
          if (error) return json({ ok: false, error: "storage" }, 500);
          return json({ ok: true, items: data ?? [] });
        } catch (err) {
          console.error("[admin/author-audits] GET", err instanceof Error ? err.message : err);
          return json({ ok: false, error: "unavailable" }, 503);
        }
      },
      POST: async ({ request }) => {
        if (!(await isAdminOrExpertRequest(request)))
          return json({ ok: false, error: "unauthorized" }, 401);
        const { auditActor } = await import("@/lib/author-audit/workflow-access.server");
        const actor = await auditActor(request);
        if (!actor) return json({ ok: false, error: "unauthorized" }, 401);
        let body: z.infer<typeof createSchema>;
        try {
          body = createSchema.parse(await request.json());
        } catch {
          return json({ ok: false, error: "invalid" }, 400);
        }

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = asAuditDb(supabaseAdmin);

          let authorName = body.authorName;
          let bookTitle = body.bookTitle;
          let websiteUrl = body.websiteUrl;
          let amazonUrlOrAsin = body.amazonUrlOrAsin;
          let goodreadsUrl = body.goodreadsUrl;
          let leadExpertId: string | null = null;

          if (body.leadId) {
            const { data: lead } = await db
              .from("author_audit_leads")
              .select("*")
              .eq("id", body.leadId)
              .single();
            if (!lead) return json({ ok: false, error: "lead_not_found" }, 404);
            // Experts may only start audits from requests referred to them.
            if (!actor.admin && (lead as { expert_id: string | null }).expert_id !== actor.id)
              return json({ ok: false, error: "lead_not_found" }, 404);
            leadExpertId = (lead as { expert_id: string | null }).expert_id;
            authorName ??= (lead as { author_name: string }).author_name;
            bookTitle ??= (lead as { book_title: string }).book_title;
            websiteUrl ??= (lead as { website_url: string | null }).website_url ?? undefined;
            amazonUrlOrAsin ??=
              (lead as { amazon_url_or_asin: string | null }).amazon_url_or_asin ?? undefined;
            goodreadsUrl ??= (lead as { goodreads_url: string | null }).goodreads_url ?? undefined;
          }

          if (!authorName || !bookTitle)
            return json({ ok: false, error: "author_and_title_required" }, 400);

          const authorNorm = normalized(authorName);
          let { data: author } = await db
            .from("authors")
            .select("*")
            .eq("normalized_name", authorNorm)
            .maybeSingle();
          if (!author) {
            const { data: created, error: authorErr } = await db
              .from("authors")
              .insert({
                name: authorName,
                normalized_name: authorNorm,
                website_url: websiteUrl || null,
                amazon_author_url: null,
                goodreads_author_url: null,
              })
              .select("*")
              .single();
            if (authorErr || !created) return json({ ok: false, error: "storage" }, 500);
            author = created;
          }
          const authorRow = author as Author;

          const titleNorm = normalized(bookTitle);
          let { data: book } = await db
            .from("books")
            .select("*")
            .eq("author_id", authorRow.id)
            .eq("normalized_title", titleNorm)
            .maybeSingle();
          if (!book) {
            const asinMatch = (amazonUrlOrAsin ?? "").match(/^[A-Z0-9]{10}$/i)?.[0];
            const { data: created, error: bookErr } = await db
              .from("books")
              .insert({
                author_id: authorRow.id,
                title: bookTitle,
                normalized_title: titleNorm,
                asin: asinMatch ?? null,
                isbn: null,
                amazon_url: amazonUrlOrAsin?.startsWith("http") ? amazonUrlOrAsin : null,
                goodreads_url: goodreadsUrl || null,
                publisher: null,
                genre: null,
                publication_date: null,
              })
              .select("*")
              .single();
            if (bookErr || !created) return json({ ok: false, error: "storage" }, 500);
            book = created;
          }
          const bookRow = book as Book;

          const { data: audit, error: auditErr } = await db
            .from("author_audits")
            .insert({
              author_id: authorRow.id,
              book_id: bookRow.id,
              lead_id: body.leadId ?? null,
              status: "research_pending",
              workflow_version: 1,
              review_status: "not_started",
              publish_status: "not_ready",
              created_by: actor.id,
              input_snapshot: {
                authorName,
                bookTitle,
                bookUrl: body.bookUrl || null,
                notes: body.notes || null,
                websiteUrl: websiteUrl || null,
                amazonUrlOrAsin: amazonUrlOrAsin || null,
                goodreadsUrl: goodreadsUrl || null,
              },
            })
            .select("*")
            .single();
          if (auditErr || !audit) return json({ ok: false, error: "storage" }, 500);

          const { clientDb } = await import("@/lib/author-audit/client-access.server");
          // The creating expert works on the audit; an admin starting one from an
          // expert's referred request assigns it to that expert.
          const owner = actor.admin ? leadExpertId : actor.id;
          if (owner) {
            const assigned = await clientDb()
              .from("audit_assignments")
              .insert({ audit_id: audit.id, expert_id: owner, role: "expert" });
            if (assigned.error) throw assigned.error;
          }
          await clientDb()
            .from("audit_activity")
            .insert({ audit_id: audit.id, actor: actor.id, action: "audit_created" });
          if (body.leadId) {
            await db
              .from("author_audit_leads")
              .update({ status: "reviewing" })
              .eq("id", body.leadId);
          }

          return json({ ok: true, item: audit }, 201);
        } catch (err) {
          console.error("[admin/author-audits] POST", err instanceof Error ? err.message : err);
          return json({ ok: false, error: "unavailable" }, 503);
        }
      },
    },
  },
});
