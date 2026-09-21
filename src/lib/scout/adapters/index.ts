import { reedsyAdapter } from "../sources/reedsy/adapter";
import type { SourceAdapter } from "./types";
export type { DiscoveredBookCandidate, DiscoveryQuery, SourceAdapter } from "./types";
/** Scout's active source is Reedsy only. Older adapter modules are retained for historical tests. */
export const SOURCE_ADAPTERS: Record<string, SourceAdapter> = { reedsy_discovery: reedsyAdapter };
