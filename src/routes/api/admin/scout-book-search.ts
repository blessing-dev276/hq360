import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { isAdminRequest } from "@/lib/admin-auth.server";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const AMAZON_DOMAINS = [
  "amazon.com",
  "amazon.ca",
  "amazon.com.mx",
  "amazon.com.br",
  "amazon.co.uk",
  "amazon.de",
  "amazon.fr",
  "amazon.it",
  "amazon.es",
  "amazon.nl",
  "amazon.se",
  "amazon.pl",
  "amazon.com.au",
  "amazon.co.jp",
  "amazon.in",
  "amazon.sg",
  "amazon.ae",
] as const;

const PUBLISHED_WITHIN_DAYS = { any: 0, "30": 30, "90": 90, "180": 180, "365": 365 } as const;

const schema = z.object({
  genre: z.string().trim().min(1).max(80),
  amazonDomain: z.enum(AMAZON_DOMAINS),
  country: z.string().trim().min(1).max(80),
  ratingMin: z.number().int().min(1).max(49),
  ratingMax: z.number().int().min(1).max(49),
  limit: z.number().int().min(1).max(50),
  publishedWithin: z.enum(["any", "30", "90", "180", "365"]).default("any"),
  debutOnly: z.boolean().default(false),
});

const DEBUT_MAX_BOOKS = 2;
const MAX_DISCOVERY_PAGES = 4;
const GOOGLE_BOOKS_PAGE_SIZE = 40;

function cleanTitle(value: string) {
  return value.replace(/\s*[:|–-]\s*(paperback|hardcover|kindle edition|a novel).*$/i, "").trim();
}

function publishedWithinWindow(publishedDate: string | undefined, maxAgeDays: number): boolean {
  if (maxAgeDays === 0) return true;
  if (!publishedDate) return false;
  const parsed = new Date(/^\d{4}$/.test(publishedDate) ? `${publishedDate}-01-01` : publishedDate);
  if (Number.isNaN(parsed.getTime())) return false;
  const ageDays = (Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24);
  return ageDays <= maxAgeDays;
}

type GoogleBookItem = {
  volumeInfo?: { title?: string; authors?: string[]; publishedDate?: string };
};

async function fetchNewReleases(
  genre: string,
  startIndex: number,
  signal: AbortSignal,
): Promise<GoogleBookItem[]> {
  const url = new URL("https://www.googleapis.com/books/v1/volumes");
  url.searchParams.set("q", `subject:"${genre}"`);
  url.searchParams.set("orderBy", "newest");
  url.searchParams.set("printType", "books");
  url.searchParams.set("maxResults", String(GOOGLE_BOOKS_PAGE_SIZE));
  url.searchParams.set("startIndex", String(startIndex));
  url.searchParams.set("fields", "items(volumeInfo(title,authors,publishedDate))");
  if (process.env.GOOGLE_BOOKS_API_KEY)
    url.searchParams.set("key", process.env.GOOGLE_BOOKS_API_KEY);
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Google Books search failed (${response.status})`);
  const data = (await response.json()) as { items?: GoogleBookItem[] };
  return data.items ?? [];
}

async function googleBooksAuthorBookCount(
  authorName: string,
  signal: AbortSignal,
): Promise<number> {
  const url = new URL("https://www.googleapis.com/books/v1/volumes");
  url.searchParams.set("q", `inauthor:"${authorName}"`);
  url.searchParams.set("maxResults", "40");
  url.searchParams.set("printType", "books");
  url.searchParams.set("fields", "items(volumeInfo(title))");
  if (process.env.GOOGLE_BOOKS_API_KEY)
    url.searchParams.set("key", process.env.GOOGLE_BOOKS_API_KEY);
  const response = await fetch(url, { signal });
  if (!response.ok) return DEBUT_MAX_BOOKS + 1;
  const data = (await response.json()) as { items?: Array<{ volumeInfo?: { title?: string } }> };
  const titles = new Set(
    (data.items ?? []).map((item) => cleanTitle(item.volumeInfo?.title ?? "").toLocaleLowerCase()),
  );
  titles.delete("");
  return titles.size;
}

type AmazonMatch = { asin: string; reviewCount: number } | undefined;

async function findAmazonListing(
  title: string,
  authorName: string,
  amazonDomain: string,
  apiKey: string,
  signal: AbortSignal,
): Promise<AmazonMatch> {
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "amazon");
  url.searchParams.set("amazon_domain", amazonDomain);
  url.searchParams.set("k", `${title} ${authorName}`);
  url.searchParams.set("api_key", apiKey);
  const response = await fetch(url, { signal });
  if (!response.ok) return undefined;
  const data = (await response.json()) as {
    organic_results?: Array<{ asin?: string; title?: string; reviews?: number }>;
  };
  const wanted = cleanTitle(title).toLocaleLowerCase();
  const match = (data.organic_results ?? []).find((item) => {
    if (!item.asin || !Number.isInteger(item.reviews)) return false;
    const candidate = cleanTitle(item.title ?? "").toLocaleLowerCase();
    return candidate.includes(wanted) || wanted.includes(candidate);
  });
  if (!match?.asin || !Number.isInteger(match.reviews)) return undefined;
  return { asin: match.asin, reviewCount: match.reviews! };
}

export const Route = createFileRoute("/api/admin/scout-book-search")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await isAdminRequest(request)))
          return json({ ok: false, error: "unauthorized" }, 401);
        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success || parsed.data.ratingMin > parsed.data.ratingMax)
          return json({ ok: false, error: "invalid" }, 400);
        const apiKey = process.env.SERPAPI_API_KEY;
        if (!apiKey)
          return json(
            {
              ok: false,
              error: "search_not_configured",
              message:
                "The Amazon rating cross-check needs SERPAPI_API_KEY in the server environment.",
            },
            503,
          );

        const {
          genre,
          amazonDomain,
          country,
          ratingMin,
          ratingMax,
          limit,
          publishedWithin,
          debutOnly,
        } = parsed.data;
        const maxAgeDays = PUBLISHED_WITHIN_DAYS[publishedWithin];

        try {
          const seen = new Set<string>();
          let searched = 0;
          let skippedTooOld = 0;
          let skippedNotDebut = 0;
          let skippedNoAmazonMatch = 0;
          const items: Array<{
            asin: string;
            title: string;
            authorName: string;
            reviewCount: number;
            sourceUrl: string;
            genre: string;
            country: string;
            publishedDate: string | undefined;
          }> = [];

          for (let page = 0; page < MAX_DISCOVERY_PAGES && items.length < limit; page += 1) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 20_000);
            const pageItems = await fetchNewReleases(
              genre,
              page * GOOGLE_BOOKS_PAGE_SIZE,
              controller.signal,
            ).finally(() => clearTimeout(timeout));
            if (pageItems.length === 0) break;
            searched += pageItems.length;

            for (const raw of pageItems) {
              if (items.length >= limit) break;
              const title = raw.volumeInfo?.title;
              const authorName = raw.volumeInfo?.authors?.[0]?.trim();
              const publishedDate = raw.volumeInfo?.publishedDate;
              if (!title || !authorName) continue;
              const key = `${cleanTitle(title).toLocaleLowerCase()}::${authorName.toLocaleLowerCase()}`;
              if (seen.has(key)) continue;
              seen.add(key);

              if (!publishedWithinWindow(publishedDate, maxAgeDays)) {
                skippedTooOld += 1;
                continue;
              }

              if (debutOnly) {
                const bookCount = await googleBooksAuthorBookCount(
                  authorName,
                  AbortSignal.timeout(10_000),
                ).catch(() => DEBUT_MAX_BOOKS + 1);
                if (bookCount > DEBUT_MAX_BOOKS) {
                  skippedNotDebut += 1;
                  continue;
                }
              }

              const amazonMatch = await findAmazonListing(
                title,
                authorName,
                amazonDomain,
                apiKey,
                AbortSignal.timeout(15_000),
              ).catch(() => undefined);
              if (
                !amazonMatch ||
                amazonMatch.reviewCount < ratingMin ||
                amazonMatch.reviewCount > ratingMax
              ) {
                skippedNoAmazonMatch += 1;
                continue;
              }

              items.push({
                asin: amazonMatch.asin,
                title: cleanTitle(title),
                authorName,
                reviewCount: amazonMatch.reviewCount,
                sourceUrl: `https://www.${amazonDomain}/dp/${amazonMatch.asin}`,
                genre,
                country,
                publishedDate,
              });
            }
          }

          return json({
            ok: true,
            items,
            searched,
            qualifying: items.length,
            skippedTooOld,
            skippedNotDebut,
            skippedNoAmazonMatch,
          });
        } catch (error) {
          console.error("[admin/scout-book-search] POST", error);
          return json(
            {
              ok: false,
              error: "search_unavailable",
              message: "Book search is temporarily unavailable. Please try again.",
            },
            503,
          );
        }
      },
    },
  },
});
