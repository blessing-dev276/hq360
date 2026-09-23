import { createFileRoute } from "@tanstack/react-router";
import { isAdminRequest } from "@/lib/admin-auth.server";
import { asScoutDb, type ScoutAuthor } from "@/lib/scout/db";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// Big platforms are never "the author's own site" -- skip them so the first
// candidate is actually plausible.
const EXCLUDED_HOSTS =
  /\b(amazon\.|goodreads\.|facebook\.|twitter\.|x\.com|instagram\.|wikipedia\.|barnesandnoble\.|books\.google\.|reedsy\.|linkedin\.|youtube\.|tiktok\.|pinterest\.|threads\.net|bookbub\.)/i;

async function extractContact(
  url: string,
  signal: AbortSignal,
): Promise<{
  title: string | undefined;
  contactEmail: string | undefined;
  contactFormUrl: string | undefined;
}> {
  const response = await fetch(url, {
    signal,
    headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml" },
  });
  if (!response.ok) throw new Error(`Site returned ${response.status}`);
  const html = await response.text();
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const mailtoMatch = html.match(/mailto:([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i);
  const contactLinkMatch =
    html.match(/<a[^>]+href=["']([^"']+)["'][^>]*>[^<]*contact[^<]*<\/a>/i) ??
    html.match(/<a[^>]+href=["']([^"'#]*contact[^"']*)["']/i);
  return {
    title: titleMatch?.[1]?.trim(),
    contactEmail: mailtoMatch?.[1]?.toLowerCase(),
    contactFormUrl: contactLinkMatch ? new URL(contactLinkMatch[1]!, url).toString() : undefined,
  };
}

async function searchCandidates(
  query: string,
  apiKey: string,
  signal: AbortSignal,
): Promise<Array<{ link?: string; title?: string }>> {
  const searchUrl = new URL("https://serpapi.com/search.json");
  searchUrl.searchParams.set("engine", "google");
  searchUrl.searchParams.set("q", query);
  searchUrl.searchParams.set("num", "20");
  searchUrl.searchParams.set("api_key", apiKey);
  const response = await fetch(searchUrl, { signal });
  const data = (await response.json()) as {
    error?: string;
    organic_results?: Array<{ link?: string; title?: string }>;
  };
  if (!response.ok || data.error)
    throw new Error(data.error || `Search failed (${response.status})`);
  return data.organic_results ?? [];
}

export const Route = createFileRoute("/api/admin/scout-authors/$id/find-contact")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        if (!(await isAdminRequest(request)))
          return json({ ok: false, error: "unauthorized" }, 401);
        if (!UUID.test(params.id)) return json({ ok: false, error: "invalid" }, 400);
        const apiKey = process.env.SERPAPI_API_KEY;
        if (!apiKey)
          return json(
            {
              ok: false,
              error: "search_not_configured",
              message: "Finding a website needs SERPAPI_API_KEY in the server environment.",
            },
            503,
          );

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

          const searchController = new AbortController();
          const searchTimeout = setTimeout(() => searchController.abort(), 20_000);
          let results: Array<{ link?: string; title?: string }> = [];
          try {
            results = await searchCandidates(
              `"${author.name}" author website`,
              apiKey,
              searchController.signal,
            );
            if (results.every((item) => !item.link || EXCLUDED_HOSTS.test(item.link)))
              results = results.concat(
                await searchCandidates(
                  `"${author.name}" books contact`,
                  apiKey,
                  searchController.signal,
                ),
              );
          } finally {
            clearTimeout(searchTimeout);
          }

          const candidates = results.filter(
            (item): item is { link: string; title?: string } =>
              Boolean(item.link) && !EXCLUDED_HOSTS.test(item.link!),
          );
          if (candidates.length === 0)
            return json({ ok: true, found: false, message: "No likely official website found." });

          let candidate = candidates[0]!;
          let extracted: Awaited<ReturnType<typeof extractContact>> | null = null;
          for (const item of candidates.slice(0, 5)) {
            try {
              const result = await extractContact(item.link, AbortSignal.timeout(15_000));
              if (result.contactEmail || result.contactFormUrl) {
                candidate = item;
                extracted = result;
                break;
              }
              if (!extracted) {
                candidate = item;
                extracted = result;
              }
            } catch {
              /* Try the next candidate. */
            }
          }

          await db.from("scout_research_notes").insert({
            scout_author_id: author.id,
            note:
              `Website candidate found via search: ${candidate.link}. ` +
              (extracted?.contactEmail
                ? `Email found: ${extracted.contactEmail}.`
                : extracted?.contactFormUrl
                  ? "Contact form found."
                  : "No contact method found on the page.") +
              " Identity not confirmed by staff -- verify before outreach.",
            source_url: candidate.link,
            verification_status: "unverified",
            retrieved_at: new Date().toISOString(),
            added_by: "scout_find_contact",
          });

          if (!author.website_url) {
            await db
              .from("scout_authors")
              .update({
                website_url: candidate.link,
                website_verification_status: "unverified",
                updated_at: new Date().toISOString(),
              })
              .eq("id", author.id);
          }

          return json({
            ok: true,
            found: true,
            candidateUrl: candidate.link,
            candidateTitle: extracted?.title ?? candidate.title ?? null,
            contactEmail: extracted?.contactEmail ?? null,
            contactFormUrl: extracted?.contactFormUrl ?? null,
          });
        } catch (error) {
          console.error("[admin/scout-authors.$id.find-contact] POST", error);
          return json(
            {
              ok: false,
              error: "unavailable",
              message: "Couldn't search for this author's website. Please try again.",
            },
            503,
          );
        }
      },
    },
  },
});
