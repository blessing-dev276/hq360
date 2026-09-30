import { load } from "cheerio";
export const RF_ORIGIN = "https://readersfavorite.com";
export const RF_DEFAULT = "/book-reviews/book-reviews-genre-fiction-thriller-general.htm";
export type ReadersFavoriteBook = {
  title: string;
  authorName: string;
  sourceUrl: string;
  rating: number | null;
  genre: string;
};
export function readersFavoriteCatalog(value: string, page = 1) {
  const url = new URL(value, RF_ORIGIN);
  if (
    url.origin !== RF_ORIGIN ||
    url.username ||
    url.password ||
    !/^\/book-reviews\/book-reviews-genre-[a-z0-9-]+\.htm$/.test(url.pathname)
  )
    throw new Error("Choose a Readers’ Favorite genre page.");
  if (!Number.isInteger(page) || page < 1 || page > 100) throw new Error("Invalid page number.");
  url.search = new URLSearchParams({ page: String(page), "per-page": "10" }).toString();
  url.hash = "";
  return url.href;
}
export function parseReadersFavorite(html: string, url: string) {
  const $ = load(html);
  const genre = $("#category-name").text().replace(/\s+/g, " ").trim().slice(0, 80);
  const items: ReadersFavoriteBook[] = [];
  $(".book-short-dtl").each((_, element) => {
    const card = $(element);
    const link = card.find("h4 a[href]").first();
    const title = link.text().replace(/\s+/g, " ").trim();
    const authorName = card
      .find(".book-by")
      .text()
      .replace(/^\s*By\s+/i, "")
      .replace(/\s+/g, " ")
      .trim();
    const source = new URL(link.attr("href") || "/", RF_ORIGIN);
    if (
      !title ||
      !authorName ||
      source.origin !== RF_ORIGIN ||
      !/^\/book-review\/[a-z0-9-]+(?:\/\d+)?$/.test(source.pathname)
    )
      return;
    const match = card
      .find(".stars i")
      .attr("class")
      ?.match(/\bstar([1-5])\b/);
    if (!items.some((item) => item.sourceUrl === source.href))
      items.push({
        title,
        authorName,
        sourceUrl: source.href,
        rating: match ? Number(match[1]) : null,
        genre,
      });
  });
  if (!$("#category-name").length && !$(".book-short-dtl").length)
    throw new Error("Readers’ Favorite returned an unexpected page. Please try again later.");
  const genres = new Map<string, string>();
  $("a[href]").each((_, element) => {
    const link = $(element);
    try {
      const path = new URL(readersFavoriteCatalog(link.attr("href") || "")).pathname;
      const name = link.text().replace(/\s+/g, " ").trim();
      if (name) genres.set(path, name);
    } catch {
      /* Not a catalog link. */
    }
  });
  const nextHref = $(".pagination .next:not(.disabled) a[href]").attr("href");
  const current = new URL(url);
  const next = nextHref ? new URL(nextHref, RF_ORIGIN) : null;
  return {
    items,
    genres: [...genres].map(([path, name]) => ({ path, name })),
    hasNext:
      !!next &&
      next.origin === RF_ORIGIN &&
      next.pathname === current.pathname &&
      Number(next.searchParams.get("page")) === Number(current.searchParams.get("page") || 1) + 1,
  };
}
