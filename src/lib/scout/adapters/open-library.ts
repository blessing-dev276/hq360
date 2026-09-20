import type { DiscoveredBookCandidate, DiscoveryQuery, SourceAdapter } from "./types";

async function readJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "HQ360Scout/1.0" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Open Library returned ${response.status}`);
  return response.json() as Promise<unknown>;
}

type Doc = {
  key?: string;
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  subject?: string[];
  publisher?: string[];
  isbn?: string[];
  ratings_count?: number;
  ratings_average?: number;
};

type SearchResponse = { docs?: Doc[] };

type SubjectWork = {
  key?: string;
  title?: string;
  authors?: { name?: string }[];
  first_publish_year?: number;
};
type SubjectResponse = { works?: SubjectWork[] };

function subjectSlug(genre: string) {
  return genre
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Genre-only browsing: Open Library's subjects endpoint lists works for a
 * subject/genre directly, with no title/author search term needed. */
async function discoverBySubject(genre: string, limit: number): Promise<DiscoveredBookCandidate[]> {
  let data: SubjectResponse;
  try {
    data = (await readJson(
      `https://openlibrary.org/subjects/${encodeURIComponent(subjectSlug(genre))}.json?limit=${limit}`,
    )) as SubjectResponse;
  } catch {
    return [];
  }
  const candidates: DiscoveredBookCandidate[] = [];
  for (const work of data.works ?? []) {
    const authorName = work.authors?.[0]?.name;
    if (!work.title || !authorName) continue;
    candidates.push({
      authorName,
      title: work.title,
      genre,
      publicationDate: work.first_publish_year ? String(work.first_publish_year) : undefined,
      bookFormat: "unknown",
      sourceUrl: work.key ? `https://openlibrary.org${work.key}` : undefined,
      externalId: work.key,
      rawData: work as unknown as Record<string, unknown>,
    });
  }
  return candidates;
}

export const openLibraryAdapter: SourceAdapter = {
  slug: "open_library",
  async discover(query: DiscoveryQuery): Promise<DiscoveredBookCandidate[]> {
    const trimmed = query.query.trim();
    const limit = Math.min(query.maxResults ?? 20, 40);
    if (!trimmed && query.genre) return discoverBySubject(query.genre, limit);
    if (!trimmed) return [];

    const params = new URLSearchParams({ q: trimmed, limit: String(limit) });
    let data: SearchResponse;
    try {
      data = (await readJson(`https://openlibrary.org/search.json?${params}`)) as SearchResponse;
    } catch {
      return [];
    }

    const candidates: DiscoveredBookCandidate[] = [];
    for (const doc of data.docs ?? []) {
      const authorName = doc.author_name?.[0];
      if (!doc.title || !authorName) continue;
      if (
        query.genre &&
        !(doc.subject ?? []).some((s) => s.toLowerCase().includes(query.genre!.toLowerCase()))
      )
        continue;
      // Open Library rarely exposes ratings_count reliably; only attach a
      // review signal when the field is actually present, otherwise the
      // caller correctly leaves this platform's count as unknown.
      candidates.push({
        authorName,
        title: doc.title,
        genre: doc.subject?.[0],
        publicationDate: doc.first_publish_year ? String(doc.first_publish_year) : undefined,
        bookFormat: "unknown",
        publisher: doc.publisher?.[0],
        isbn: doc.isbn?.[0],
        sourceUrl: doc.key ? `https://openlibrary.org${doc.key}` : undefined,
        externalId: doc.key,
        rawData: doc as unknown as Record<string, unknown>,
        reviewSignal:
          typeof doc.ratings_count === "number"
            ? {
                platform: "open_library",
                reviewCount: doc.ratings_count,
                rating: doc.ratings_average ?? null,
                verified: true,
              }
            : undefined,
      });
    }
    return candidates;
  },
};
