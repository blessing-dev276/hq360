import { z } from "zod";
import { SCOUT_AUDIENCES, type AudienceSource } from "./audiences";
import { canonicalUrl } from "./normalize";

export const audienceSearchSchema = z
  .object({
    requestId: z.string().uuid(),
    audience: z
      .string()
      .refine((value) => SCOUT_AUDIENCES.some((item) => item.id === value), "Choose an audience."),
    source: z.enum(["maps", "web"]),
    niche: z.string().trim().min(2).max(120),
    location: z.string().trim().max(120).default(""),
    limit: z.union([z.literal(10), z.literal(20)]).default(10),
    page: z.number().int().min(1).max(10).default(1),
  })
  .refine((value) => value.source !== "maps" || value.location.length >= 2, {
    message: "Enter a location for Maps search.",
  });
export type AudienceSearchInput = z.infer<typeof audienceSearchSchema>;
const text = (value: unknown, max = 2000) =>
  typeof value === "string" ? value.trim().slice(0, max) || null : null;
const number = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;
export function publicResultUrl(value: unknown) {
  const url = canonicalUrl(text(value) ?? undefined);
  if (!url) return null;
  const hostname = new URL(url).hostname;
  if (
    !hostname.includes(".") ||
    /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(hostname) ||
    hostname.endsWith(".local") ||
    hostname.startsWith("[")
  )
    return null;
  return url;
}
export function parseAudienceResults(body: Record<string, unknown>, source: AudienceSource) {
  const rows = body[source === "maps" ? "local_results" : "organic_results"];
  if (!Array.isArray(rows)) return [];
  const seen = new Set<string>();
  return rows.flatMap((value: unknown) => {
    if (!value || typeof value !== "object") return [];
    const item = value as Record<string, unknown>;
    const name = text(item.title, 300);
    const website = publicResultUrl(source === "maps" ? item.website : item.link);
    const place = text(item.place_id, 300);
    const dataId = text(item.data_id, 300);
    const sourceUrl =
      source === "maps"
        ? place
          ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name ?? "")}&query_place_id=${encodeURIComponent(place)}`
          : (publicResultUrl(item.link) ??
            (dataId
              ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([name, text(item.address)].filter(Boolean).join(" "))}`
              : null))
        : website;
    const key = source === "maps" ? (place ?? dataId ?? sourceUrl) : sourceUrl;
    if (!name || !key || !sourceUrl || seen.has(key)) return [];
    seen.add(key);
    const rating = number(item.rating),
      reviews = number(item.reviews);
    return [
      {
        source_key: key,
        name,
        source_url: sourceUrl,
        website_url: website,
        description: text(item.snippet),
        category: source === "maps" ? text(item.type, 150) : null,
        address: source === "maps" ? text(item.address, 500) : null,
        phone: source === "maps" ? text(item.phone, 100) : null,
        rating: source === "maps" && rating !== null && rating >= 0 && rating <= 5 ? rating : null,
        review_count:
          source === "maps" &&
          reviews !== null &&
          Number.isInteger(reviews) &&
          reviews >= 0 &&
          reviews <= 2147483647
            ? reviews
            : null,
      },
    ];
  });
}
export async function serpSearch(
  params: Record<string, string>,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
) {
  const key = process.env.SERPAPI_API_KEY;
  if (!key)
    throw new Error(
      "Maps and web search are not configured. Ask an administrator to enable the search connection.",
    );
  const url = new URL("https://serpapi.com/search.json");
  url.search = new URLSearchParams({ ...params, api_key: key }).toString();
  let response: Response;
  let body: Record<string, unknown>;
  try {
    response = await fetcher(url, { signal });
    const data: unknown = await response.json();
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error();
    body = data as Record<string, unknown>;
  } catch {
    throw new Error(
      signal.aborted
        ? "Search timed out. Please retry."
        : "The search provider is unavailable. Please retry.",
    );
  }
  const empty =
    body.search_information &&
    typeof body.search_information === "object" &&
    (body.search_information as Record<string, unknown>).organic_results_state === "Fully empty";
  if (!response.ok || (body.error && !empty)) {
    throw new Error(
      response.status === 429
        ? "Search quota is temporarily exhausted. Please try later."
        : "The search provider could not complete this request. Please retry.",
    );
  }
  return body;
}
export function audienceQuery(input: AudienceSearchInput) {
  const audience = SCOUT_AUDIENCES.find((item) => item.id === input.audience)!;
  return [input.niche, audience.query, input.location].filter(Boolean).join(" ");
}
export async function searchAudience(input: AudienceSearchInput, signal: AbortSignal) {
  const query = audienceQuery(input);
  const offset = (input.page - 1) * (input.source === "maps" ? 20 : input.limit);
  const pages = input.source === "web" && input.limit === 20 ? [offset, offset + 10] : [offset];
  const results = await Promise.all(
    pages.map((start) =>
      serpSearch(
        {
          engine: input.source === "maps" ? "google_maps" : "google",
          q: query,
          start: String(start),
          hl: "en",
          ...(input.source === "maps" ? { type: "search" } : {}),
        },
        signal,
      ),
    ),
  );
  const unique = new Map(
    results
      .flatMap((body) => parseAudienceResults(body, input.source))
      .map((item) => [item.source_key, item]),
  );
  return { query, items: [...unique.values()].slice(0, input.limit) };
}
export function emailSearchScope(website: string) {
  const url = new URL(website);
  const host = url.hostname.replace(/^www\./, "");
  // Shared platforms must be scoped to the actual profile/page, never the whole directory.
  const shared =
    /(^|\.)(instagram\.com|facebook\.com|linkedin\.com|youtube\.com|tiktok\.com|x\.com|twitter\.com|yelp\.com|wikipedia\.org|google\.com)$/i.test(
      host,
    );
  if (shared && url.pathname === "/") return null;
  return {
    query: `site:${host}${shared ? url.pathname : ""} contact email`,
    host,
    path: shared ? url.pathname.replace(/\/$/, "") : null,
  };
}
export function indexedEmail(
  body: Record<string, unknown>,
  website: string,
): { email: string; sourceUrl: string } | null {
  const scope = emailSearchScope(website);
  if (!scope) return null;
  const { host } = scope;
  const rows = Array.isArray(body.organic_results) ? body.organic_results : [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    const url = publicResultUrl(item.link);
    if (!url) continue;
    const resultHost = new URL(url).hostname.replace(/^www\./, "");
    if (resultHost !== host && !resultHost.endsWith(`.${host}`)) continue;
    if (
      scope.path &&
      new URL(url).pathname !== scope.path &&
      !new URL(url).pathname.startsWith(`${scope.path}/`)
    )
      continue;
    const email = text(item.snippet)?.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)?.[0];
    if (email && email.length <= 254 && !/\.(png|jpg|jpeg|webp|svg)$/i.test(email))
      return { email, sourceUrl: url };
  }
  return null;
}
