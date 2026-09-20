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

export const openLibraryAdapter: SourceAdapter = {
  slug: "open_library",
  async discover(query: DiscoveryQuery): Promise<DiscoveredBookCandidate[]> {
    const params = new URLSearchParams({
      q: query.query,
      limit: String(Math.min(query.maxResults ?? 20, 40)),
    });
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
