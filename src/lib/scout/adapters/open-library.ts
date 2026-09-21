import type { DiscoveredBookCandidate, DiscoveryQuery, SourceAdapter } from "./types";
type SubjectWork = {
  key?: string;
  title?: string;
  authors?: { name?: string; key?: string }[];
  first_publish_year?: number;
  cover_id?: number;
  subject?: string[];
};
type SubjectResponse = { works?: SubjectWork[]; work_count?: number };
function subjectSlug(genre: string) {
  return genre
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
/** Public Subjects API. The site's current robots rules prohibit /search,
 * including /search.json; never switch to that endpoint for keyword queries. */
export const openLibraryAdapter: SourceAdapter = {
  slug: "open_library",
  async discover(query: DiscoveryQuery): Promise<DiscoveredBookCandidate[]> {
    if (!query.genre?.trim())
      throw new Error(
        "Open Library requires a genre: robots.txt excludes keyword search. Use subject browsing.",
      );
    const slug = subjectSlug(query.genre);
    if (!slug) throw new Error("Invalid Open Library subject");
    const limit = Math.min(query.maxResults ?? 20, 40);
    const data = (await query.fetchJson!(
      `https://openlibrary.org/subjects/${encodeURIComponent(slug)}.json?limit=${limit}&offset=${query.offset ?? 0}`,
    )) as SubjectResponse;
    const candidates: DiscoveredBookCandidate[] = [];
    for (const work of data.works ?? []) {
      const authorName = work.authors?.[0]?.name;
      if (!work.title || !authorName || !work.key) continue;
      // Search text, if supplied alongside genre, is only a local filter on this permitted subject page.
      if (
        query.query.trim() &&
        !`${work.title} ${authorName}`.toLowerCase().includes(query.query.trim().toLowerCase())
      )
        continue;
      candidates.push({
        title: work.title,
        authorName,
        genre: query.genre,
        categories: work.subject,
        authorProfileUrl: work.authors?.[0]?.key
          ? `https://openlibrary.org${work.authors[0].key}`
          : undefined,
        publicationDate: work.first_publish_year ? String(work.first_publish_year) : undefined,
        coverImageUrl: work.cover_id
          ? `https://covers.openlibrary.org/b/id/${work.cover_id}-M.jpg`
          : undefined,
        sourceUrl: `https://openlibrary.org${work.key}`,
        externalId: work.key,
        bookFormat: "unknown",
        rawData: work as Record<string, unknown>,
      });
    }
    return candidates;
  },
  async countAvailable(query: DiscoveryQuery) {
    if (!query.genre?.trim() || query.query.trim()) return null;
    const data = (await query.fetchJson!(
      `https://openlibrary.org/subjects/${encodeURIComponent(subjectSlug(query.genre))}.json?limit=0`,
    )) as SubjectResponse;
    return typeof data.work_count === "number" ? data.work_count : null;
  },
};
