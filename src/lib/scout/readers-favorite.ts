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
  // Pagination is a lower bound, not an exact total: the visible page window
  // can stop long before the last page. Never multiply it into a claimed total.
  const activePageIndex = $(".pagination .active a[data-page]").attr("data-page");
  const activePage = activePageIndex !== undefined ? Number(activePageIndex) + 1 : null;
  const requestedPage = Number(current.searchParams.get("page") || 1);
  const currentPage =
    activePage !== null && Number.isInteger(activePage) && activePage > 0
      ? activePage
      : requestedPage <= 100
        ? requestedPage
        : 1;
  const pageNumbers = $(".pagination a[href]")
    .toArray()
    .flatMap((element) => {
      try {
        const link = new URL($(element).attr("href")!, RF_ORIGIN);
        const page = Number(link.searchParams.get("page"));
        return link.origin === RF_ORIGIN &&
          link.pathname === current.pathname &&
          Number.isInteger(page) &&
          page > 0
          ? [page]
          : [];
      } catch {
        return [];
      }
    });
  const minimumBookCount = Math.max(
    ...pageNumbers.map((page) => (page - 1) * 10 + 1),
    (currentPage - 1) * 10 + $(".book-short-dtl").length,
  );
  // An explicitly disabled Next control proves this is the final page.
  const finalPage =
    $(".pagination .next.disabled").length > 0 && (requestedPage <= 100 || activePage !== null);
  const bookCount = finalPage ? (currentPage - 1) * 10 + $(".book-short-dtl").length : null;
  if (genre) genres.set(current.pathname, genre);
  return {
    items,
    bookCount,
    minimumBookCount,
    genres: [...genres].map(([path, name]) => ({
      path,
      name,
      bookCount: path === current.pathname ? bookCount : null,
      minimumBookCount: path === current.pathname ? minimumBookCount : 0,
    })),
    hasNext:
      !!next &&
      next.origin === RF_ORIGIN &&
      next.pathname === current.pathname &&
      Number(next.searchParams.get("page")) === Number(current.searchParams.get("page") || 1) + 1,
  };
}
