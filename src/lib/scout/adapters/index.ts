import { googleBooksAdapter } from "./google-books";
import { openLibraryAdapter } from "./open-library";
import type { SourceAdapter } from "./types";

export type { DiscoveredBookCandidate, DiscoveryQuery, SourceAdapter } from "./types";

/** Implemented adapters, keyed by scout_sources.slug. Add a new authorized
 * source by writing an adapter module and registering it here — the
 * discovery route and UI don't need to change. */
export const SOURCE_ADAPTERS: Record<string, SourceAdapter> = {
  google_books: googleBooksAdapter,
  open_library: openLibraryAdapter,
};
