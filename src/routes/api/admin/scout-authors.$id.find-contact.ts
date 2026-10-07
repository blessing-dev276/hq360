import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { canSeeAuthor, resolveScoutAccess, canFindContacts } from "@/lib/scout/owner.server";
import { asScoutDb, type ScoutAuthor } from "@/lib/scout/db";
import { findAuthorContacts } from "@/lib/scout/perplexity-contact.server";
import { keyForSearch } from "@/lib/perplexity/credentials.server";
import { PerplexityError, runAgent } from "@/lib/perplexity/agent.server";

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
        if (!(await canFindContacts(access)))
          return json({ ok: false, message: "You don't have access to Find Author Contact." }, 403);
        if (request.headers.get("origin") !== new URL(request.url).origin)
          return json({ ok: false, message: "Invalid request origin." }, 403);
        if (!z.string().uuid().safeParse(params.id).success)
          return json({ ok: false, error: "invalid" }, 400);
        try {
          const raw = await request.text();
          const body = z
            .object({ bookId: z.string().uuid().optional(), retry: z.boolean().optional() })
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
          const author = authorRow as ScoutAuthor & {
            contact_emails?: string[] | null;
            contact_search_status?: "found" | "not_found" | null;
          };
          // Each author is searched once; repeat requests return the saved result.
          // retry re-runs only a "not found" result (e.g. after search improvements).
          if (
            author.contact_search_status &&
            !(body.retry && author.contact_search_status === "not_found")
          )
            return json({
              ok: true,
              status: author.contact_search_status,
              emails: author.contact_emails ?? [],
              cached: true,
            });
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
          // Free: the author's own website first. Only pay for a web search
          // when the site has no published email.
          const { emailsOnWebsite } = await import("@/lib/scout/website-contact.server");
          const onSite = await emailsOnWebsite(author.website_url);
          const result = onSite.length
            ? {
                summary: "",
                contacts: onSite.map((email) => ({
                  email,
                  role: "author" as const,
                  source_url: author.website_url!,
                  evidence: "Published on the author's website",
                  verified: true,
                })),
              }
            : await (async () => {
                const apiKey = await keyForSearch(access);
                return findAuthorContacts(
                  { author: author.name, book: book.title, website: author.website_url },
                  (request) => runAgent(request, fetch, { apiKey }),
                  fetch,
                  { allowSharedSearch: access.role === "admin" },
                );
              })();
          // Author's own address first, then agent/publisher/publicist.
          const emails = [
            ...result.contacts.filter((c) => c.role === "author"),
            ...result.contacts.filter((c) => c.role !== "author"),
          ].map((c) => c.email.toLowerCase());
          const status = emails.length ? "found" : "not_found";
          await db.from("scout_research_notes").insert({
            scout_author_id: author.id,
            note: `Contact research for ${book.title}: ${status === "found" ? emails.join(", ") : "no public email found"}\n${result.contacts.map((c) => `${c.role}: ${c.email} — ${c.source_url}`).join("\n")}`,
            source_url: result.contacts[0]?.source_url ?? null,
            verification_status: "unverified",
            retrieved_at: new Date().toISOString(),
            added_by: "perplexity_agent",
          });
          const { error: saveError } = await db
            .from("scout_authors")
            .update({
              contact_emails: emails,
              contact_search_status: status,
              contact_searched_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            } as never)
            .eq("id", author.id);
          if (saveError)
            return json(
              { ok: false, message: "Search finished but could not be saved. Please retry." },
              503,
            );
          // Fill the main contact email unless staff already verified one.
          if (emails[0])
            await db
              .from("scout_authors")
              .update({
                contact_email: emails[0],
                contact_verification_status: "unverified",
              })
              .eq("id", author.id)
              .neq("contact_verification_status", "verified");
          return json({ ok: true, status, emails });
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
