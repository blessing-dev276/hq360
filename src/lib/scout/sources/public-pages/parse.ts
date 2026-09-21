import { load } from "cheerio";
import { canonicalUrl } from "../../normalize";
import type { DiscoveredBookCandidate } from "../../adapters/types";
type Node = Record<string, unknown>;
const text = (value: unknown): string | undefined =>
  typeof value === "string" ? value.trim() || undefined : undefined;
const object = (value: unknown): Node =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Node) : {};
/** Pure parsing only: callers must approve the domain, robots, terms and public access first.
 * No guessed title/author from unrelated page text. Missing identity means no record. */
export function parsePublicBook(html: string, pageUrl: string): DiscoveredBookCandidate | null {
  const $ = load(html);
  const robots = $('meta[name="robots"],meta[name="HQ360Scout"]')
    .map((_, el) => $(el).attr("content") ?? "")
    .get()
    .join(",");
  if (/\b(noindex|none)\b/i.test(robots)) throw new Error("Page excludes collection");
  const nodes: Node[] = [];
  function visit(value: unknown) {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    const node = object(value);
    if (!Object.keys(node).length) return;
    nodes.push(node);
    if (node["@graph"]) visit(node["@graph"]);
  }
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      visit(JSON.parse($(el).text()));
    } catch {
      /* One invalid script must not suppress valid structured data. */
    }
  });
  const hasType = (n: Node, t: string) =>
    [n["@type"]].flat().some((x) => typeof x === "string" && (x === t || x.endsWith("/" + t)));
  const book = nodes.find((n) => hasType(n, "Book"));
  const person = book ? object(Array.isArray(book.author) ? book.author[0] : book.author) : {};
  const referenced = nodes.find((n) => n["@id"] && n["@id"] === person["@id"]);
  const author = { ...referenced, ...person };
  const semanticBook = $('[itemscope][itemtype$="/Book"]').first();
  const prop = (name: string) => semanticBook.find(`[itemprop="${name}"]`).first();
  const value = (name: string) =>
    prop(name).attr("content") || prop(name).text().trim() || undefined;
  const meta = (name: string) => $(`meta[property="${name}"]`).attr("content");
  const title = text(book?.name) || value("name") || meta("og:title");
  const authorName =
    text(author.name) ||
    text(book?.author) ||
    value("author") ||
    $('meta[name="author"]').attr("content");
  if (!title || !authorName) return null;
  function url(v: unknown) {
    const s = text(v);
    if (!s) return undefined;
    try {
      return canonicalUrl(new URL(s, pageUrl).toString()) ?? undefined;
    } catch {
      return undefined;
    }
  }
  const canonical = url($('link[rel="canonical"]').attr("href"));
  // Reject off-site canonical links rather than transferring identity to an unrelated domain.
  const sourceUrl =
    canonical && new URL(canonical).origin === new URL(pageUrl).origin
      ? canonical
      : (canonicalUrl(pageUrl) ?? undefined);
  const rating = object(book?.aggregateRating);
  const count = Number(rating.reviewCount ?? rating.ratingCount);
  const score = Number(rating.ratingValue);
  return {
    title,
    authorName,
    sourceUrl,
    authorProfileUrl: url(author.url),
    bio: text(author.description),
    description: text(book?.description) || value("description") || meta("og:description"),
    publicationDate: text(book?.datePublished) || value("datePublished"),
    isbn: text(book?.isbn) || value("isbn"),
    genre: text(book?.genre),
    publisher: text(object(book?.publisher).name) || text(book?.publisher),
    coverImageUrl:
      url(typeof book?.image === "string" ? book.image : object(book?.image).url) ||
      url(meta("og:image")),
    socialLinks: (Array.isArray(author.sameAs) ? author.sameAs : [])
      .map(url)
      .filter((s): s is string => Boolean(s)),
    rawData: book ?? { parsing: "semantic/metadata" },
    ...(Number.isFinite(count) && count >= 0
      ? {
          reviewSignal: {
            platform: "other" as const,
            reviewCount: count,
            rating: Number.isFinite(score) ? score : null,
            verified: false,
          },
        }
      : {}),
  };
}
/** Follow public anchors only. No private APIs or inferred pagination endpoints. */
export function discoverPublicLinks(html: string, pageUrl: string, accept: (url: URL) => boolean) {
  const $ = load(html);
  if (/\b(nofollow|none)\b/i.test($('meta[name="robots"]').attr("content") ?? "")) return [];
  const links = new Set<string>();
  $("a[href]").each((_, el) => {
    if (/nofollow/i.test($(el).attr("rel") ?? "")) return;
    try {
      const url = new URL($(el).attr("href")!, pageUrl);
      if (url.origin === new URL(pageUrl).origin && accept(url)) {
        const normalized = canonicalUrl(url.toString());
        if (normalized) links.add(normalized);
      }
    } catch {
      /* malformed URL */
    }
  });
  return [...links];
}
