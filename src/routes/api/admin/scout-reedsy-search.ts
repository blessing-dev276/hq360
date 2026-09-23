import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { isAdminRequest } from "@/lib/admin-auth.server";

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
  limit: z.number().int().min(1).max(50),
  minVerdictRating: z.number().int().min(1).max(5).default(1),
  debutOnly: z.boolean().default(false),
});

const DEBUT_MAX_BOOKS = 2;
const MAX_SEARCH_PAGES = 6;
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
        if (!(await isAdminRequest(request)))
          return json({ ok: false, error: "unauthorized" }, 401);
        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ ok: false, error: "invalid" }, 400);
        const { genreId, genreName, limit, minVerdictRating, debutOnly } = parsed.data;

        try {
          const candidates: ReedsyBook[] = [];
          let searched = 0;
          for (let page = 1; page <= MAX_SEARCH_PAGES && candidates.length < limit; page += 1) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 20_000);
            const url = new URL("https://reedsy.com/discovery/api/books");
            url.searchParams.set("query[genre_id]", String(genreId));
            url.searchParams.set("page", String(page));
            const response = await fetch(url, {
              signal: controller.signal,
              headers: { "user-agent": USER_AGENT, accept: "application/json" },
            }).finally(() => clearTimeout(timeout));
            if (!response.ok) throw new Error(`Reedsy search failed (${response.status})`);
            const data = (await response.json()) as {
              books?: ReedsyBook[];
              meta?: { next_page?: number | null };
            };
            const pageBooks = data.books ?? [];
            searched += pageBooks.length;
            candidates.push(...pageBooks.slice(0, Math.max(0, limit - candidates.length)));
            if (!data.meta?.next_page) break;
          }

          const items = await Promise.all(
            candidates.map(async (book) => {
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
