import type { DiscoveredBookCandidate } from "./adapters/types";
export function canonicalUrl(value?: string): string | null {
  if (!value) return null;
  try {
    const u = new URL(value);
    if (!["https:", "http:"].includes(u.protocol) || u.username || u.password) return null;
    u.hash = "";
    for (const key of [...u.searchParams.keys()])
      if (/^(utm_|fbclid$|gclid$)/i.test(key)) u.searchParams.delete(key);
    u.searchParams.sort();
    return u.toString();
  } catch {
    return null;
  }
}
export const normalizeText = (v: string) =>
  v.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
export function normalizeBook(source: string, c: DiscoveredBookCandidate) {
  const sourceUrl = canonicalUrl(c.sourceUrl);
  if (!sourceUrl || !c.title.trim() || !c.authorName.trim())
    throw new Error("Book requires title, author and public source URL");
  const rawDate = c.publicationDate ?? "";
  const fullDate =
    /^\d{4}-\d{2}-\d{2}$/.test(rawDate) &&
    !Number.isNaN(Date.parse(rawDate)) &&
    new Date(rawDate).toISOString().startsWith(rawDate)
      ? rawDate
      : null;
  const isbn = (c.isbn ?? "").replace(/[^0-9X]/gi, "").toUpperCase();
  return {
    source,
    source_url: sourceUrl,
    book_title: c.title.trim(),
    normalized_title: normalizeText(c.title),
    author_name: c.authorName.trim(),
    normalized_name: normalizeText(c.authorName),
    subtitle: c.subtitle ?? null,
    author_profile_url: canonicalUrl(c.authorProfileUrl),
    author_website: canonicalUrl(c.authorWebsite),
    bio: c.bio ?? null,
    social_links: (c.socialLinks ?? []).map(canonicalUrl).filter(Boolean),
    genre: c.genre ?? null,
    categories: c.categories ?? [],
    description: c.description ?? null,
    publication_date: fullDate,
    publication_year: /^\d{4}(?:-|$)/.test(rawDate) ? Number(rawDate.slice(0, 4)) : null,
    publisher: c.publisher ?? null,
    cover_image_url: canonicalUrl(c.coverImageUrl),
    isbn: /^(\d{13}|\d{9}[\dX])$/.test(isbn) ? isbn : null,
    external_id: c.externalId ?? null,
    review_count: c.reviewSignal?.reviewCount ?? null,
    rating: c.reviewSignal?.rating ?? null,
    review_platform: c.reviewSignal?.platform ?? null,
    collected_at: new Date().toISOString(),
    verification_status: "needs_review",
    confidence_score: c.authorProfileUrl ? 70 : 40,
    raw_data: c.rawData,
  };
}
export type NormalizedBook = ReturnType<typeof normalizeBook>;
export type IdentityEvidence = {
  name: string;
  website?: string | null;
  books?: string[];
  publisher?: string | null;
  bio?: string | null;
  socialLinks?: string[];
  location?: string | null;
};
export function compareIdentity(a: IdentityEvidence, b: IdentityEvidence) {
  if (normalizeText(a.name) !== normalizeText(b.name))
    return { score: 0, reasons: ["Names differ"], autoMerge: false };
  let score = 10;
  const reasons = ["Name agrees (insufficient alone)"];
  const sameWebsite = a.website && b.website && canonicalUrl(a.website) === canonicalUrl(b.website);
  const sameBook = (a.books ?? []).some((x) => (b.books ?? []).includes(x));
  if (sameWebsite) {
    score += 45;
    reasons.push("Same official website");
  }
  if (sameBook) {
    score += 35;
    reasons.push("Shared book identifier");
  }
  if ((a.socialLinks ?? []).some((x) => (b.socialLinks ?? []).includes(x))) {
    score += 20;
    reasons.push("Shared social URL");
  }
  if (a.publisher && a.publisher === b.publisher) {
    score += 5;
    reasons.push("Publisher agrees");
  }
  if (a.bio && a.bio.length > 80 && a.bio === b.bio) {
    score += 10;
    reasons.push("Bio agrees");
  }
  if (a.location && a.location === b.location) {
    score += 5;
    reasons.push("Public location agrees");
  }
  return { score: Math.min(score, 100), reasons, autoMerge: false }; // Cross-source identity always reviewed.
}
export function titleSimilarity(a: string, b: string) {
  const left = new Set(normalizeText(a).split(/\W+/).filter(Boolean));
  const right = new Set(normalizeText(b).split(/\W+/).filter(Boolean));
  const intersection = [...left].filter((x) => right.has(x)).length;
  return intersection / (new Set([...left, ...right]).size || 1);
}
export function qualification(
  books: NormalizedBook[],
  website: string | null,
  professionalEmail: string | null,
) {
  const recent = books.some(
    (b) =>
      b.publication_date &&
      Date.parse(b.publication_date) <= Date.now() &&
      Date.now() - Date.parse(b.publication_date) < 365 * 86400000,
  );
  return {
    has_author_website: Boolean(website),
    has_professional_email: Boolean(professionalEmail),
    has_goodreads_presence: books.some((b) => b.source === "goodreads"),
    has_multiple_books: books.length > 1,
    review_count: books.map((b) => ({ source: b.source, count: b.review_count })),
    recent_release: recent,
    series_author: null,
    publisher_type: "unknown",
    independent_author_possible: null,
    visibility_gap_notes: website
      ? "Review site quality and source evidence manually."
      : "No official website verified yet.",
    outreach_priority_score: Math.min(
      100,
      (website ? 20 : 0) +
        (professionalEmail ? 20 : 0) +
        (books.length > 1 ? 20 : 0) +
        (recent ? 20 : 0),
    ),
  };
}
