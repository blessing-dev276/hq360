import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { resolveScoutAccess } from "@/lib/scout/owner.server";
import { generatedAuthorNames } from "@/lib/scout/history.server";
import { normalizedName } from "@/lib/scout/db";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// Reedsy Discovery exclusively features self-published/indie books that
// applied for editorial review -- unlike Amazon, there's no "rating count"
// to filter on. Its own signal is the reviewer's 1-5 verdict score.
const schema = z.object({
  genreId: z.number().int().positive(),
  genreName: z.string().trim().min(1).max(120),
  limit: z.number().int().min(1).max(100),
  page: z.number().int().min(1).max(1000).default(1),
  minVerdictRating: z.number().int().min(1).max(5).default(1),
  debutOnly: z.boolean().default(false),
});

const DEBUT_MAX_BOOKS = 2;
const MAX_SEARCH_PAGES = 3;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

type ReedsyBook = {
  title?: string;
  url?: string;
  cover_url?: string;
  author?: { name?: string; uuid?: string; has_public_profile?: boolean };
  review?: {
    overview?: string;
    verdict?: { rating?: number };
    reviewer?: { name?: string };
  };
};

type ReedsyPage = { books?: ReedsyBook[]; meta?: { next_page?: number | null } };
// Share source responses across simultaneous batches; apply workspace exclusions afterwards.
const pages = new Map<string, { until: number; value: Promise<ReedsyPage> }>();
function sourcePage(genreId: number, page: number) {
  const key = `${genreId}:${page}`;
  const cached = pages.get(key);
  if (cached && cached.until > Date.now()) return cached.value;
  const url = new URL("https://reedsy.com/discovery/api/books");
  url.searchParams.set("query[genre_id]", String(genreId));
  url.searchParams.set("page", String(page));
  const value = (async () => {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(12000),
      headers: { "user-agent": USER_AGENT, accept: "application/json" },
    });
    if (!response.ok) throw new Error(`Reedsy search failed (${response.status})`);
    return (await response.json()) as ReedsyPage;
  })().catch((error) => {
    pages.delete(key);
    throw error;
  });
  if (pages.size >= 100) pages.delete(pages.keys().next().value!);
  pages.set(key, { until: Date.now() + 60000, value });
  return value;
}

function cleanTitle(value: string) {
  return value.replace(/\s*[:|–-]\s*(paperback|hardcover|kindle edition|a novel).*$/i, "").trim();
}

async function googleBooksAuthorBookCount(
  authorName: string,
  signal: AbortSignal,
): Promise<number | undefined> {
  const url = new URL("https://www.googleapis.com/books/v1/volumes");
  url.searchParams.set("q", `inauthor:"${authorName}"`);
  url.searchParams.set("maxResults", "40");
  url.searchParams.set("printType", "books");
  url.searchParams.set("fields", "items(volumeInfo(title))");
  if (process.env.GOOGLE_BOOKS_API_KEY)
    url.searchParams.set("key", process.env.GOOGLE_BOOKS_API_KEY);
  const response = await fetch(url, { signal });
  if (!response.ok) return undefined;
  const data = (await response.json()) as { items?: Array<{ volumeInfo?: { title?: string } }> };
  const titles = new Set(
    (data.items ?? []).map((item) => cleanTitle(item.volumeInfo?.title ?? "").toLocaleLowerCase()),
  );
  titles.delete("");
  return titles.size;
}

export const Route = createFileRoute("/api/admin/scout-reedsy-search")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const access = await resolveScoutAccess(request);
        if (!access) return json({ ok: false, error: "unauthorized" }, 401);
        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ ok: false, error: "invalid" }, 400);
        const { genreId, genreName, limit, minVerdictRating, debutOnly } = parsed.data;

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const seen = await generatedAuthorNames(supabaseAdmin, access.owner);
          const candidates: ReedsyBook[] = [];
          let nextPage: number | null = parsed.data.page;
          let searched = 0;
          for (
            let attempt = 0;
            attempt < MAX_SEARCH_PAGES && nextPage && candidates.length < limit;
            attempt += 1
          ) {
            const data = await sourcePage(genreId, nextPage);
            const pageBooks = data.books ?? [];
            searched += pageBooks.length;
            for (const book of pageBooks) {
              const key = normalizedName(book.author?.name ?? "");
              if (!key || !book.title || !book.url || seen.has(key)) continue;
              seen.add(key);
              candidates.push(book);
            }
            nextPage =
              data.meta?.next_page && data.meta.next_page > nextPage && data.meta.next_page <= 1000
                ? data.meta.next_page
                : null;
          }

          const items = await Promise.all(
            candidates.slice(0, limit).map(async (book) => {
              const reasons: string[] = [];
              const title = book.title ? cleanTitle(book.title) : undefined;
              const authorName = book.author?.name;
              const verdictRating = book.review?.verdict?.rating ?? null;

              if (!title || !book.url) reasons.push("missing title or listing URL");
              if (!authorName) reasons.push("author name not found");
              if (
                minVerdictRating > 1 &&
                (verdictRating === null || verdictRating < minVerdictRating)
              )
                reasons.push(
                  verdictRating === null
                    ? "no Reedsy review score found"
                    : `${verdictRating}/5 is below the minimum ${minVerdictRating}/5`,
                );

              let bookCount: number | undefined;
              if (debutOnly && authorName) {
                bookCount = await googleBooksAuthorBookCount(
                  authorName,
                  AbortSignal.timeout(10_000),
                ).catch(() => undefined);
                if (bookCount === undefined)
                  reasons.push("author's book count could not be verified");
                else if (bookCount > DEBUT_MAX_BOOKS)
                  reasons.push(`author has ${bookCount}+ books, not a debut`);
              }

              return {
                title: title ?? book.title ?? "Untitled",
                authorName: authorName ?? null,
                sourceUrl: book.url ?? "",
                coverUrl: book.cover_url ?? null,
                verdictRating,
                reviewerName: book.review?.reviewer?.name ?? null,
                overview: book.review?.overview ?? null,
                genre: genreName,
                qualified: reasons.length === 0,
                reasons,
              };
            }),
          );

          return json({
            ok: true,
            items,
            searched,
            nextPage,
            qualifying: items.filter((item) => item.qualified).length,
          });
        } catch (error) {
          console.error("[admin/scout-reedsy-search] POST", error);
          return json(
            {
              ok: false,
              error: "search_unavailable",
              message: "Reedsy search is temporarily unavailable. Please try again.",
            },
            503,
          );
        }
      },
    },
  },
});
