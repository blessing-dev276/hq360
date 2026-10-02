export const ARC_SOURCES = {
  netgalley: {
    name: "NetGalley",
    origin: "https://www.netgalley.com",
    path: "/catalog/book/",
    browse: "https://www.netgalley.com/catalog/",
    method: "Search-index discovery",
    note: "Public search listings only. Catalogue scraping is not enabled; confirm book details on the source page.",
  },
  booksirens: {
    name: "BookSirens",
    origin: "https://booksirens.com",
    path: "/book/",
    browse: "https://booksirens.com/advanced-reader-copies",
    method: "Public catalogue",
    note: "Reads a bounded sample of guest-accessible book pages. Member-only books are skipped.",
  },
  booksprout: {
    name: "Booksprout",
    origin: "https://booksprout.co",
    path: "/reviewer/review-copy/view/",
    browse: "https://booksprout.co/reviewer/review-copies",
    method: "Search-index discovery",
    note: "Public search listings only. Some author details and campaign dates require source-page review.",
  },
  storyorigin: {
    name: "StoryOrigin",
    origin: "https://storyoriginapp.com",
    path: "/reviewcopies/",
    browse: "https://storyoriginapp.com",
    method: "Search-index discovery",
    note: "Public review-copy links only. No member-directory or contact harvesting.",
  },
} as const;
export type ArcSource = keyof typeof ARC_SOURCES;
export const isArcSource = (value: string): value is ArcSource =>
  Object.prototype.hasOwnProperty.call(ARC_SOURCES, value);
export const ARC_GENRES = [
  "Fantasy",
  "Romance",
  "Mystery",
  "Thriller",
  "Science Fiction",
  "Historical Fiction",
  "Horror",
  "Young Adult",
  "Children",
  "Nonfiction",
  "Memoir",
];
export type ArcCandidate = {
  source_url: string;
  title: string;
  author_name: string | null;
  publication_date: string | null;
  genre: string | null;
  evidence: string;
  discovery_method: "public_catalog" | "search_index" | "manual";
};
export type ArcListing = ArcCandidate & {
  id: string;
  batch_id: string;
  source: ArcSource;
  book_id: string | null;
  book?: {
    id: string;
    scout_authors: {
      id: string;
      name: string;
      website_url: string | null;
      contact_email: string | null;
      contact_form_url: string | null;
      contact_verification_status: string;
    } | null;
  } | null;
};
export type ArcBatch = {
  id: string;
  label: string;
  created_at: string;
  sources: string[];
  item_count: number;
};
