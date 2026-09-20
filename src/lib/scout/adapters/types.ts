/**
 * A source adapter turns a discovery query into candidate books. Adding a
 * new authorized source later means writing one more file that implements
 * this interface and registering it in `adapters/index.ts` — nothing else
 * in the discovery pipeline needs to change.
 */
import type { BookFormat, ReviewPlatform } from "@/lib/scout/db";

export type DiscoveryQuery = {
  /** Free-text search: title, author, or keyword. */
  query: string;
  genre?: string | undefined;
  maxResults?: number | undefined;
};

export type DiscoveredBookCandidate = {
  authorName: string;
  title: string;
  genre?: string | undefined;
  publicationDate?: string | undefined;
  bookFormat?: BookFormat | undefined;
  publisher?: string | undefined;
  isbn?: string | undefined;
  sourceUrl?: string | undefined;
  externalId?: string | undefined;
  rawData: Record<string, unknown>;
  /** Review signal native to this source, if the API exposes one. Omit
   * entirely rather than guessing — the caller stores "unknown" for any
   * platform it doesn't have a verified count for. */
  reviewSignal?:
    | {
        platform: ReviewPlatform;
        reviewCount: number | null;
        rating: number | null;
        verified: boolean;
      }
    | undefined;
};

export type SourceAdapter = {
  slug: string;
  /** Runs a discovery query against the live source. Must not throw for
   * ordinary "no results" or transient failures — return an empty array or
   * partial results and let the caller log the failure against the source. */
  discover(query: DiscoveryQuery): Promise<DiscoveredBookCandidate[]>;
  /** How many works/authors the source reports for this genre/query in
   * total, independent of how many discover() actually pulls in. Null when
   * the source doesn't expose a usable total or the lookup failed. */
  countAvailable?(query: DiscoveryQuery): Promise<number | null>;
};
