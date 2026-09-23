import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { isAdminRequest } from "@/lib/admin-auth.server";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const schema = z.object({
  genre: z.string().trim().min(1).max(80),
  amazonDomain: z.enum(["amazon.com", "amazon.ca", "amazon.de", "amazon.co.uk", "amazon.com.au"]),
  country: z.string().trim().min(1).max(80),
  ratingMin: z.number().int().min(1).max(49),
  ratingMax: z.number().int().min(1).max(49),
});

type AmazonResult = {
  asin?: string;
  title?: string;
  link_clean?: string;
  reviews?: number;
  authors?: Array<{ name?: string } | string>;
  author?: string;
  brand?: string;
};

function cleanTitle(value: string) {
  return value.replace(/\s*[:|–-]\s*(paperback|hardcover|kindle edition|a novel).*$/i, "").trim();
}

function embeddedAuthor(result: AmazonResult) {
  const first = result.authors?.[0];
  if (typeof first === "string") return first.trim();
  if (first?.name) return first.name.trim();
  return result.author?.trim() || undefined;
}

async function googleBooksAuthor(title: string, signal: AbortSignal) {
  const url = new URL("https://www.googleapis.com/books/v1/volumes");
  url.searchParams.set("q", `intitle:"${cleanTitle(title)}"`);
  url.searchParams.set("maxResults", "5");
  url.searchParams.set("printType", "books");
  url.searchParams.set("fields", "items(volumeInfo(title,authors))");
  if (process.env.GOOGLE_BOOKS_API_KEY)
    url.searchParams.set("key", process.env.GOOGLE_BOOKS_API_KEY);
  const response = await fetch(url, { signal });
  if (!response.ok) return undefined;
  const data = (await response.json()) as {
    items?: Array<{ volumeInfo?: { title?: string; authors?: string[] } }>;
  };
  const wanted = cleanTitle(title).toLocaleLowerCase();
  const match = data.items?.find(({ volumeInfo }) => {
    const candidate = cleanTitle(volumeInfo?.title ?? "").toLocaleLowerCase();
    return candidate === wanted || candidate.includes(wanted) || wanted.includes(candidate);
  });
  return match?.volumeInfo?.authors?.[0]?.trim();
}

export const Route = createFileRoute("/api/admin/scout-amazon-search")({
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
              message: "Automatic Amazon search needs SERPAPI_API_KEY in the server environment.",
            },
            503,
          );

        const { genre, amazonDomain, country, ratingMin, ratingMax } = parsed.data;
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 45_000);
          const url = new URL("https://serpapi.com/search.json");
          url.searchParams.set("engine", "amazon");
          url.searchParams.set("amazon_domain", amazonDomain);
          url.searchParams.set("k", `${genre} books`);
          url.searchParams.set("api_key", apiKey);
          const response = await fetch(url, { signal: controller.signal }).finally(() =>
            clearTimeout(timeout),
          );
          const data = (await response.json()) as {
            error?: string;
            organic_results?: AmazonResult[];
          };
          if (!response.ok || data.error)
            throw new Error(data.error || `Search failed (${response.status})`);

          const qualifying = (data.organic_results ?? [])
            .filter(
              (item) =>
                item.asin &&
                item.title &&
                Number.isInteger(item.reviews) &&
                item.reviews! >= ratingMin &&
                item.reviews! <= ratingMax,
            )
            .slice(0, 20);
          const items = (
            await Promise.all(
              qualifying.map(async (item) => {
                const authorName =
                  embeddedAuthor(item) ??
                  (await googleBooksAuthor(item.title!, AbortSignal.timeout(10_000)).catch(
                    () => undefined,
                  ));
                if (!authorName) return null;
                return {
                  asin: item.asin!,
                  title: cleanTitle(item.title!),
                  authorName,
                  reviewCount: item.reviews!,
                  sourceUrl: `https://www.${amazonDomain}/dp/${item.asin}`,
                  genre,
                  country,
                };
              }),
            )
          ).filter((item): item is NonNullable<typeof item> => Boolean(item));

          return json({
            ok: true,
            items,
            searched: data.organic_results?.length ?? 0,
            qualifying: qualifying.length,
            skippedWithoutAuthor: qualifying.length - items.length,
          });
        } catch (error) {
          console.error("[admin/scout-amazon-search] POST", error);
          return json(
            {
              ok: false,
              error: "search_unavailable",
              message: "Amazon search is temporarily unavailable. Please try again.",
            },
            503,
          );
        }
      },
    },
  },
});
