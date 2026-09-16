export type VerificationStatus = "verified" | "likely" | "unverified" | "conflicting";

export type ResearchSource = {
  provider: "google_books" | "open_library" | "website" | "amazon_manual";
  sourceType: string;
  url?: string;
  status: "retrieved" | "unavailable" | "manual_verification_required" | "failed";
  retrievedAt: string;
  data: Record<string, unknown>;
  error?: string;
};

export type ResearchEvidence = {
  section: string;
  claim: string;
  excerpt?: string;
  url?: string;
  verificationStatus: VerificationStatus;
  confidence: "high" | "medium" | "low";
};

export function extractAsin(value: string): string | undefined {
  const input = value.trim().toUpperCase();
  const direct = input.match(/^[A-Z0-9]{10}$/)?.[0];
  if (direct) return direct;
  return input.match(/(?:DP|ASIN)[\/=]([A-Z0-9]{10})(?:[/?&#]|$)/)?.[1];
}

function normalized(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function titleMatches(expected: string, received?: string) {
  if (!received) return false;
  const left = normalized(expected);
  const right = normalized(received);
  return left === right || left.includes(right) || right.includes(left);
}

async function readJson(url: string) {
  const response = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "HQ360AuthorAudit/1.0" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Provider returned ${response.status}`);
  return response.json() as Promise<unknown>;
}

export async function searchGoogleBooks(input: {
  title: string;
  author: string;
}): Promise<ResearchSource> {
  const retrievedAt = new Date().toISOString();
  try {
    const query = encodeURIComponent(`intitle:${input.title}+inauthor:${input.author}`);
    const data = (await readJson(
      `https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=5`,
    )) as {
      items?: { volumeInfo?: Record<string, unknown>; id?: string }[];
    };
    const item = data.items?.find((candidate) =>
      titleMatches(input.title, String(candidate.volumeInfo?.title ?? "")),
    );
    if (!item?.volumeInfo) {
      return {
        provider: "google_books",
        sourceType: "book_metadata",
        status: "unavailable",
        retrievedAt,
        data: {},
      };
    }
    return {
      provider: "google_books",
      sourceType: "book_metadata",
      url: item.id ? `https://books.google.com/books?id=${item.id}` : undefined,
      status: "retrieved",
      retrievedAt,
      data: item.volumeInfo,
    };
  } catch (error) {
    return {
      provider: "google_books",
      sourceType: "book_metadata",
      status: "failed",
      retrievedAt,
      data: {},
      error: error instanceof Error ? error.message : "Unknown provider error",
    };
  }
}

export async function searchOpenLibrary(input: {
  title: string;
  author: string;
}): Promise<ResearchSource> {
  const retrievedAt = new Date().toISOString();
  try {
    const query = new URLSearchParams({ title: input.title, author: input.author, limit: "5" });
    const data = (await readJson(`https://openlibrary.org/search.json?${query}`)) as {
      docs?: Record<string, unknown>[];
    };
    const item = data.docs?.find((candidate) =>
      titleMatches(input.title, String(candidate.title ?? "")),
    );
    if (!item)
      return {
        provider: "open_library",
        sourceType: "book_metadata",
        status: "unavailable",
        retrievedAt,
        data: {},
      };
    return {
      provider: "open_library",
      sourceType: "book_metadata",
      url: typeof item.key === "string" ? `https://openlibrary.org${item.key}` : undefined,
      status: "retrieved",
      retrievedAt,
      data: item,
    };
  } catch (error) {
    return {
      provider: "open_library",
      sourceType: "book_metadata",
      status: "failed",
      retrievedAt,
      data: {},
      error: error instanceof Error ? error.message : "Unknown provider error",
    };
  }
}

function permittedWebsiteUrl(value?: string) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    const hostname = url.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname.endsWith(".local") ||
      /^127\.|^10\.|^192\.168\.|^169\.254\.|^0\./.test(hostname)
    )
      return undefined;
    return url;
  } catch {
    return undefined;
  }
}

export async function auditWebsite(website?: string): Promise<ResearchSource> {
  const retrievedAt = new Date().toISOString();
  const url = permittedWebsiteUrl(website);
  if (!url)
    return {
      provider: "website",
      sourceType: "website_basics",
      status: "unavailable",
      retrievedAt,
      data: {},
      error: "No permitted website URL supplied",
    };
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
      headers: { "user-agent": "HQ360AuthorAudit/1.0" },
    });
    const html = await response.text();
    const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim();
    const description = html
      .match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i)?.[1]
      ?.trim();
    const newsletterVisible = /newsletter|subscribe|join (the )?(mailing |email )?list/i.test(html);
    return {
      provider: "website",
      sourceType: "website_basics",
      url: response.url,
      status: "retrieved",
      retrievedAt,
      data: {
        https: response.url.startsWith("https://"),
        statusCode: response.status,
        title,
        metaDescription: description,
        newsletterVisible,
        htmlLength: html.length,
      },
    };
  } catch (error) {
    return {
      provider: "website",
      sourceType: "website_basics",
      url: url.toString(),
      status: "failed",
      retrievedAt,
      data: {},
      error: error instanceof Error ? error.message : "Website request failed",
    };
  }
}

export function amazonManualVerification(amazonUrlOrAsin?: string): ResearchSource {
  return {
    provider: "amazon_manual",
    sourceType: "amazon_listing",
    url: amazonUrlOrAsin?.startsWith("http") ? amazonUrlOrAsin : undefined,
    status: "manual_verification_required",
    retrievedAt: new Date().toISOString(),
    data: {
      asin: extractAsin(amazonUrlOrAsin ?? ""),
      fields: [
        "title",
        "price",
        "rating",
        "review_count",
        "categories",
        "a_plus_content",
        "description",
      ],
    },
  };
}

export async function runFreeResearch(input: {
  author: string;
  title: string;
  website?: string;
  amazonUrlOrAsin?: string;
}) {
  const sources = await Promise.all([
    searchGoogleBooks(input),
    searchOpenLibrary(input),
    auditWebsite(input.website),
  ]);
  sources.push(amazonManualVerification(input.amazonUrlOrAsin));
  return sources;
}
