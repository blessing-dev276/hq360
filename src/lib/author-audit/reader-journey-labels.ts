import type { ReaderJourneyStage } from "./db";

/** Shared between the admin UI and both report renderers so the 8 stages
 * always read the same everywhere. */
export const READER_JOURNEY_STAGE_LABEL: Record<ReaderJourneyStage, string> = {
  discovery: "Discovery",
  interest: "Interest",
  trust: "Trust",
  book_information: "Book information",
  purchase: "Purchase",
  follow: "Follow author",
  owned_audience: "Join owned audience",
  next_book: "Discover next book",
};

export const READER_JOURNEY_STAGE_ORDER: ReaderJourneyStage[] = [
  "discovery",
  "interest",
  "trust",
  "book_information",
  "purchase",
  "follow",
  "owned_audience",
  "next_book",
];
