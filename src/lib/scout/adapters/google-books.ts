import type { DiscoveredBookCandidate, DiscoveryQuery, SourceAdapter } from "./types";
import type { BookFormat } from "@/lib/scout/db";

function mapFormat(printType?: string): BookFormat {
  if (printType === "BOOK") return "unknown";
  return "unknown";
}

async function readJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "HQ360Scout/1.0" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Google Books returned ${response.status}`);
  return response.json() as Promise<unknown>;
}

type VolumeInfo = {
  title?: string;
  authors?: string[];
  categories?: string[];
  publishedDate?: string;
  publisher?: string;
  industryIdentifiers?: { type: string; identifier: string }[];
  printType?: string;
  ratingsCount?: number;
  averageRating?: number;
};

type VolumesResponse = {
  items?: { id?: string; volumeInfo?: VolumeInfo }[];
};

export const googleBooksAdapter: SourceAdapter = {
  slug: "google_books",
  async discover(query: DiscoveryQuery): Promise<DiscoveredBookCandidate[]> {
    const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
    const q = encodeURIComponent(query.query);
    const maxResults = Math.min(query.maxResults ?? 20, 40);
    const url = `https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=${maxResults}${
      apiKey ? `&key=${apiKey}` : ""
    }`;
    let data: VolumesResponse;
    try {
      data = (await readJson(url)) as VolumesResponse;
    } catch {
      return [];
    }

    const candidates: DiscoveredBookCandidate[] = [];
    for (const item of data.items ?? []) {
      const info = item.volumeInfo;
      const authorName = info?.authors?.[0];
      if (!info?.title || !authorName) continue;
      if (
        query.genre &&
        !(info.categories ?? []).some((c) => c.toLowerCase().includes(query.genre!.toLowerCase()))
      )
        continue;
      const isbn = info.industryIdentifiers?.find(
        (i) => i.type === "ISBN_13" || i.type === "ISBN_10",
      )?.identifier;
      // Google's ratingsCount is a Google Books signal only -- it is stored
      // under the google_books platform and must never be treated as an
      // Amazon/Goodreads review count.
      candidates.push({
        authorName,
        title: info.title,
        genre: info.categories?.[0],
        publicationDate: info.publishedDate,
        bookFormat: mapFormat(info.printType),
        publisher: info.publisher,
        isbn,
        sourceUrl: item.id ? `https://books.google.com/books?id=${item.id}` : undefined,
        externalId: item.id,
        rawData: info as unknown as Record<string, unknown>,
        reviewSignal:
          typeof info.ratingsCount === "number"
            ? {
                platform: "google_books",
                reviewCount: info.ratingsCount,
                rating: info.averageRating ?? null,
                verified: true,
              }
            : undefined,
      });
    }
    return candidates;
  },
};
