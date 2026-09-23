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

// Email is the only outcome that counts as a real find -- a contact form is
// kept as fallback info to show, never as a reason to stop looking.
function pickBestEmail(emails: string[]): string | undefined {
  const unique = [...new Set(emails.map((email) => email.toLowerCase()))];
  return unique.find((email) => /@gmail\.com$/.test(email)) ?? unique[0];
}

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
  const mailtoMatches = [...html.matchAll(/mailto:([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/gi)].map(
    (match) => match[1]!,
  );
  const textEmailMatches = [...html.matchAll(/\b([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})\b/gi)].map(
    (match) => match[1]!,
  );
  const contactLinkMatch =
    html.match(/<a[^>]+href=["']([^"']+)["'][^>]*>[^<]*contact[^<]*<\/a>/i) ??
    html.match(/<a[^>]+href=["']([^"'#]*contact[^"']*)["']/i);
  return {
    title: titleMatch?.[1]?.trim(),
    contactEmail: pickBestEmail([...mailtoMatches, ...textEmailMatches]),
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

        const serpApiKey: string = apiKey;

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

          type Candidate = { link: string; title?: string };
          type Extracted = Awaited<ReturnType<typeof extractContact>>;
          const seenLinks = new Set<string>();
          let best: { candidate: Candidate; extracted: Extracted } | null = null;

          async function tryQuery(
            query: string,
          ): Promise<{ candidate: Candidate; extracted: Extracted } | null> {
            const results = await searchCandidates(query, serpApiKey, searchController.signal);
            const fresh = results.filter(
              (item): item is Candidate =>
                Boolean(item.link) &&
                !EXCLUDED_HOSTS.test(item.link!) &&
                !seenLinks.has(item.link!),
            );
            let fallback: { candidate: Candidate; extracted: Extracted } | null = null;
            for (const item of fresh.slice(0, 8)) {
              seenLinks.add(item.link);
              try {
                const result = await extractContact(item.link, AbortSignal.timeout(15_000));
                // An email address is the only thing worth stopping for --
                // a contact form alone doesn't end the search.
                if (result.contactEmail) return { candidate: item, extracted: result };
                fallback ??= { candidate: item, extracted: result };
              } catch {
                /* Try the next candidate. */
              }
            }
            return fallback;
          }

          try {
            const attempts = [
              `"${author.name}" author website`,
              `"${author.name}" email contact`,
              `"${author.name}" books contact`,
            ];
            for (const query of attempts) {
              const result = await tryQuery(query);
              if (result?.extracted.contactEmail) {
                best = result;
                break;
              }
              best ??= result;
            }
          } finally {
            clearTimeout(searchTimeout);
          }

          if (!best)
            return json({ ok: true, found: false, message: "No likely official website found." });
          const { candidate, extracted } = best;

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
