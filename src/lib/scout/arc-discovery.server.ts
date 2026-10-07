import { z } from "zod";
import { load } from "cheerio";
import robotsParser from "robots-parser";
import { ARC_SOURCES, type ArcSource, type ArcCandidate } from "./arc-sources";
import { serpSearch } from "./audience-search.server";
export function isoPublicationDate(value: string) {
  const cleaned = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    const date = new Date(`${cleaned}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === cleaned
      ? cleaned
      : null;
  }
  const match = cleaned.match(
    /^(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2}),?\s+(\d{4})$/i,
  );
  if (!match) return null;
  const month =
    ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(
      match[1]!.slice(0, 3).toLowerCase(),
    ) + 1;
  return isoPublicationDate(
    `${match[3]}-${String(month).padStart(2, "0")}-${match[2]!.padStart(2, "0")}`,
  );
}
const dateField = z
  .string()
  .refine(
    (value) => value === "" || isoPublicationDate(value) === value,
    "Use a valid publication date.",
  )
  .default("");
export const arcSearchSchema = z
  .object({
    requestId: z.string().uuid(),
    source: z.enum([
      "netgalley",
      "booksirens",
      "booksprout",
      "storyorigin",
      "booklife",
      "onlinebookclub",
      "booknotification",
    ]),
    genre: z.string().trim().max(80).default(""),
    from: dateField,
    to: dateField,
    includeUnknown: z.boolean().default(true),
    page: z.number().int().min(1).max(10).default(1),
    limit: z.number().int().min(1).max(10).default(10),
    listingUrl: z.string().trim().max(2000).optional(),
  })
  .refine(
    (value) => !value.from || !value.to || value.from <= value.to,
    "End date must be on or after the start date.",
  );
export function arcListingUrl(source: ArcSource, value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const u = new URL(value, ARC_SOURCES[source].origin),
      host = new URL(ARC_SOURCES[source].origin).hostname;
    if (source === "booklife" && u.protocol === "http:") u.protocol = "https:";
    if (
      u.protocol !== "https:" ||
      u.username ||
      u.password ||
      u.port ||
      u.hostname.replace(/^www\./, "") !== host.replace(/^www\./, "")
    )
      return null;
    const patterns = {
      netgalley: /^\/catalog\/book\/\d+\/?$/,
      booksirens: /^\/book\/[A-Z0-9]+(?:\/[A-Z0-9]+)?\/?$/i,
      booksprout: /^\/reviewer\/review-copy\/view\/\d+\/[a-z0-9-]+\/?$/i,
      storyorigin: /^\/reviewcopies\/[a-f0-9-]{36}\/?$/i,
      booklife: /^\/project\/[a-z0-9-]+-\d+\/?$/i,
      onlinebookclub: /^\/shelves\/book\.php$/i,
      booknotification: /^\/authors\/[a-z0-9-]+\/?$/i,
    };
    if (!patterns[source].test(u.pathname)) return null;
    if (source === "onlinebookclub") {
      const id = u.searchParams.get("id");
      if (!id || !/^\d+$/.test(id)) return null;
      return `${ARC_SOURCES[source].origin}/shelves/book.php?id=${id}`;
    }
    return `${ARC_SOURCES[source].origin}${u.pathname.replace(/\/$/, "")}`;
  } catch {
    return null;
  }
}
export function labeledPublicationDate(text: string) {
  const match = text.match(
    /(?:Pub(?:lication)?\s*Date|Release\s*Date)\s*:?\s*(\d{4}-\d{2}-\d{2}|[A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
  );
  return match ? isoPublicationDate(match[1]!) : null;
}
export function parseArcIndex(source: ArcSource, body: Record<string, unknown>): ArcCandidate[] {
  const seen = new Set<string>();
  return (Array.isArray(body.organic_results) ? body.organic_results : []).flatMap(
    (row: unknown) => {
      if (!row || typeof row !== "object") return [];
      const item = row as Record<string, unknown>,
        url = arcListingUrl(source, item.link);
      if (!url || seen.has(url) || typeof item.title !== "string") return [];
      seen.add(url);
      let title = item.title
        .replace(
          /\s*[|–-]\s*(NetGalley|BookSirens|Booksprout|StoryOrigin|BookLife|OnlineBookClub(?:\.org)?).*$/i,
          "",
        )
        .replace(/^Viewing\s+/i, "")
        .replace(/\s+Review Copy$/i, "")
        .trim();
      let author: string | null = null;
      if (source === "netgalley") {
        const parts = title.split(/\s+\|\s+/);
        title = parts[0] ?? title;
        author = parts[1]?.trim() || null;
      }
      const by = title.match(/^(.+?)\s+by\s+(.+?)(?:\s+-\s+Review Copy)?$/i);
      if (by && source !== "netgalley") {
        title = by[1]!.trim();
        author = by[2]!.trim();
      }
      if (author && (author.length > 160 || /\.{3}|…|^\d+$/.test(author))) author = null;
      const evidence = typeof item.snippet === "string" ? item.snippet.slice(0, 700) : "";
      return [
        {
          source_url: url,
          title: title.slice(0, 300),
          author_name: author,
          publication_date: labeledPublicationDate(evidence),
          genre: null,
          evidence,
          discovery_method: "search_index" as const,
        },
      ];
    },
  );
}
export function matchesPublicationWindow(
  item: ArcCandidate,
  from: string,
  to: string,
  includeUnknown: boolean,
) {
  if (!item.publication_date) return includeUnknown;
  return (!from || item.publication_date >= from) && (!to || item.publication_date <= to);
}
const AGENT = "HQ360-Scout/1.0 (+https://www.hq360.space)";
async function publicPage(url: string, origin: string, signal: AbortSignal) {
  const u = new URL(url);
  if (u.origin !== origin) throw new Error("Invalid catalogue URL.");
  const response = await fetch(url, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]),
    redirect: "manual",
    headers: { "User-Agent": AGENT, Accept: "text/html,text/plain" },
  });
  if (!response.ok)
    throw new Error("This public catalogue page is unavailable or requires sign-in.");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Empty catalogue response.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 2000000) throw new Error("Catalogue response is too large.");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(bytes);
}
const publicBooksirens = (url: string, signal: AbortSignal) =>
  publicPage(url, ARC_SOURCES.booksirens.origin, signal);
export function parseBooknotificationUpcoming(html: string): ArcCandidate[] {
  const $ = load(html);
  const heading = $(".card-header h5")
    .toArray()
    .find((element) => $(element).text().trim().toLowerCase() === "upcoming books");
  if (!heading) return [];
  const seen = new Set<string>();
  return $(heading)
    .closest(".card")
    .find(".card-body .d-flex.btn-reveal-trigger")
    .toArray()
    .flatMap((element) => {
      const row = $(element),
        title = row.find("h6 a").first().text().trim(),
        authorLink = row.find("p a[href^='/authors/']").first(),
        author = authorLink.text().trim(),
        sourceUrl = arcListingUrl("booknotification", authorLink.attr("href"));
      if (!title || !author || !sourceUrl || seen.has(sourceUrl)) return [];
      seen.add(sourceUrl);
      return [
        {
          source_url: sourceUrl,
          title: title.slice(0, 300),
          author_name: author.slice(0, 160),
          publication_date: null,
          genre: null,
          evidence:
            "Shown in BookNotification's public upcoming books list; review count is not supplied.",
          discovery_method: "public_catalog" as const,
        },
      ];
    });
}
export function parseBooksirensPage(html: string, url: string): ArcCandidate | null {
  const $ = load(html),
    fullTitle = $("title").text();
  const by = fullTitle.match(/^(.+?)\s+by\s+(.+?)\s+-\s+Review Copy\s*\|\s*BookSirens/i);
  if (!by || !arcListingUrl("booksirens", url)) return null;
  $("script,style,nav,footer").remove();
  const body = $("body").text().replace(/\s+/g, " ");
  const genre =
    body
      .match(/Genres\s*(.+?)(?:Trigger Warnings|Type of Ending|Series|Author Prefers)/i)?.[1]
      ?.trim()
      .slice(0, 80) ?? null;
  return {
    source_url: arcListingUrl("booksirens", url)!,
    title: by[1]!.trim().slice(0, 300),
    author_name: by[2]!.trim().slice(0, 160),
    publication_date: labeledPublicationDate(body),
    genre,
    evidence: [
      genre ? `Genres: ${genre}` : "",
      labeledPublicationDate(body) ? `Publication Date: ${labeledPublicationDate(body)}` : "",
    ]
      .filter(Boolean)
      .join(" · "),
    discovery_method: "public_catalog",
  };
}
export async function discoverArc(input: z.infer<typeof arcSearchSchema>, signal: AbortSignal) {
  if (input.listingUrl) {
    const url = arcListingUrl(input.source, input.listingUrl);
    if (!url) throw new Error("Use a book/review-copy URL from the selected source.");
    return {
      items: [
        {
          source_url: url,
          title: "",
          author_name: null,
          publication_date: null,
          genre: null,
          evidence:
            "Listing added manually. Confirm its title, author and publication date on the source page.",
          discovery_method: "manual" as const,
        },
      ],
      checked: 1,
      skipped: 0,
    };
  }
  let items: ArcCandidate[] = [];
  let skipped = 0;
  if (input.source === "booknotification") {
    if (input.genre || input.page !== 1)
      throw new Error(
        "BookNotification currently offers a recent release sample. Choose All genres and page 1.",
      );
    const robotsUrl = `${ARC_SOURCES.booknotification.origin}/robots.txt`;
    const robots = robotsParser(
      robotsUrl,
      await publicPage(robotsUrl, ARC_SOURCES.booknotification.origin, signal),
    );
    if (robots.isAllowed(ARC_SOURCES.booknotification.browse, AGENT) === false)
      throw new Error("BookNotification currently disallows catalogue access.");
    items = parseBooknotificationUpcoming(
      await publicPage(
        ARC_SOURCES.booknotification.browse,
        ARC_SOURCES.booknotification.origin,
        signal,
      ),
    ).slice(0, input.limit);
    if (!items.length)
      throw new Error("The public BookNotification release list changed or is unavailable.");
  } else if (input.source === "booksirens") {
    const robotsUrl = "https://booksirens.com/robots.txt",
      robots = robotsParser(robotsUrl, await publicBooksirens(robotsUrl, signal));
    let catalog: string = ARC_SOURCES.booksirens.browse;
    if (robots.isAllowed(catalog, AGENT) === false)
      throw new Error("BookSirens currently disallows catalogue access.");
    let html = await publicBooksirens(catalog, signal);
    if (input.genre) {
      const $ = load(html);
      const path = $("a[href^='/books/']")
        .toArray()
        .map((e) => ({ path: $(e).attr("href")!, label: $(e).text() }))
        .find(
          (item) =>
            item.label.toLowerCase().includes(input.genre.toLowerCase()) ||
            item.path.includes(input.genre.toLowerCase().replaceAll(" ", "-")),
        )?.path;
      if (!path)
        throw new Error(
          "This genre is not available in the public catalogue. Choose another genre or All genres.",
        );
      if (path && /^\/books\/[a-z0-9/-]+-arcs$/.test(path)) {
        catalog = `https://booksirens.com${path}`;
        if (robots.isAllowed(catalog, AGENT) === false)
          throw new Error("This BookSirens genre is not available for catalogue access.");
        html = await publicBooksirens(catalog, signal);
      }
    }
    const $ = load(html),
      urls = [
        ...new Set(
          $(".book-item a[href^='/book/']")
            .toArray()
            .map((e) => arcListingUrl("booksirens", $(e).attr("href")))
            .filter((u): u is string => Boolean(u)),
        ),
      ].slice(0, input.limit);
    if (!$(".book-item").length)
      throw new Error(
        "The public BookSirens catalogue format changed or is unavailable. Add a listing URL instead.",
      );
    let next = 0;
    async function worker() {
      while (next < urls.length && !signal.aborted) {
        const url = urls[next++]!;
        try {
          if (robots.isAllowed(url, AGENT) === false) {
            skipped++;
            continue;
          }
          const item = parseBooksirensPage(await publicBooksirens(url, signal), url);
          if (item) items.push(item);
          else skipped++;
        } catch {
          skipped++;
        }
      }
    }
    await Promise.all([worker(), worker()]);
    signal.throwIfAborted();
  } else {
    const spec = ARC_SOURCES[input.source];
    const body = await serpSearch(
      {
        engine: "google",
        q: `site:${new URL(spec.origin).hostname}${spec.path} ${input.genre}`.trim(),
        start: String((input.page - 1) * 10),
        hl: "en",
      },
      signal,
    );
    items = parseArcIndex(input.source, body).slice(0, input.limit);
  }
  const checked = items.length;
  return {
    items: items.filter((item) =>
      matchesPublicationWindow(item, input.from, input.to, input.includeUnknown),
    ),
    checked,
    skipped,
  };
}
