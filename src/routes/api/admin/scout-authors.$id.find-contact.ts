import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { canSeeAuthor, resolveScoutAccess } from "@/lib/scout/owner.server";
import { asScoutDb, type ScoutAuthor } from "@/lib/scout/db";
import { findAuthorContacts } from "@/lib/scout/perplexity-contact.server";
import { PerplexityError } from "@/lib/perplexity/agent.server";

function json(body: unknown, status = 200, retryAfter?: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      ...(retryAfter ? { "Retry-After": retryAfter } : {}),
    },
  });
}
export const Route = createFileRoute("/api/admin/scout-authors/$id/find-contact")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const access = await resolveScoutAccess(request);
        if (!access) return json({ ok: false, error: "unauthorized" }, 401);
        if (access.role !== "admin")
          return json(
            { ok: false, message: "Only admins can research or manage contact emails." },
            403,
          );
        if (request.headers.get("origin") !== new URL(request.url).origin)
          return json({ ok: false, message: "Invalid request origin." }, 403);
        if (!z.string().uuid().safeParse(params.id).success)
          return json({ ok: false, error: "invalid" }, 400);
        try {
          const raw = await request.text();
          const body = z
            .object({ bookId: z.string().uuid().optional() })
            .parse(raw ? JSON.parse(raw) : {});
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = asScoutDb(supabaseAdmin);
          if (!(await canSeeAuthor(db, access.owner, params.id)))
            return json({ ok: false, error: "not_found" }, 404);
          const { data: authorRow, error: authorError } = await db
            .from("scout_authors")
            .select("*")
            .eq("id", params.id)
            .maybeSingle();
          if (authorError) return json({ ok: false, message: "Could not load author." }, 503);
          if (!authorRow) return json({ ok: false, error: "not_found" }, 404);
          const author = authorRow as ScoutAuthor;
          let query = db
            .from("scout_discovered_books")
            .select("id,title")
            .eq("scout_author_id", author.id);
          if (body.bookId) query = query.eq("id", body.bookId);
          const { data: books, error: bookError } = await query
            .order("created_at", { ascending: false })
            .limit(1);
          if (bookError)
            return json({ ok: false, message: "Could not load the author's book." }, 503);
          const book = books?.[0] as { id: string; title: string } | undefined;
          if (!book)
            return json(
              { ok: false, message: "Save a book for this author before finding contact details." },
              400,
            );
          const result = await findAuthorContacts({
            author: author.name,
            book: book.title,
            website: author.website_url,
          });
          const first = result.contacts.find((contact) => contact.role === "author");
          const { error: noteError } = await db.from("scout_research_notes").insert({
            scout_author_id: author.id,
            note: `Perplexity contact research for ${book.title}: ${result.summary}\n${result.contacts.map((c) => `${c.role}: ${c.email} — ${c.source_url}\n${c.evidence}`).join("\n")}\nUnverified candidates; review identity before outreach.`,
            source_url: result.contacts[0]?.source_url ?? null,
            verification_status: "unverified",
            retrieved_at: new Date().toISOString(),
            added_by: "perplexity_agent",
          });
          if (noteError)
            return json(
              { ok: false, message: "Research completed but could not be saved. Please retry." },
              503,
            );
          if (first) {
            // Never overwrite a staff-verified contact, including concurrent confirmation.
            const { error } = await db
              .from("scout_authors")
              .update({
                contact_email: first.email,
                contact_verification_status: "unverified",
                updated_at: new Date().toISOString(),
              })
              .eq("id", author.id)
              .neq("contact_verification_status", "verified");
            if (error)
              return json(
                { ok: false, message: "Contact found but could not be saved. Please retry." },
                503,
              );
          }
          return json({
            ok: true,
            found: result.contacts.length > 0,
            message: result.summary,
            contacts: result.contacts,
            candidateUrl: result.contacts[0]?.source_url ?? null,
            contactEmail: first?.email ?? null,
            sources: result.sources.map(({ url, title }) => ({ url, title })),
          });
        } catch (error) {
          if (error instanceof PerplexityError)
            return json({ ok: false, message: error.message }, error.status, error.retryAfter);
          if (error instanceof z.ZodError || error instanceof SyntaxError)
            return json({ ok: false, message: "Invalid contact research request." }, 400);
          // Do not log provider errors, prompts, headers or contact evidence.
          return json(
            {
              ok: false,
              message: "Couldn't research this author's contact details. Please retry.",
            },
            503,
          );
        }
      },
    },
  },
});
