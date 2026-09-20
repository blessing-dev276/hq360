import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { isAdminRequest } from "@/lib/admin-auth.server";
import { asScoutDb, normalizedName, type ScoutAuthor, type ScoutBook } from "@/lib/scout/db";
import { SOURCE_ADAPTERS, type DiscoveredBookCandidate } from "@/lib/scout/adapters";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const discoverSchema = z
  .object({
    query: z.string().trim().max(200).optional(),
    genre: z.string().trim().max(80).optional(),
    sources: z.array(z.string()).optional(),
    maxResults: z.number().int().positive().max(40).optional(),
  })
  // A genre alone is a valid discovery query (browse by genre); at least
  // one of query/genre must be given so the adapters have something to
  // search on. Country isn't offered here -- Google Books/Open Library
  // don't expose author nationality, so it can only be applied as a filter
  // on already-discovered/researched authors (see scout-books.ts), not as
  // a discovery-time query.
  .refine((v) => Boolean(v.query?.trim() || v.genre?.trim()), {
    message: "query_or_genre_required",
  });

function normalizedTitle(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

/** Sources vary in date precision -- Google Books can give "YYYY-MM-DD",
 * "YYYY-MM", or just "YYYY"; Open Library only ever gives a year. Only a
 * full date goes into the `date` column; a bare year goes into
 * publication_year instead of being padded into a fabricated date. */
function parsePublicationDate(value: string | undefined): {
  date: string | null;
  year: number | null;
} {
  if (!value) return { date: null, year: null };
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return { date: value, year: Number(value.slice(0, 4)) };
  const year = value.match(/^\d{4}$/)?.[0];
  return { date: null, year: year ? Number(year) : null };
}

export const Route = createFileRoute("/api/admin/scout-discover")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await isAdminRequest(request)))
          return json({ ok: false, error: "unauthorized" }, 401);
        let body: z.infer<typeof discoverSchema>;
        try {
          body = discoverSchema.parse(await request.json());
        } catch {
          return json({ ok: false, error: "invalid" }, 400);
        }

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = asScoutDb(supabaseAdmin);

          const { data: sourceRows } = await db
            .from("scout_sources")
            .select("slug, enabled, kind")
            .in(
              "slug",
              body.sources && body.sources.length > 0 ? body.sources : Object.keys(SOURCE_ADAPTERS),
            );
          const enabledSlugs = new Set(
            ((sourceRows ?? []) as { slug: string; enabled: boolean }[])
              .filter((s) => s.enabled)
              .map((s) => s.slug),
          );
          const activeSlugs = Object.keys(SOURCE_ADAPTERS).filter((slug) => enabledSlugs.has(slug));
          if (activeSlugs.length === 0)
            return json({ ok: false, error: "no_enabled_sources" }, 400);

          const results = await Promise.all(
            activeSlugs.map(async (slug) => {
              const adapter = SOURCE_ADAPTERS[slug];
              if (!adapter) return { slug, candidates: [] as DiscoveredBookCandidate[] };
              try {
                const candidates = await adapter.discover({
                  query: body.query?.trim() || "",
                  genre: body.genre,
                  maxResults: body.maxResults,
                });
                await db
                  .from("scout_sources")
                  .update({ last_synced_at: new Date().toISOString(), last_error: null })
                  .eq("slug", slug);
                return { slug, candidates };
              } catch (err) {
                await db
                  .from("scout_sources")
                  .update({
                    last_error: err instanceof Error ? err.message : "Unknown adapter error",
                    error_count: 1,
                  })
                  .eq("slug", slug);
                return { slug, candidates: [] as DiscoveredBookCandidate[] };
              }
            }),
          );

          const saved: { author: ScoutAuthor; book: ScoutBook }[] = [];
          // Authors newly created within this same discovery run stay
          // eligible for their other candidate books; an author that
          // already existed before this run (found in a prior search) is
          // skipped entirely rather than resurfaced.
          const newAuthorsThisRun = new Map<string, ScoutAuthor>();
          const skippedAuthors = new Set<string>();
          for (const { slug, candidates } of results) {
            for (const candidate of candidates) {
              const authorNorm = normalizedName(candidate.authorName);
              if (skippedAuthors.has(authorNorm)) continue;

              let authorRow = newAuthorsThisRun.get(authorNorm);
              if (!authorRow) {
                const { data: existingAuthor } = await db
                  .from("scout_authors")
                  .select("*")
                  .eq("normalized_name", authorNorm)
                  .maybeSingle();
                if (existingAuthor) {
                  skippedAuthors.add(authorNorm);
                  continue;
                }

                const { data: created, error: authorErr } = await db
                  .from("scout_authors")
                  .insert({ name: candidate.authorName, normalized_name: authorNorm })
                  .select("*")
                  .single();
                if (authorErr || !created) continue;
                authorRow = created as ScoutAuthor;
                newAuthorsThisRun.set(authorNorm, authorRow);
              }

              const titleNorm = normalizedTitle(candidate.title);
              let { data: book } = await db
                .from("scout_discovered_books")
                .select("*")
                .eq("scout_author_id", authorRow.id)
                .eq("normalized_title", titleNorm)
                .maybeSingle();
              if (!book) {
                const { date, year } = parsePublicationDate(candidate.publicationDate);
                const { data: created, error: bookErr } = await db
                  .from("scout_discovered_books")
                  .insert({
                    scout_author_id: authorRow.id,
                    title: candidate.title,
                    normalized_title: titleNorm,
                    genre: candidate.genre ?? null,
                    publication_date: date,
                    publication_year: year,
                    book_format: candidate.bookFormat ?? "unknown",
                    publisher: candidate.publisher ?? null,
                    isbn: candidate.isbn ?? null,
                    source_slug: slug,
                    source_url: candidate.sourceUrl ?? null,
                    external_id: candidate.externalId ?? null,
                    raw_data: candidate.rawData,
                  })
                  .select("*")
                  .single();
                if (bookErr || !created) continue;
                book = created;
              }
              const bookRow = book as ScoutBook;

              if (candidate.reviewSignal) {
                await db.from("scout_review_counts").upsert(
                  {
                    book_id: bookRow.id,
                    platform: candidate.reviewSignal.platform,
                    review_count: candidate.reviewSignal.reviewCount,
                    rating: candidate.reviewSignal.rating,
                    verified: candidate.reviewSignal.verified,
                    source_url: candidate.sourceUrl ?? null,
                    retrieved_at: new Date().toISOString(),
                  },
                  { onConflict: "book_id,platform" },
                );
              }

              saved.push({ author: authorRow, book: bookRow });
            }
          }

          // Dedupe by book id -- the same title can legitimately surface
          // from more than one source in a single query.
          const uniqueByBook = new Map(saved.map((row) => [row.book.id, row]));
          return json({ ok: true, count: uniqueByBook.size, items: [...uniqueByBook.values()] });
        } catch (err) {
          console.error("[admin/scout-discover] POST", err instanceof Error ? err.message : err);
          return json({ ok: false, error: "unavailable" }, 503);
        }
      },
    },
  },
});
