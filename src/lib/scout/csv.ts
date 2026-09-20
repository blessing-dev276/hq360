/** Minimal CSV serializer -- no dependency exists elsewhere in this repo,
 * and RFC 4180 quoting is small enough not to justify adding one. */
export function toCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(
  rows: Record<string, unknown>[],
  columns: { key: string; header: string }[],
): string {
  const header = columns.map((c) => toCsvCell(c.header)).join(",");
  const body = rows.map((row) => columns.map((c) => toCsvCell(row[c.key])).join(","));
  return [header, ...body].join("\r\n");
}

/** Shared prospect/batch export shape (see original CSV export spec:
 * author, book, per-platform review counts, contact info, source URLs,
 * notes, status, last verification date -- blank rather than fabricated
 * for anything not yet known). */
export const SCOUT_EXPORT_COLUMNS = [
  { key: "authorName", header: "Author name" },
  { key: "bookTitle", header: "Book title" },
  { key: "genre", header: "Genre" },
  { key: "publicationDate", header: "Publication date" },
  { key: "googleBooksReviews", header: "Google Books reviews" },
  { key: "openLibraryReviews", header: "Open Library reviews" },
  { key: "goodreadsReviews", header: "Goodreads reviews" },
  { key: "amazonReviews", header: "Amazon reviews" },
  { key: "authorWebsite", header: "Author website" },
  { key: "contactEmail", header: "Public professional email" },
  { key: "contactForm", header: "Contact form" },
  { key: "bookUrl", header: "Book URL" },
  { key: "sourceUrls", header: "Source URLs" },
  { key: "researchNotes", header: "Research notes" },
  { key: "outreachStatus", header: "Outreach status" },
  { key: "lastVerifiedAt", header: "Last verification date" },
];

export function reviewCountFor(
  counts: { platform: string; review_count: number | null; verified: boolean }[],
  platform: string,
): string {
  const match = counts.find((c) => c.platform === platform);
  if (!match || match.review_count === null || !match.verified) return "";
  return String(match.review_count);
}

export function buildScoutExportRow(input: {
  authorName: string;
  bookTitle: string;
  genre: string | null;
  publicationDate: string | null;
  reviewCounts: { platform: string; review_count: number | null; verified: boolean }[];
  authorWebsite: string | null;
  contactEmail: string | null;
  contactForm: string | null;
  bookUrl: string | null;
  researchNotes: string | null;
  outreachStatus: string;
  lastVerifiedAt: string | null;
}) {
  return {
    authorName: input.authorName,
    bookTitle: input.bookTitle,
    genre: input.genre ?? "",
    publicationDate: input.publicationDate ?? "",
    googleBooksReviews: reviewCountFor(input.reviewCounts, "google_books"),
    openLibraryReviews: reviewCountFor(input.reviewCounts, "open_library"),
    goodreadsReviews: reviewCountFor(input.reviewCounts, "goodreads"),
    amazonReviews: reviewCountFor(input.reviewCounts, "amazon"),
    authorWebsite: input.authorWebsite ?? "",
    contactEmail: input.contactEmail ?? "",
    contactForm: input.contactForm ?? "",
    bookUrl: input.bookUrl ?? "",
    sourceUrls: input.bookUrl ?? "",
    researchNotes: input.researchNotes ?? "",
    outreachStatus: input.outreachStatus,
    lastVerifiedAt: input.lastVerifiedAt ?? "",
  };
}
